import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from app.config import settings
from app.models.base import ensure_utc
from app.models.booking import Booking, BookingSeat, BookingStatus
from app.models.reservation import SeatHold
from app.models.show import Show, ShowPricing
from app.models.theater import Seat, Screen, Theater
from app.models.movie import Movie
from app.models.promotion import Promotion
from app.models.ticket import Ticket, TicketStatus
from app.models.payment import Payment, PaymentStatus
from app.models.outbox import OutboxEvent
from app.schemas.booking import BookingCreate, BookingDetailResponse, BookingSeatResponse
from app.services.reservation_service import ReservationService
from app.redis_client import redis_service
from app.common.exceptions import (
    AppException,
    ResourceNotFoundException,
    InvalidStateTransitionException,
    CancellationNotAllowedException,
    ForbiddenException,
)
import logging

logger = logging.getLogger("cinemate.booking_service")


class BookingService:
    @staticmethod
    def generate_booking_code() -> str:
        return f"CNM-{secrets.token_hex(4).upper()}"

    @classmethod
    async def create_booking_from_hold(
        cls,
        db: AsyncSession,
        data: BookingCreate,
        user_id: str,
        idempotency_key: Optional[str] = None,
    ) -> Booking:
        # Check idempotency key if provided
        if idempotency_key:
            stmt = select(Booking).where(Booking.idempotency_key == idempotency_key)
            existing = (await db.execute(stmt)).scalar_one_or_none()
            if existing:
                logger.info("Idempotent booking hit for key %s", idempotency_key)
                return existing

        # 1. Validate seat holds
        holds = await ReservationService.validate_and_get_holds(
            db,
            show_id=data.show_id,
            hold_token=data.hold_token,
            user_id=user_id,
        )

        show_stmt = (
            select(Show)
            .where(Show.id == data.show_id)
            .options(selectinload(Show.pricing), selectinload(Show.screen))
        )
        show = (await db.execute(show_stmt)).scalar_one_or_none()
        if not show:
            raise ResourceNotFoundException("Show", data.show_id)

        pricing_map = {p.seat_type.upper(): p.price for p in show.pricing}

        # 2. Fetch seats & calculate subtotal
        seat_ids = [h.seat_id for h in holds]
        seats_stmt = select(Seat).where(Seat.id.in_(seat_ids))
        seats = list((await db.execute(seats_stmt)).scalars().all())

        subtotal = 0.0
        booking_seats_data = []
        for s in seats:
            stype = s.seat_type.upper()
            price = pricing_map.get(stype, 250.0)
            subtotal += price
            booking_seats_data.append((s.id, stype, price))

        # 3. Fees and Taxes
        # Convenience fee: flat ₹30 + ₹10 per ticket
        convenience_fee = 30.0 + (10.0 * len(seats))
        # 18% GST on convenience fee
        tax_amount = round(convenience_fee * 0.18, 2)

        # 4. Promotions
        discount_amount = 0.0
        applied_promo_code = None
        if data.promotion_code:
            now = datetime.now(timezone.utc)
            promo_stmt = select(Promotion).where(
                Promotion.code == data.promotion_code.upper().strip(),
                Promotion.is_active == True,
                Promotion.valid_from <= now,
                Promotion.valid_to >= now,
            )
            promo = (await db.execute(promo_stmt)).scalar_one_or_none()
            if promo and subtotal >= promo.min_spend:
                applied_promo_code = promo.code
                if promo.discount_type == "PERCENTAGE":
                    calculated_disc = (subtotal * promo.discount_value) / 100.0
                    discount_amount = min(calculated_disc, promo.max_discount) if promo.max_discount else calculated_disc
                else:
                    discount_amount = promo.discount_value
                discount_amount = min(discount_amount, subtotal)

        total_amount = round(subtotal + convenience_fee + tax_amount - discount_amount, 2)

        # 5. Create Booking record in PENDING state
        booking = Booking(
            user_id=user_id,
            show_id=data.show_id,
            booking_code=cls.generate_booking_code(),
            status=BookingStatus.PENDING,
            subtotal=round(subtotal, 2),
            convenience_fee=round(convenience_fee, 2),
            tax_amount=tax_amount,
            discount_amount=round(discount_amount, 2),
            total_amount=total_amount,
            promotion_code=applied_promo_code,
            idempotency_key=idempotency_key,
        )
        db.add(booking)
        await db.flush()

        # Add BookingSeats
        for s_id, stype, price in booking_seats_data:
            b_seat = BookingSeat(
                booking_id=booking.id,
                show_id=data.show_id,
                seat_id=s_id,
                seat_type=stype,
                price=price,
                status="CONFIRMED",
            )
            db.add(b_seat)

        # Update holds to CONVERTED
        for h in holds:
            h.status = "CONVERTED"

        await db.commit()
        await db.refresh(booking)
        logger.info("Created PENDING booking %s for user %s", booking.booking_code, user_id)
        return booking

    @classmethod
    async def get_booking_by_id(cls, db: AsyncSession, booking_id: str, user_id: Optional[str] = None) -> Booking:
        stmt = (
            select(Booking)
            .where(Booking.id == booking_id)
            .options(
                selectinload(Booking.seats).selectinload(BookingSeat.seat),
                selectinload(Booking.show).selectinload(Show.movie),
                selectinload(Booking.show).selectinload(Show.screen).selectinload(Screen.theater),
                selectinload(Booking.ticket),
                selectinload(Booking.payments),
            )
        )
        result = await db.execute(stmt)
        booking = result.scalar_one_or_none()
        if not booking:
            raise ResourceNotFoundException("Booking", booking_id)

        if user_id and booking.user_id != user_id:
            raise ForbiddenException("You cannot view this booking")

        return booking

    @classmethod
    async def list_user_bookings(cls, db: AsyncSession, user_id: str) -> List[Booking]:
        stmt = (
            select(Booking)
            .where(Booking.user_id == user_id)
            .options(
                selectinload(Booking.seats).selectinload(BookingSeat.seat),
                selectinload(Booking.show).selectinload(Show.movie),
                selectinload(Booking.show).selectinload(Show.screen).selectinload(Screen.theater),
                selectinload(Booking.ticket),
                selectinload(Booking.payments),
            )
            .order_by(Booking.created_at.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def confirm_booking(cls, db: AsyncSession, booking_id: str, payment_id: str) -> Booking:
        """
        Transition: PENDING -> CONFIRMED
        Creates digital ticket, releases temporary Redis holds, emits outbox event.
        """
        booking = await cls.get_booking_by_id(db, booking_id)

        if booking.status == BookingStatus.CONFIRMED:
            return booking

        if booking.status != BookingStatus.PENDING:
            raise InvalidStateTransitionException("Booking", booking.status, BookingStatus.CONFIRMED)

        booking.status = BookingStatus.CONFIRMED

        # Import here to avoid circular dependencies
        from app.services.ticket_service import TicketService
        ticket = await TicketService.generate_ticket_for_booking(db, booking)

        # Release Redis hold keys since booking is now permanently confirmed in DB
        for b_seat in booking.seats:
            await redis_service.release_seat_hold(booking.show_id, b_seat.seat_id)

        # Write to Outbox table
        outbox = OutboxEvent(
            aggregate_type="BOOKING",
            aggregate_id=booking.id,
            event_type="BOOKING_CONFIRMED",
            payload={
                "booking_id": booking.id,
                "booking_code": booking.booking_code,
                "user_id": booking.user_id,
                "total_amount": booking.total_amount,
                "ticket_number": ticket.ticket_number,
                "payment_id": payment_id,
            },
        )
        db.add(outbox)

        await db.commit()
        await db.refresh(booking)
        logger.info("Confirmed booking %s (Code: %s)", booking.id, booking.booking_code)
        return booking

    @classmethod
    async def cancel_booking(cls, db: AsyncSession, booking_id: str, user_id: str, reason: str = "Customer requested cancellation") -> Tuple[Booking, float]:
        """
        Transition: CONFIRMED -> CANCELLED
        Verifies cancellation window (e.g. 2 hours before showtime), marks seats cancelled,
        triggers refund, updates ticket status, writes outbox event.
        """
        booking = await cls.get_booking_by_id(db, booking_id, user_id=user_id)

        if booking.status != BookingStatus.CONFIRMED:
            raise InvalidStateTransitionException("Booking", booking.status, BookingStatus.CANCELLED)

        now = datetime.now(timezone.utc)
        cancellation_deadline = ensure_utc(booking.show.start_time) - timedelta(hours=settings.CANCELLATION_WINDOW_HOURS)
        if now >= cancellation_deadline:
            raise CancellationNotAllowedException(
                f"Bookings can only be cancelled up to {settings.CANCELLATION_WINDOW_HOURS} hours before showtime."
            )

        booking.status = BookingStatus.CANCELLED
        booking.cancellation_reason = reason
        booking.cancelled_at = now

        # Update seat statuses
        for b_seat in booking.seats:
            b_seat.status = "CANCELLED"

        # Cancel ticket
        if booking.ticket:
            booking.ticket.status = TicketStatus.CANCELLED

        # Calculate refund (e.g. 100% of ticket amount minus convenience fee or full total)
        refund_amount = round(booking.total_amount, 2)

        # Outbox event
        outbox = OutboxEvent(
            aggregate_type="BOOKING",
            aggregate_id=booking.id,
            event_type="BOOKING_CANCELLED",
            payload={
                "booking_id": booking.id,
                "booking_code": booking.booking_code,
                "user_id": booking.user_id,
                "refund_amount": refund_amount,
                "reason": reason,
            },
        )
        db.add(outbox)

        await db.commit()
        await db.refresh(booking)
        logger.info("Cancelled booking %s, refund due: ₹%.2f", booking.booking_code, refund_amount)
        return booking, refund_amount

    @classmethod
    def to_detail_response(cls, booking: Booking) -> BookingDetailResponse:
        now = datetime.now(timezone.utc)
        cancellation_deadline = ensure_utc(booking.show.start_time) - timedelta(hours=settings.CANCELLATION_WINDOW_HOURS)
        is_cancellable = booking.status == BookingStatus.CONFIRMED and now < cancellation_deadline

        seats_resp = [
            BookingSeatResponse(
                id=s.id,
                seat_id=s.seat_id,
                row=s.seat.row if s.seat else "",
                number=s.seat.number if s.seat else 0,
                seat_type=s.seat_type,
                price=s.price,
            )
            for s in booking.seats
        ]

        payment_status = booking.payments[0].status if booking.payments else None

        return BookingDetailResponse(
            id=booking.id,
            booking_code=booking.booking_code,
            status=booking.status,
            show_id=booking.show_id,
            subtotal=booking.subtotal,
            tax_amount=booking.tax_amount,
            convenience_fee=booking.convenience_fee,
            discount_amount=booking.discount_amount,
            total_amount=booking.total_amount,
            promotion_code=booking.promotion_code,
            created_at=booking.created_at,
            cancelled_at=booking.cancelled_at,
            movie_title=booking.show.movie.title if booking.show and booking.show.movie else "Movie",
            poster_url=booking.show.movie.poster_url if booking.show and booking.show.movie else "",
            theater_name=booking.show.screen.theater.name if booking.show and booking.show.screen and booking.show.screen.theater else "Cinema",
            theater_address=booking.show.screen.theater.address if booking.show and booking.show.screen and booking.show.screen.theater else "",
            screen_name=booking.show.screen.name if booking.show and booking.show.screen else "Screen",
            screen_type=booking.show.screen.screen_type if booking.show and booking.show.screen else "2D",
            start_time=booking.show.start_time,
            end_time=booking.show.end_time,
            language=booking.show.language,
            format=booking.show.format,
            seats=seats_resp,
            ticket_number=booking.ticket.ticket_number if booking.ticket else None,
            qr_code_data=booking.ticket.qr_code_data if booking.ticket else None,
            payment_status=payment_status,
            is_cancellable=is_cancellable,
        )
