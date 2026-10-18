from typing import Optional, List
from sqlalchemy import String, Float, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class PaymentStatus:
    PENDING = "PENDING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class RefundStatus:
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class Payment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "payments"

    booking_id: Mapped[str] = mapped_column(String(36), ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default=PaymentStatus.PENDING, index=True, nullable=False)
    provider: Mapped[str] = mapped_column(String(50), default="SANDBOX", nullable=False)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True, nullable=True)
    transaction_id: Mapped[Optional[str]] = mapped_column(String(100), unique=True, index=True, nullable=True)
    payment_method: Mapped[str] = mapped_column(String(50), default="CARD", nullable=False)  # CARD, UPI, NET_BANKING
    error_message: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Relationships
    booking: Mapped["Booking"] = relationship("Booking", back_populates="payments")
    refunds: Mapped[List["Refund"]] = relationship("Refund", back_populates="payment", cascade="all, delete-orphan")


class Refund(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "refunds"

    payment_id: Mapped[str] = mapped_column(String(36), ForeignKey("payments.id", ondelete="CASCADE"), nullable=False, index=True)
    booking_id: Mapped[str] = mapped_column(String(36), ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default=RefundStatus.PENDING, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    transaction_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    payment: Mapped["Payment"] = relationship("Payment", back_populates="refunds")
