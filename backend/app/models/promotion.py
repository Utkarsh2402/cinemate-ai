from typing import Optional
from datetime import datetime
from sqlalchemy import String, Float, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class Promotion(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "promotions"

    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    discount_type: Mapped[str] = mapped_column(String(20), default="PERCENTAGE", nullable=False)  # PERCENTAGE, FLAT
    discount_value: Mapped[float] = mapped_column(Float, nullable=False)
    max_discount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    min_spend: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    valid_to: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
