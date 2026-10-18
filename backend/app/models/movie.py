from typing import Optional, List
from datetime import date
from sqlalchemy import String, Integer, Float, Date, Boolean, Text, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class Movie(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "movies"

    title: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    original_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    synopsis: Mapped[str] = mapped_column(Text, nullable=False)
    release_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    poster_url: Mapped[str] = mapped_column(String(500), nullable=False)
    backdrop_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    trailer_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    rating: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    vote_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    certification: Mapped[str] = mapped_column(String(20), default="U/A", nullable=False)
    language: Mapped[str] = mapped_column(String(50), default="Hindi", index=True, nullable=False)
    genres: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)

    # Relationships
    shows: Mapped[List["Show"]] = relationship("Show", back_populates="movie", cascade="all, delete-orphan")


# Composite index for search and filtering
Index("idx_movie_language_active", Movie.language, Movie.is_active)
