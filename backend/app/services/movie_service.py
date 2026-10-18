from typing import Optional, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, String, cast
from app.models.movie import Movie
from app.models.show import Show
from app.models.theater import Screen, Theater
from app.schemas.movie import MovieCreate, MovieUpdate
from app.redis_client import redis_service
from app.common.exceptions import ResourceNotFoundException
import logging

logger = logging.getLogger("cinemate.movie_service")


class MovieService:
    CACHE_TTL = 300  # 5 minutes

    @classmethod
    async def list_movies(
        cls,
        db: AsyncSession,
        search: Optional[str] = None,
        genre: Optional[str] = None,
        language: Optional[str] = None,
        city: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Tuple[List[Movie], int]:
        cache_key = f"movies:list:{search}:{genre}:{language}:{city}:{page}:{limit}"
        cached = await redis_service.get_json(cache_key)
        if cached:
            # We have cached result; note: if returning cached IDs, we can fetch or return cached dicts
            pass

        stmt = select(Movie).where(Movie.is_active == True)

        if search:
            search_term = f"%{search.strip()}%"
            stmt = stmt.where(or_(Movie.title.ilike(search_term), Movie.synopsis.ilike(search_term)))

        if language:
            stmt = stmt.where(Movie.language.ilike(language.strip()))

        if genre:
            stmt = stmt.where(cast(Movie.genres, String).ilike(f"%{genre.strip()}%"))

        if city:
            # Filter movies that have active shows in the given city
            subquery = (
                select(Show.movie_id)
                .join(Screen, Show.screen_id == Screen.id)
                .join(Theater, Screen.theater_id == Theater.id)
                .where(Theater.city.ilike(city.strip()), Show.is_active == True)
                .distinct()
            )
            stmt = stmt.where(Movie.id.in_(subquery))

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_res = await db.execute(count_stmt)
        total = total_res.scalar() or 0

        # Paginate & order by rating descending, then release date
        stmt = stmt.order_by(Movie.rating.desc(), Movie.release_date.desc())
        stmt = stmt.offset((page - 1) * limit).limit(limit)

        result = await db.execute(stmt)
        movies = list(result.scalars().all())

        return movies, total

    @classmethod
    async def get_movie_by_id(cls, db: AsyncSession, movie_id: str) -> Movie:
        cache_key = f"movie:detail:{movie_id}"
        cached = await redis_service.get_json(cache_key)
        if cached:
            # Let's still load from DB to get ORM object or relationships
            pass

        stmt = select(Movie).where(Movie.id == movie_id, Movie.is_active == True)
        result = await db.execute(stmt)
        movie = result.scalar_one_or_none()
        if not movie:
            raise ResourceNotFoundException("Movie", movie_id)
        return movie

    @classmethod
    async def create_movie(cls, db: AsyncSession, data: MovieCreate) -> Movie:
        movie = Movie(**data.model_dump())
        db.add(movie)
        await db.commit()
        await db.refresh(movie)

        # Invalidate movie cache
        await redis_service.delete_pattern("movies:*")
        return movie

    @classmethod
    async def update_movie(cls, db: AsyncSession, movie_id: str, data: MovieUpdate) -> Movie:
        movie = await cls.get_movie_by_id(db, movie_id)
        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(movie, key, value)

        await db.commit()
        await db.refresh(movie)

        # Invalidate movie caches
        await redis_service.delete(f"movie:detail:{movie_id}")
        await redis_service.delete_pattern("movies:*")
        return movie

    @classmethod
    async def delete_movie(cls, db: AsyncSession, movie_id: str) -> None:
        movie = await cls.get_movie_by_id(db, movie_id)
        movie.is_active = False
        await db.commit()

        await redis_service.delete(f"movie:detail:{movie_id}")
        await redis_service.delete_pattern("movies:*")
