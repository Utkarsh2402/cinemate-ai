from typing import Optional, List
from datetime import datetime
from sqlalchemy import String, Float, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class BookingStatus:
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"
    PAYMENT_FAILED = "PAYMENT_FAILED"


class Booking(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "bookings"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    show_id: Mapped[str] = mapped_column(String(36), ForeignKey("shows.id", ondelete="CASCADE"), nullable=False, index=True)
    booking_code: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default=BookingStatus.PENDING, index=True, nullable=False)
    
    subtotal: Mapped[float] = mapped_column(Float, nullable=False)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    convenience_fee: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    discount_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_amount: Mapped[float] = mapped_column(Float, nullable=False)

    promotion_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True, nullable=True)
    cancellation_reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="bookings")
    show: Mapped["Show"] = relationship("Show", back_populates="bookings")
    seats: Mapped[List["BookingSeat"]] = relationship("BookingSeat", back_populates="booking", cascade="all, delete-orphan")
    payments: Mapped[List["Payment"]] = relationship("Payment", back_populates="booking", cascade="all, delete-orphan")
    ticket: Mapped[Optional["Ticket"]] = relationship("Ticket", back_populates="booking", uselist=False, cascade="all, delete-orphan")


class BookingSeat(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "booking_seats"

    booking_id: Mapped[str] = mapped_column(String(36), ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    show_id: Mapped[str] = mapped_column(String(36), ForeignKey("shows.id", ondelete="CASCADE"), nullable=False, index=True)
    seat_id: Mapped[str] = mapped_column(String(36), ForeignKey("seats.id", ondelete="CASCADE"), nullable=False, index=True)
    seat_type: Mapped[str] = mapped_column(String(50), default="STANDARD", nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="CONFIRMED", nullable=False)  # CONFIRMED, CANCELLED

    # Relationships
    booking: Mapped["Booking"] = relationship("Booking", back_populates="seats")
    seat: Mapped["Seat"] = relationship("Seat")

    __table_args__ = (
        Index("idx_booking_seat_show_seat_status", "show_id", "seat_id", "status"),
    )
