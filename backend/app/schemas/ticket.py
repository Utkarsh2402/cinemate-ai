from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel


class TicketResponse(BaseModel):
    id: str
    booking_id: str
    booking_code: str
    ticket_number: str
    qr_code_data: str
    qr_code_image_base64: Optional[str] = None
    verification_hash: str
    status: str
    movie_title: str
    theater_name: str
    screen_name: str
    start_time: datetime
    seats: List[str]
    total_amount: float
    created_at: datetime

    model_config = {"from_attributes": True}


class TicketVerifyRequest(BaseModel):
    verification_hash: Optional[str] = None
    ticket_number: Optional[str] = None


class TicketVerifyResponse(BaseModel):
    is_valid: bool
    status: str
    message: str
    ticket_number: Optional[str] = None
    booking_code: Optional[str] = None
    movie_title: Optional[str] = None
    theater_name: Optional[str] = None
    start_time: Optional[datetime] = None
    seats: Optional[List[str]] = None
