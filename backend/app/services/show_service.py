from typing import Optional, List, Dict
from datetime import datetime, date, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload
from app.models.show import Show, ShowPricing
from app.models.movie import Movie
from app.models.theater import Theater, Screen, Seat
from app.models.reservation import SeatHold
from app.models.booking import BookingSeat, Booking, BookingStatus
from app.schemas.show import ShowCreate, ShowSeatAvailabilityResponse, SeatAvailabilityItem
from app.common.exceptions import ResourceNotFoundException


from app.redis_client import redis_service


class ShowService:
    @classmethod
    async def list_shows(
        cls,
        db: AsyncSession,
        movie_id: Optional[str] = None,
        theater_id: Optional[str] = None,
        city: Optional[str] = None,
        target_date: Optional[date] = None,
    ) -> List[Show]:
        stmt = (
            select(Show)
            .where(Show.is_active == True)
            .options(
                selectinload(Show.movie),
                selectinload(Show.pricing),
                selectinload(Show.screen).selectinload(Screen.theater),
            )
        )

        if movie_id:
            stmt = stmt.where(Show.movie_id == movie_id)

        if theater_id:
            stmt = stmt.join(Screen, Show.screen_id == Screen.id).where(Screen.theater_id == theater_id)

        if city and not theater_id:
            stmt = (
                stmt.join(Screen, Show.screen_id == Screen.id)
                .join(Theater, Screen.theater_id == Theater.id)
                .where(Theater.city.ilike(city.strip()))
            )

        if target_date:
            start_of_day = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=timezone.utc)
            end_of_day = datetime(target_date.year, target_date.month, target_date.day, 23, 59, 59, tzinfo=timezone.utc)
            stmt = stmt.where(and_(Show.start_time >= start_of_day, Show.start_time <= end_of_day))

        stmt = stmt.order_by(Show.start_time.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def get_show_by_id(cls, db: AsyncSession, show_id: str) -> Show:
        stmt = (
            select(Show)
            .where(Show.id == show_id, Show.is_active == True)
            .options(
                selectinload(Show.movie),
                selectinload(Show.pricing),
                selectinload(Show.screen).selectinload(Screen.theater),
            )
        )
        result = await db.execute(stmt)
        show = result.scalar_one_or_none()
        if not show:
            raise ResourceNotFoundException("Show", show_id)
        return show

    @classmethod
    async def create_show(cls, db: AsyncSession, data: ShowCreate) -> Show:
        show = Show(
            movie_id=data.movie_id,
            screen_id=data.screen_id,
            start_time=data.start_time,
            end_time=data.end_time,
            language=data.language,
            format=data.format,
            status=data.status,
            is_active=data.is_active,
        )
        db.add(show)
        await db.flush()

        for p in data.pricing:
            pricing = ShowPricing(
                show_id=show.id,
                seat_type=p.seat_type.upper(),
                price=p.price,
            )
            db.add(pricing)

        await db.commit()
        await db.refresh(show)
        return await cls.get_show_by_id(db, show.id)

    @classmethod
    async def get_show_seat_availability(
        cls,
        db: AsyncSession,
        show_id: str,
        current_user_id: Optional[str] = None,
        hold_token: Optional[str] = None,
    ) -> ShowSeatAvailabilityResponse:
        show = await cls.get_show_by_id(db, show_id)
        now = datetime.now(timezone.utc)

        # 1. Fetch screen seats
        seats_stmt = (
            select(Seat)
            .where(Seat.screen_id == show.screen_id, Seat.is_active == True)
            .order_by(Seat.row.asc(), Seat.number.asc())
        )
        seats_res = await db.execute(seats_stmt)
        all_seats = list(seats_res.scalars().all())

        # 2. Build pricing map
        pricing_map: Dict[str, float] = {p.seat_type.upper(): p.price for p in show.pricing}

        # 3. Opportunistically purge expired holds for this show to immediately free seats
        expired_stmt = (
            select(SeatHold)
            .where(
                SeatHold.show_id == show_id,
                SeatHold.status == "HELD",
                SeatHold.expires_at <= now,
            )
        )
        expired_res = await db.execute(expired_stmt)
        expired_holds = list(expired_res.scalars().all())
        if expired_holds:
            for h in expired_holds:
                h.status = "EXPIRED"
                await redis_service.release_seat_hold(h.show_id, h.seat_id, user_id=None)
            await db.commit()

        # 4. Fetch active holds
        holds_stmt = (
            select(SeatHold)
            .where(
                SeatHold.show_id == show_id,
                SeatHold.status == "HELD",
                SeatHold.expires_at > now,
            )
        )
        holds_res = await db.execute(holds_stmt)
        active_holds = {h.seat_id: h for h in holds_res.scalars().all()}

        # 4. Fetch confirmed/pending booking seats
        booked_stmt = (
            select(BookingSeat)
            .join(Booking, BookingSeat.booking_id == Booking.id)
            .where(
                BookingSeat.show_id == show_id,
                BookingSeat.status == "CONFIRMED",
                Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
            )
        )
        booked_res = await db.execute(booked_stmt)
        booked_seats = {b.seat_id: b for b in booked_res.scalars().all()}

        # 5. Build dynamic seat items
        seat_items: List[SeatAvailabilityItem] = []
        available_count = 0
        held_count = 0
        booked_count = 0

        for seat in all_seats:
            stype = seat.seat_type.upper()
            price = pricing_map.get(stype, 250.0)

            if seat.id in booked_seats:
                status = "BOOKED"
                booked_count += 1
                expires_at = None
            elif seat.id in active_holds:
                hold = active_holds[seat.id]
                expires_at = hold.expires_at
                # Check if held by requesting user
                if (current_user_id and hold.user_id == current_user_id) or (hold_token and hold.hold_token == hold_token):
                    status = "HELD_BY_ME"
                else:
                    status = "HELD"
                held_count += 1
            else:
                status = "AVAILABLE"
                available_count += 1
                expires_at = None

            seat_items.append(
                SeatAvailabilityItem(
                    seat_id=seat.id,
                    row=seat.row,
                    number=seat.number,
                    column_index=seat.column_index,
                    seat_type=stype,
                    price=price,
                    status=status,
                    hold_expires_at=expires_at,
                )
            )

        theater_name = show.screen.theater.name if show.screen and show.screen.theater else "Cinema"
        screen_name = show.screen.name if show.screen else "Screen 1"

        return ShowSeatAvailabilityResponse(
            show_id=show.id,
            movie_id=show.movie_id,
            movie_title=show.movie.title if show.movie else "Movie",
            theater_name=theater_name,
            screen_name=screen_name,
            screen_type=show.screen.screen_type if show.screen else "2D",
            start_time=show.start_time,
            end_time=show.end_time,
            language=show.language,
            format=show.format,
            rows_count=show.screen.rows_count if show.screen else 8,
            cols_count=show.screen.cols_count if show.screen else 12,
            pricing=pricing_map,
            seats=seat_items,
            total_available=available_count,
            total_held=held_count,
            total_booked=booked_count,
        )
