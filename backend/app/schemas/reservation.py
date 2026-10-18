from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class SeatHoldCreate(BaseModel):
    show_id: str
    seat_ids: List[str] = Field(..., min_length=1, max_length=10)


class SeatHoldItem(BaseModel):
    hold_id: str
    seat_id: str
    row: str
    number: int
    seat_type: str
    price: float
    expires_at: datetime


class SeatHoldBatchResponse(BaseModel):
    show_id: str
    hold_token: str
    holds: List[SeatHoldItem]
    expires_at: datetime
    remaining_seconds: int
    subtotal: float
    message: str = "Seats held successfully"


class SeatHoldReleaseRequest(BaseModel):
    hold_token: str
