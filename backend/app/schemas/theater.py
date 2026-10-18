from typing import Optional, List
from pydantic import BaseModel, Field


class SeatResponse(BaseModel):
    id: str
    row: str
    number: int
    seat_type: str
    column_index: int
    is_active: bool

    model_config = {"from_attributes": True}


class ScreenBase(BaseModel):
    name: str
    screen_type: str = "2D"
    rows_count: int = 8
    cols_count: int = 12


class ScreenCreate(ScreenBase):
    pass


class ScreenResponse(ScreenBase):
    id: str
    theater_id: str
    total_seats: int

    model_config = {"from_attributes": True}


class TheaterBase(BaseModel):
    name: str = Field(..., min_length=2)
    chain: Optional[str] = None
    address: str
    city: str
    state: str = "Delhi"
    postal_code: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    amenities: List[str] = []
    is_active: bool = True


class TheaterCreate(TheaterBase):
    pass


class TheaterResponse(TheaterBase):
    id: str
    screens: Optional[List[ScreenResponse]] = None

    model_config = {"from_attributes": True}
