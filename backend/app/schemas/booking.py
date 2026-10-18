from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class BookingCreate(BaseModel):
    show_id: str
    hold_token: str
    promotion_code: Optional[str] = None


class BookingSeatResponse(BaseModel):
    id: str
    seat_id: str
    row: str
    number: int
    seat_type: str
    price: float

    model_config = {"from_attributes": True}


class BookingResponse(BaseModel):
    id: str
    booking_code: str
    status: str
    show_id: str
    subtotal: float
    tax_amount: float
    convenience_fee: float
    discount_amount: float
    total_amount: float
    promotion_code: Optional[str] = None
    created_at: datetime
    cancelled_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BookingDetailResponse(BookingResponse):
    movie_title: str
    poster_url: str
    theater_name: str
    theater_address: str
    screen_name: str
    screen_type: str
    start_time: datetime
    end_time: datetime
    language: str
    format: str
    seats: List[BookingSeatResponse]
    ticket_number: Optional[str] = None
    qr_code_data: Optional[str] = None
    payment_status: Optional[str] = None
    is_cancellable: bool = False


class BookingCancelRequest(BaseModel):
    reason: Optional[str] = "Customer requested cancellation"


class BookingCancelResponse(BaseModel):
    booking_id: str
    status: str
    refund_amount: float
    message: str
