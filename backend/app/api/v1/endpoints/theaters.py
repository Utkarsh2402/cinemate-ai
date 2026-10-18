from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.theater import TheaterResponse
from app.services.theater_service import TheaterService

router = APIRouter()


@router.get("", response_model=List[TheaterResponse])
async def list_theaters(
    city: Optional[str] = Query(None, description="Filter theaters by city"),
    db: AsyncSession = Depends(get_db),
):
    theaters = await TheaterService.list_theaters(db, city=city)
    return [TheaterResponse.model_validate(t) for t in theaters]


@router.get("/{theater_id}", response_model=TheaterResponse)
async def get_theater(theater_id: str, db: AsyncSession = Depends(get_db)):
    theater = await TheaterService.get_theater_by_id(db, theater_id)
    return TheaterResponse.model_validate(theater)
