from typing import List, Dict, Any
from datetime import datetime
from pydantic import BaseModel


class ShowOccupancyItem(BaseModel):
    show_id: str
    movie_title: str
    theater_name: str
    screen_name: str
    start_time: datetime
    total_seats: int
    booked_seats: int
    held_seats: int
    occupancy_rate: float
    total_revenue: float


class AnalyticsOverviewResponse(BaseModel):
    total_revenue: float
    total_bookings: int
    confirmed_bookings: int
    cancelled_bookings: int
    total_movies: int
    total_theaters: int
    total_shows: int
    average_occupancy_rate: float
    recent_occupancies: List[ShowOccupancyItem]
    revenue_by_genre: Dict[str, float]
