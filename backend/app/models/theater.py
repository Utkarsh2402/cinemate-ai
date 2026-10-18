from typing import Optional, List
from sqlalchemy import String, Integer, Float, Boolean, JSON, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class Theater(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "theaters"

    name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    chain: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # PVR, INOX, Cinepolis
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    city: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    state: Mapped[str] = mapped_column(String(100), default="Delhi", nullable=False)
    postal_code: Mapped[str] = mapped_column(String(20), nullable=False)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    amenities: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)

    # Relationships
    screens: Mapped[List["Screen"]] = relationship("Screen", back_populates="theater", cascade="all, delete-orphan")


class Screen(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "screens"

    theater_id: Mapped[str] = mapped_column(String(36), ForeignKey("theaters.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)  # Screen 1, Screen 2 (IMAX)
    screen_type: Mapped[str] = mapped_column(String(50), default="2D", nullable=False)  # 2D, 3D, IMAX, 4DX
    total_seats: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rows_count: Mapped[int] = mapped_column(Integer, default=8, nullable=False)
    cols_count: Mapped[int] = mapped_column(Integer, default=12, nullable=False)

    # Relationships
    theater: Mapped["Theater"] = relationship("Theater", back_populates="screens")
    seats: Mapped[List["Seat"]] = relationship("Seat", back_populates="screen", cascade="all, delete-orphan")
    shows: Mapped[List["Show"]] = relationship("Show", back_populates="screen", cascade="all, delete-orphan")


class Seat(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "seats"

    screen_id: Mapped[str] = mapped_column(String(36), ForeignKey("screens.id", ondelete="CASCADE"), nullable=False, index=True)
    row: Mapped[str] = mapped_column(String(5), nullable=False)  # 'A', 'B', 'C'
    number: Mapped[int] = mapped_column(Integer, nullable=False)  # 1, 2, 3
    seat_type: Mapped[str] = mapped_column(String(50), default="STANDARD", nullable=False)  # STANDARD, PREMIUM, VIP, RECLINER
    column_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    screen: Mapped["Screen"] = relationship("Screen", back_populates="seats")

    __table_args__ = (
        UniqueConstraint("screen_id", "row", "number", name="uq_screen_row_number"),
        Index("idx_seat_screen_type", "screen_id", "seat_type"),
    )
