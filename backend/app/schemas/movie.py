from typing import Optional, List
from datetime import date
from pydantic import BaseModel, Field


class MovieBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    original_title: Optional[str] = None
    synopsis: str
    release_date: date
    duration_minutes: int = Field(..., gt=0)
    poster_url: str
    backdrop_url: Optional[str] = None
    trailer_url: Optional[str] = None
    rating: float = Field(default=0.0, ge=0.0, le=10.0)
    vote_count: int = Field(default=0, ge=0)
    certification: str = "U/A"
    language: str = "Hindi"
    genres: List[str] = []
    is_active: bool = True


class MovieCreate(MovieBase):
    pass


class MovieUpdate(BaseModel):
    title: Optional[str] = None
    original_title: Optional[str] = None
    synopsis: Optional[str] = None
    release_date: Optional[date] = None
    duration_minutes: Optional[int] = None
    poster_url: Optional[str] = None
    backdrop_url: Optional[str] = None
    trailer_url: Optional[str] = None
    rating: Optional[float] = None
    certification: Optional[str] = None
    language: Optional[str] = None
    genres: Optional[List[str]] = None
    is_active: Optional[bool] = None


class MovieResponse(MovieBase):
    id: str

    model_config = {"from_attributes": True}


class MovieListResponse(BaseModel):
    items: List[MovieResponse]
    total: int
    page: int
    limit: int
    pages: int
