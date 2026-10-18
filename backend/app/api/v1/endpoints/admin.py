from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.admin import AnalyticsOverviewResponse
from app.schemas.movie import MovieCreate, MovieUpdate, MovieResponse
from app.schemas.theater import TheaterCreate, TheaterResponse, ScreenCreate, ScreenResponse
from app.schemas.show import ShowCreate, ShowResponse
from app.services.admin_service import AdminService
from app.services.movie_service import MovieService
from app.services.theater_service import TheaterService
from app.services.show_service import ShowService
from app.dependencies import get_current_admin
from app.models.user import User

router = APIRouter()


@router.get("/analytics", response_model=AnalyticsOverviewResponse)
async def get_analytics(
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await AdminService.get_analytics_overview(db)


@router.post("/movies", response_model=MovieResponse, status_code=status.HTTP_201_CREATED)
async def create_movie(
    data: MovieCreate,
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    movie = await MovieService.create_movie(db, data)
    return MovieResponse.model_validate(movie)


@router.put("/movies/{movie_id}", response_model=MovieResponse)
async def update_movie(
    movie_id: str,
    data: MovieUpdate,
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    movie = await MovieService.update_movie(db, movie_id, data)
    return MovieResponse.model_validate(movie)


@router.delete("/movies/{movie_id}")
async def delete_movie(
    movie_id: str,
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    await MovieService.delete_movie(db, movie_id)
    return {"message": "Movie deleted successfully"}


@router.post("/theaters", response_model=TheaterResponse, status_code=status.HTTP_201_CREATED)
async def create_theater(
    data: TheaterCreate,
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    theater = await TheaterService.create_theater(db, data)
    return TheaterResponse.model_validate(theater)


@router.post("/theaters/{theater_id}/screens", response_model=ScreenResponse, status_code=status.HTTP_201_CREATED)
async def create_screen(
    theater_id: str,
    data: ScreenCreate,
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    screen = await TheaterService.create_screen_with_seats(db, theater_id, data)
    return ScreenResponse.model_validate(screen)


@router.post("/shows", response_model=ShowResponse, status_code=status.HTTP_201_CREATED)
async def create_show(
    data: ShowCreate,
    current_admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    show = await ShowService.create_show(db, data)
    return ShowResponse.model_validate(show)
