import hashlib
import io
import base64
import secrets
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import qrcode
from app.config import settings
from app.models.ticket import Ticket, TicketStatus
from app.models.booking import Booking, BookingSeat
from app.models.show import Show
from app.models.theater import Screen, Theater
from app.models.movie import Movie
from app.schemas.ticket import TicketResponse, TicketVerifyResponse
from app.common.exceptions import ResourceNotFoundException, AppException
import logging

logger = logging.getLogger("cinemate.ticket_service")


class TicketService:
    @staticmethod
    def generate_verification_hash(ticket_number: str, booking_id: str, show_id: str) -> str:
        payload = f"{ticket_number}:{booking_id}:{show_id}:{settings.SECRET_KEY}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @staticmethod
    def generate_qr_base64(data: str) -> str:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=2,
        )
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#0F172A", back_color="#FFFFFF")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"

    @classmethod
    async def generate_ticket_for_booking(cls, db: AsyncSession, booking: Booking) -> Ticket:
        # Check if already generated
        stmt = select(Ticket).where(Ticket.booking_id == booking.id)
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing:
            return existing

        now = datetime.now(timezone.utc)
        date_str = now.strftime("%Y%m%d")
        ticket_number = f"TKT-{date_str}-{secrets.token_hex(4).upper()}"
        verification_hash = cls.generate_verification_hash(ticket_number, booking.id, booking.show_id)

        # Secure payload embedded in QR
        qr_payload = f"cinemate://ticket?num={ticket_number}&hash={verification_hash}"

        ticket = Ticket(
            booking_id=booking.id,
            ticket_number=ticket_number,
            qr_code_data=qr_payload,
            verification_hash=verification_hash,
            status=TicketStatus.ACTIVE,
        )
        db.add(ticket)
        await db.flush()
        return ticket

    @classmethod
    async def get_ticket_by_id_or_number(cls, db: AsyncSession, identifier: str) -> Ticket:
        stmt = (
            select(Ticket)
            .where((Ticket.id == identifier) | (Ticket.ticket_number == identifier))
            .options(
                selectinload(Ticket.booking).selectinload(Booking.seats).selectinload(BookingSeat.seat),
                selectinload(Ticket.booking).selectinload(Booking.show).selectinload(Show.movie),
                selectinload(Ticket.booking).selectinload(Booking.show).selectinload(Show.screen).selectinload(Screen.theater),
            )
        )
        result = await db.execute(stmt)
        ticket = result.scalar_one_or_none()
        if not ticket:
            raise ResourceNotFoundException("Ticket", identifier)
        return ticket

    @classmethod
    async def verify_ticket(cls, db: AsyncSession, verification_hash: Optional[str], ticket_number: Optional[str]) -> TicketVerifyResponse:
        stmt = (
            select(Ticket)
            .options(
                selectinload(Ticket.booking).selectinload(Booking.seats).selectinload(BookingSeat.seat),
                selectinload(Ticket.booking).selectinload(Booking.show).selectinload(Show.movie),
                selectinload(Ticket.booking).selectinload(Booking.show).selectinload(Show.screen).selectinload(Screen.theater),
            )
        )
        if verification_hash:
            stmt = stmt.where(Ticket.verification_hash == verification_hash)
        elif ticket_number:
            stmt = stmt.where(Ticket.ticket_number == ticket_number)
        else:
            raise AppException("Must provide verification_hash or ticket_number", status_code=400)

        result = await db.execute(stmt)
        ticket = result.scalar_one_or_none()
        if not ticket:
            return TicketVerifyResponse(
                is_valid=False,
                status="NOT_FOUND",
                message="Ticket not found or fraudulent code.",
            )

        booking = ticket.booking
        seats_desc = [f"{s.seat.row}{s.seat.number}" for s in booking.seats if s.seat]

        if ticket.status == TicketStatus.CANCELLED:
            return TicketVerifyResponse(
                is_valid=False,
                status="CANCELLED",
                message="This booking was cancelled and refunded.",
                ticket_number=ticket.ticket_number,
                booking_code=booking.booking_code,
            )

        if ticket.status == TicketStatus.USED:
            return TicketVerifyResponse(
                is_valid=False,
                status="ALREADY_USED",
                message="This ticket has already been validated at the gate.",
                ticket_number=ticket.ticket_number,
                booking_code=booking.booking_code,
            )

        # Mark ticket as used if currently active
        ticket.status = TicketStatus.USED
        await db.commit()

        return TicketVerifyResponse(
            is_valid=True,
            status="VALID",
            message="Ticket verified successfully! Admitted.",
            ticket_number=ticket.ticket_number,
            booking_code=booking.booking_code,
            movie_title=booking.show.movie.title if booking.show and booking.show.movie else "Movie",
            theater_name=booking.show.screen.theater.name if booking.show and booking.show.screen and booking.show.screen.theater else "Theater",
            start_time=booking.show.start_time if booking.show else None,
            seats=seats_desc,
        )

    @classmethod
    def to_ticket_response(cls, ticket: Ticket) -> TicketResponse:
        booking = ticket.booking
        seats = [f"{s.seat.row}{s.seat.number}" for s in booking.seats if s.seat]
        qr_img = cls.generate_qr_base64(ticket.qr_code_data)

        return TicketResponse(
            id=ticket.id,
            booking_id=ticket.booking_id,
            booking_code=booking.booking_code,
            ticket_number=ticket.ticket_number,
            qr_code_data=ticket.qr_code_data,
            qr_code_image_base64=qr_img,
            verification_hash=ticket.verification_hash,
            status=ticket.status,
            movie_title=booking.show.movie.title if booking.show and booking.show.movie else "Movie",
            theater_name=booking.show.screen.theater.name if booking.show and booking.show.screen and booking.show.screen.theater else "Cinema",
            screen_name=booking.show.screen.name if booking.show and booking.show.screen else "Screen",
            start_time=booking.show.start_time,
            seats=seats,
            total_amount=booking.total_amount,
            created_at=ticket.created_at,
        )
