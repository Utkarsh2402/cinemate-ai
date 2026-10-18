from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class SeatHold(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "seat_holds"

    show_id: Mapped[str] = mapped_column(String(36), ForeignKey("shows.id", ondelete="CASCADE"), nullable=False, index=True)
    seat_id: Mapped[str] = mapped_column(String(36), ForeignKey("seats.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    hold_token: Mapped[str] = mapped_column(String(64), nullable=False, index=True)  # Client verification token
    status: Mapped[str] = mapped_column(String(30), default="HELD", nullable=False)  # HELD, RELEASED, EXPIRED, CONVERTED
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    # Relationships
    show: Mapped["Show"] = relationship("Show", back_populates="seat_holds")
    seat: Mapped["Seat"] = relationship("Seat")
    user: Mapped["User"] = relationship("User", back_populates="seat_holds")

    __table_args__ = (
        Index("idx_hold_show_seat_active", "show_id", "seat_id", "status", "expires_at"),
    )
