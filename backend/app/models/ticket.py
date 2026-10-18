from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class TicketStatus:
    ACTIVE = "ACTIVE"
    USED = "USED"
    CANCELLED = "CANCELLED"


class Ticket(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "tickets"

    booking_id: Mapped[str] = mapped_column(String(36), ForeignKey("bookings.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    ticket_number: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    qr_code_data: Mapped[str] = mapped_column(String(500), nullable=False)  # Encoded verification payload
    verification_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA256 checksum for gate validation
    status: Mapped[str] = mapped_column(String(30), default=TicketStatus.ACTIVE, nullable=False)

    # Relationships
    booking: Mapped["Booking"] = relationship("Booking", back_populates="ticket")
