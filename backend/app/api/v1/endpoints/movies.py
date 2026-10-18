from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.movie import MovieResponse, MovieListResponse
from app.services.movie_service import MovieService

router = APIRouter()


@router.get("", response_model=MovieListResponse)
async def list_movies(
    search: Optional[str] = Query(None, description="Search by title or synopsis"),
    genre: Optional[str] = Query(None, description="Filter by genre"),
    language: Optional[str] = Query(None, description="Filter by language"),
    city: Optional[str] = Query(None, description="Filter movies playing in city"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    movies, total = await MovieService.list_movies(
        db, search=search, genre=genre, language=language, city=city, page=page, limit=limit
    )
    pages = (total + limit - 1) // limit if total > 0 else 1
    return MovieListResponse(
        items=[MovieResponse.model_validate(m) for m in movies],
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.get("/{movie_id}", response_model=MovieResponse)
async def get_movie(movie_id: str, db: AsyncSession = Depends(get_db)):
    movie = await MovieService.get_movie_by_id(db, movie_id)
    return MovieResponse.model_validate(movie)
