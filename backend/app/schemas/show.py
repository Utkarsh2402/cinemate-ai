from typing import Optional, List, Dict
from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.movie import MovieResponse
from app.schemas.theater import ScreenResponse, TheaterResponse


class ShowPricingSchema(BaseModel):
    seat_type: str
    price: float

    model_config = {"from_attributes": True}


class ShowBase(BaseModel):
    movie_id: str
    screen_id: str
    start_time: datetime
    end_time: datetime
    language: str = "Hindi"
    format: str = "2D"
    status: str = "SCHEDULED"
    is_active: bool = True


class ShowCreate(ShowBase):
    pricing: List[ShowPricingSchema]


class ShowResponse(ShowBase):
    id: str
    movie: Optional[MovieResponse] = None
    screen: Optional[ScreenResponse] = None
    theater: Optional[TheaterResponse] = None
    pricing: List[ShowPricingSchema] = []

    model_config = {"from_attributes": True}


class SeatAvailabilityItem(BaseModel):
    seat_id: str
    row: str
    number: int
    column_index: int
    seat_type: str
    price: float
    status: str  # AVAILABLE, HELD, BOOKED, BLOCKED, HELD_BY_ME
    hold_expires_at: Optional[datetime] = None


class ShowSeatAvailabilityResponse(BaseModel):
    show_id: str
    movie_id: str
    movie_title: str
    theater_name: str
    screen_name: str
    screen_type: str
    start_time: datetime
    end_time: datetime
    language: str
    format: str
    rows_count: int
    cols_count: int
    pricing: Dict[str, float]
    seats: List[SeatAvailabilityItem]
    total_available: int
    total_held: int
    total_booked: int
