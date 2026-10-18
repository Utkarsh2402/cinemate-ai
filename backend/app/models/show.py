from typing import List
from datetime import datetime
from sqlalchemy import String, Float, Boolean, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class Show(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "shows"

    movie_id: Mapped[str] = mapped_column(String(36), ForeignKey("movies.id", ondelete="CASCADE"), nullable=False, index=True)
    screen_id: Mapped[str] = mapped_column(String(36), ForeignKey("screens.id", ondelete="CASCADE"), nullable=False, index=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    language: Mapped[str] = mapped_column(String(50), default="Hindi", nullable=False)
    format: Mapped[str] = mapped_column(String(20), default="2D", nullable=False)  # 2D, 3D, IMAX 2D, 4DX
    status: Mapped[str] = mapped_column(String(30), default="SCHEDULED", nullable=False)  # SCHEDULED, CANCELLED, COMPLETED
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)

    # Relationships
    movie: Mapped["Movie"] = relationship("Movie", back_populates="shows")
    screen: Mapped["Screen"] = relationship("Screen", back_populates="shows")
    pricing: Mapped[List["ShowPricing"]] = relationship("ShowPricing", back_populates="show", cascade="all, delete-orphan")
    seat_holds: Mapped[List["SeatHold"]] = relationship("SeatHold", back_populates="show", cascade="all, delete-orphan")
    bookings: Mapped[List["Booking"]] = relationship("Booking", back_populates="show")

    __table_args__ = (
        Index("idx_show_movie_time", "movie_id", "start_time"),
        Index("idx_show_screen_time", "screen_id", "start_time"),
    )


class ShowPricing(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "show_pricing"

    show_id: Mapped[str] = mapped_column(String(36), ForeignKey("shows.id", ondelete="CASCADE"), nullable=False, index=True)
    seat_type: Mapped[str] = mapped_column(String(50), nullable=False)  # STANDARD, PREMIUM, VIP, RECLINER
    price: Mapped[float] = mapped_column(Float, nullable=False)

    # Relationships
    show: Mapped["Show"] = relationship("Show", back_populates="pricing")

    __table_args__ = (
        UniqueConstraint("show_id", "seat_type", name="uq_show_seat_type_pricing"),
    )
