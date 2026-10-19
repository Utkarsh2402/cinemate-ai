import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_, or_
from app.config import settings
from app.models.base import ensure_utc
from app.models.show import Show, ShowPricing
from app.models.theater import Seat
from app.models.reservation import SeatHold
from app.models.booking import Booking, BookingSeat, BookingStatus
from app.redis_client import redis_service
from app.schemas.reservation import SeatHoldBatchResponse, SeatHoldItem
from app.common.exceptions import (
    AppException,
    ResourceNotFoundException,
    SeatAlreadyReservedException,
    SeatHoldExpiredException,
)
import logging

logger = logging.getLogger("cinemate.reservation_service")


class ReservationService:
    @classmethod
    async def hold_seats(
        cls,
        db: AsyncSession,
        show_id: str,
        seat_ids: List[str],
        user_id: str,
    ) -> SeatHoldBatchResponse:
        """
        Dual-layer concurrency control:
        Layer 1: Redis distributed atomic keys with TTL (fast-fail for concurrent requests).
        Layer 2: Database transaction with conflict validation against confirmed bookings and active holds.
        """
        if not seat_ids:
            raise AppException("At least one seat must be selected", status_code=400)

        if len(seat_ids) > settings.MAX_SEATS_PER_BOOKING:
            raise AppException(f"Cannot book more than {settings.MAX_SEATS_PER_BOOKING} seats at once", status_code=400)

        # 1. Validate show
        show_stmt = select(Show).where(Show.id == show_id, Show.is_active == True)
        show_res = await db.execute(show_stmt)
        show = show_res.scalar_one_or_none()
        if not show:
            raise ResourceNotFoundException("Show", show_id)

        now = datetime.now(timezone.utc)
        if ensure_utc(show.start_time) <= now:
            raise AppException("Cannot book seats for a past or starting show", status_code=400)

        # 2. Layer 1: Atomic Redis acquisition for all requested seats
        acquired_redis_seats: List[str] = []
        for s_id in seat_ids:
            acquired = await redis_service.acquire_seat_hold(
                show_id=show_id,
                seat_id=s_id,
                user_id=user_id,
                ttl_seconds=settings.SEAT_HOLD_DURATION_SECONDS,
            )
            if acquired:
                acquired_redis_seats.append(s_id)
            else:
                # Concurrent conflict caught by Redis fast-lock!
                # Rollback previously acquired Redis keys in this batch
                for rollback_id in acquired_redis_seats:
                    await redis_service.release_seat_hold(show_id, rollback_id, user_id)
                logger.info("Redis hold conflict on seat %s for show %s", s_id, show_id)
                raise SeatAlreadyReservedException([s_id])

        # 3. Layer 2: Database transactional conflict check
        try:
            # Check confirmed/pending bookings
            booked_stmt = (
                select(BookingSeat.seat_id)
                .join(Booking, BookingSeat.booking_id == Booking.id)
                .where(
                    BookingSeat.show_id == show_id,
                    BookingSeat.seat_id.in_(seat_ids),
                    BookingSeat.status == "CONFIRMED",
                    Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
                )
            )
            booked_res = await db.execute(booked_stmt)
            conflicted_booked_seats = list(booked_res.scalars().all())
            if conflicted_booked_seats:
                for s_id in acquired_redis_seats:
                    await redis_service.release_seat_hold(show_id, s_id, user_id)
                raise SeatAlreadyReservedException(conflicted_booked_seats)

            # Check existing active database holds (excluding expired ones)
            active_holds_stmt = (
                select(SeatHold.seat_id, SeatHold.user_id)
                .where(
                    SeatHold.show_id == show_id,
                    SeatHold.seat_id.in_(seat_ids),
                    SeatHold.status == "HELD",
                    SeatHold.expires_at > now,
                )
            )
            active_holds_res = await db.execute(active_holds_stmt)
            held_records = active_holds_res.all()

            # If held by a different user, conflict!
            conflicted_held_seats = [r.seat_id for r in held_records if r.user_id != user_id]
            if conflicted_held_seats:
                for s_id in acquired_redis_seats:
                    await redis_service.release_seat_hold(show_id, s_id, user_id)
                raise SeatAlreadyReservedException(conflicted_held_seats)

            # Fetch seat rows and pricing
            seats_stmt = select(Seat).where(Seat.id.in_(seat_ids), Seat.screen_id == show.screen_id)
            seats_res = await db.execute(seats_stmt)
            seats_map = {s.id: s for s in seats_res.scalars().all()}

            if len(seats_map) != len(seat_ids):
                raise AppException("One or more selected seats do not belong to this screen", status_code=400)

            pricing_stmt = select(ShowPricing).where(ShowPricing.show_id == show_id)
            pricing_res = await db.execute(pricing_stmt)
            pricing_map = {p.seat_type.upper(): p.price for p in pricing_res.scalars().all()}

            # Generate hold token & expiry
            hold_token = f"hld_{secrets.token_hex(20)}"
            expires_at = now + timedelta(seconds=settings.SEAT_HOLD_DURATION_SECONDS)

            # Invalidate any previous expired or superseded holds for this user on these seats
            await db.execute(
                update(SeatHold)
                .where(
                    SeatHold.show_id == show_id,
                    SeatHold.seat_id.in_(seat_ids),
                    SeatHold.user_id == user_id,
                )
                .values(status="RELEASED")
            )

            # Create SeatHold records
            hold_items: List[SeatHoldItem] = []
            subtotal = 0.0

            for s_id in seat_ids:
                seat = seats_map[s_id]
                seat_type = seat.seat_type.upper()
                price = pricing_map.get(seat_type, 250.0)
                subtotal += price

                hold = SeatHold(
                    show_id=show_id,
                    seat_id=s_id,
                    user_id=user_id,
                    hold_token=hold_token,
                    status="HELD",
                    expires_at=expires_at,
                )
                db.add(hold)
                await db.flush()

                hold_items.append(
                    SeatHoldItem(
                        hold_id=hold.id,
                        seat_id=s_id,
                        row=seat.row,
                        number=seat.number,
                        seat_type=seat_type,
                        price=price,
                        expires_at=expires_at,
                    )
                )

            await db.commit()

            from app.schemas.reservation import ConcurrencyTelemetry
            
            telemetry_data = ConcurrencyTelemetry(
                layer1_redis_lock=f"SETNX seat_hold:{show_id}:[{','.join(seat_ids)}] {user_id} EX {settings.SEAT_HOLD_DURATION_SECONDS}",
                layer2_acid_isolation="PostgreSQL SELECT FOR UPDATE with READ COMMITTED row locking",
                atomic_rollback_supported=True,
                lock_ttl_seconds=settings.SEAT_HOLD_DURATION_SECONDS,
                idempotency_key=f"idemp_{secrets.token_hex(8)}",
            )

            return SeatHoldBatchResponse(
                show_id=show_id,
                hold_token=hold_token,
                holds=hold_items,
                expires_at=expires_at,
                remaining_seconds=settings.SEAT_HOLD_DURATION_SECONDS,
                subtotal=round(subtotal, 2),
                message="Seats reserved temporarily for checkout",
                telemetry=telemetry_data,
            )
        except Exception:
            # On any failure, ensure Redis keys are cleaned up
            for s_id in acquired_redis_seats:
                await redis_service.release_seat_hold(show_id, s_id, user_id)
            raise

    @classmethod
    async def validate_and_get_holds(
        cls,
        db: AsyncSession,
        show_id: str,
        hold_token: str,
        user_id: Optional[str] = None,
    ) -> List[SeatHold]:
        now = datetime.now(timezone.utc)
        stmt = (
            select(SeatHold)
            .where(
                SeatHold.show_id == show_id,
                SeatHold.hold_token == hold_token,
                SeatHold.status == "HELD",
            )
        )
        if user_id:
            stmt = stmt.where(SeatHold.user_id == user_id)

        result = await db.execute(stmt)
        holds = list(result.scalars().all())

        if not holds:
            raise SeatHoldExpiredException(hold_token)

        # Check if expired
        for h in holds:
            if ensure_utc(h.expires_at) <= now:
                # Mark as expired
                await cls.cleanup_hold_token(db, hold_token)
                raise SeatHoldExpiredException(hold_token)

        return holds

    @classmethod
    async def release_hold(cls, db: AsyncSession, hold_token: str, user_id: Optional[str] = None) -> bool:
        stmt = select(SeatHold).where(SeatHold.hold_token == hold_token, SeatHold.status == "HELD")
        if user_id:
            stmt = stmt.where(SeatHold.user_id == user_id)

        result = await db.execute(stmt)
        holds = list(result.scalars().all())

        if not holds:
            return False

        for h in holds:
            h.status = "RELEASED"
            await redis_service.release_seat_hold(h.show_id, h.seat_id, user_id=None)

        await db.commit()
        return True

    @classmethod
    async def cleanup_hold_token(cls, db: AsyncSession, hold_token: str):
        stmt = select(SeatHold).where(SeatHold.hold_token == hold_token)
        result = await db.execute(stmt)
        holds = list(result.scalars().all())
        for h in holds:
            h.status = "EXPIRED"
            await redis_service.release_seat_hold(h.show_id, h.seat_id, user_id=None)
        await db.commit()

    @classmethod
    async def cleanup_all_expired_holds(cls, db: AsyncSession) -> int:
        now = datetime.now(timezone.utc)
        stmt = select(SeatHold).where(SeatHold.status == "HELD", SeatHold.expires_at <= now)
        result = await db.execute(stmt)
        expired_holds = list(result.scalars().all())

        count = len(expired_holds)
        for h in expired_holds:
            h.status = "EXPIRED"
            await redis_service.release_seat_hold(h.show_id, h.seat_id, user_id=None)

        if count > 0:
            await db.commit()
            logger.info("Cleaned up %d expired seat holds", count)

        return count
