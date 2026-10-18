from typing import Optional, List
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.show import ShowResponse, ShowSeatAvailabilityResponse
from app.services.show_service import ShowService
from app.dependencies import get_optional_current_user
from app.models.user import User

router = APIRouter()


@router.get("", response_model=List[ShowResponse])
async def list_shows(
    movie_id: Optional[str] = Query(None),
    theater_id: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    target_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    shows = await ShowService.list_shows(
        db, movie_id=movie_id, theater_id=theater_id, city=city, target_date=target_date
    )
    return [ShowResponse.model_validate(s) for s in shows]


@router.get("/{show_id}", response_model=ShowResponse)
async def get_show(show_id: str, db: AsyncSession = Depends(get_db)):
    show = await ShowService.get_show_by_id(db, show_id)
    return ShowResponse.model_validate(show)


@router.get("/{show_id}/seats", response_model=ShowSeatAvailabilityResponse)
async def get_show_seats(
    show_id: str,
    hold_token: Optional[str] = Query(None, description="Optional hold token to identify user holds"),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.id if current_user else None
    return await ShowService.get_show_seat_availability(
        db, show_id=show_id, current_user_id=user_id, hold_token=hold_token
    )
