from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.theater import Theater, Screen, Seat
from app.schemas.theater import TheaterCreate, ScreenCreate
from app.common.exceptions import ResourceNotFoundException


class TheaterService:
    @classmethod
    async def list_theaters(cls, db: AsyncSession, city: Optional[str] = None) -> List[Theater]:
        stmt = select(Theater).where(Theater.is_active == True).options(selectinload(Theater.screens))
        if city:
            stmt = stmt.where(Theater.city.ilike(city.strip()))
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    async def get_theater_by_id(cls, db: AsyncSession, theater_id: str) -> Theater:
        stmt = (
            select(Theater)
            .where(Theater.id == theater_id, Theater.is_active == True)
            .options(selectinload(Theater.screens).selectinload(Screen.seats))
        )
        result = await db.execute(stmt)
        theater = result.scalar_one_or_none()
        if not theater:
            raise ResourceNotFoundException("Theater", theater_id)
        return theater

    @classmethod
    async def create_theater(cls, db: AsyncSession, data: TheaterCreate) -> Theater:
        theater = Theater(**data.model_dump())
        db.add(theater)
        await db.commit()
        await db.refresh(theater)
        return theater

    @classmethod
    async def create_screen_with_seats(
        cls,
        db: AsyncSession,
        theater_id: str,
        screen_data: ScreenCreate,
    ) -> Screen:
        theater = await cls.get_theater_by_id(db, theater_id)
        total_seats = screen_data.rows_count * screen_data.cols_count
        screen = Screen(
            theater_id=theater.id,
            name=screen_data.name,
            screen_type=screen_data.screen_type,
            rows_count=screen_data.rows_count,
            cols_count=screen_data.cols_count,
            total_seats=total_seats,
        )
        db.add(screen)
        await db.flush()

        # Generate seats: rows 'A', 'B', etc.
        # Top rows (A, B) -> STANDARD
        # Middle rows (C, D, E) -> PREMIUM
        # Back rows (F, G) -> VIP
        # Last row (H) -> RECLINER
        row_letters = [chr(65 + i) for i in range(screen_data.rows_count)]
        seats = []
        for r_idx, r_letter in enumerate(row_letters):
            if r_idx < 2:
                seat_type = "STANDARD"
            elif r_idx < screen_data.rows_count - 3:
                seat_type = "PREMIUM"
            elif r_idx < screen_data.rows_count - 1:
                seat_type = "VIP"
            else:
                seat_type = "RECLINER"

            for c in range(1, screen_data.cols_count + 1):
                seat = Seat(
                    screen_id=screen.id,
                    row=r_letter,
                    number=c,
                    seat_type=seat_type,
                    column_index=c,
                    is_active=True,
                )
                seats.append(seat)

        db.add_all(seats)
        await db.commit()
        await db.refresh(screen)
        return screen
