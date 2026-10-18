import asyncio
from datetime import datetime, date, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.models.movie import Movie
from app.models.theater import Theater, Screen, Seat
from app.models.show import Show, ShowPricing
from app.models.promotion import Promotion
from app.common.security import get_password_hash
import logging

logger = logging.getLogger("cinemate.seed")


async def seed_database(db: AsyncSession):
    # Check if already seeded
    existing_user = (await db.execute(select(User).limit(1))).scalar_one_or_none()
    if existing_user:
        return

    logger.info("Seeding realistic demo cinema inventory into database...")

    # 1. Users
    admin_user = User(
        email="admin@cinemate.ai",
        hashed_password=get_password_hash("Admin@123456"),
        full_name="CineMate System Admin",
        phone="+919876543210",
        role="admin",
        is_active=True,
    )
    customer_user = User(
        email="customer@cinemate.ai",
        hashed_password=get_password_hash("Customer@123456"),
        full_name="Rahul Sharma",
        phone="+919811122233",
        role="customer",
        is_active=True,
        preferences={
            "favorite_genres": ["Action", "Sci-Fi", "Comedy"],
            "preferred_languages": ["Hindi", "English"],
            "preferred_city": "Delhi",
        },
    )
    db.add_all([admin_user, customer_user])
    await db.flush()

    # 2. Movies
    movies_data = [
        {
            "title": "Dune: Part Two",
            "original_title": "Dune: Part Two",
            "synopsis": "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.",
            "release_date": date.today() - timedelta(days=20),
            "duration_minutes": 166,
            "poster_url": "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80",
            "rating": 8.8,
            "vote_count": 4200,
            "certification": "U/A",
            "language": "English",
            "genres": ["Sci-Fi", "Adventure", "Action"],
        },
        {
            "title": "Stree 2",
            "original_title": "Stree 2: Sarkate Ka Aatank",
            "synopsis": "The town of Chanderi is being haunted again, this time by a headless entity named Sarkate who is abducting women.",
            "release_date": date.today() - timedelta(days=10),
            "duration_minutes": 147,
            "poster_url": "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80",
            "rating": 8.1,
            "vote_count": 8900,
            "certification": "U/A",
            "language": "Hindi",
            "genres": ["Comedy", "Horror"],
        },
        {
            "title": "Kalki 2898 AD",
            "original_title": "Kalki 2898 AD",
            "synopsis": "A modern avatar of Vishnu, a Hindu god, is believed to have descended to Earth to protect the world from evil forces in a dystopian future.",
            "release_date": date.today() - timedelta(days=35),
            "duration_minutes": 181,
            "poster_url": "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80",
            "rating": 7.9,
            "vote_count": 6700,
            "certification": "U/A",
            "language": "Hindi",
            "genres": ["Sci-Fi", "Action", "Mythology"],
        },
        {
            "title": "Jawan: Extended",
            "original_title": "Jawan",
            "synopsis": "A high-octane action thriller which outlines the emotional journey of a man who is set out to rectify the wrongs in the society.",
            "release_date": date.today() - timedelta(days=50),
            "duration_minutes": 169,
            "poster_url": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80",
            "rating": 7.8,
            "vote_count": 11200,
            "certification": "U/A",
            "language": "Hindi",
            "genres": ["Action", "Thriller"],
        },
        {
            "title": "12th Fail",
            "original_title": "12th Fail",
            "synopsis": "Based on the true story of Manoj Kumar Sharma, who overcame extreme poverty to become an Indian Police Service officer.",
            "release_date": date.today() - timedelta(days=80),
            "duration_minutes": 147,
            "poster_url": "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80",
            "rating": 9.2,
            "vote_count": 15400,
            "certification": "U",
            "language": "Hindi",
            "genres": ["Drama", "Biography"],
        },
    ]

    movies = []
    for m in movies_data:
        movie = Movie(**m)
        db.add(movie)
        movies.append(movie)
    await db.flush()

    # 3. Theaters & Screens & Seats
    theaters_data = [
        {
            "name": "PVR Superplex - Select Citywalk",
            "chain": "PVR",
            "address": "A-3, District Centre, Saket",
            "city": "Delhi",
            "state": "Delhi",
            "postal_code": "110017",
            "amenities": ["IMAX Laser", "Dolby Atmos", "Recliner Seats", "Gourmet Food Court", "Valet Parking"],
            "screens": [
                {"name": "Audi 1 (IMAX)", "screen_type": "IMAX", "rows": 8, "cols": 12},
                {"name": "Audi 2 (Dolby Atmos)", "screen_type": "2D", "rows": 8, "cols": 12},
            ],
        },
        {
            "name": "INOX Megaplex - Mall of India",
            "chain": "INOX",
            "address": "Sector 18, Commercial Belt",
            "city": "Noida",
            "state": "Uttar Pradesh",
            "postal_code": "201301",
            "amenities": ["4DX", "Dolby 7.1", "Laser Projection", "Cafe Unwind"],
            "screens": [
                {"name": "Screen 1 (4DX)", "screen_type": "4DX", "rows": 8, "cols": 12},
                {"name": "Screen 2 (Prime 3D)", "screen_type": "3D", "rows": 8, "cols": 12},
            ],
        },
    ]

    created_screens = []
    for t_data in theaters_data:
        screens_info = t_data.pop("screens")
        theater = Theater(**t_data)
        db.add(theater)
        await db.flush()

        for s_info in screens_info:
            screen = Screen(
                theater_id=theater.id,
                name=s_info["name"],
                screen_type=s_info["screen_type"],
                rows_count=s_info["rows"],
                cols_count=s_info["cols"],
                total_seats=s_info["rows"] * s_info["cols"],
            )
            db.add(screen)
            await db.flush()
            created_screens.append(screen)

            # Generate seats for screen (Rows A-H, Cols 1-12)
            row_letters = [chr(65 + i) for i in range(s_info["rows"])]
            seats = []
            for r_idx, r_letter in enumerate(row_letters):
                if r_idx < 2:
                    stype = "STANDARD"
                elif r_idx < 5:
                    stype = "PREMIUM"
                elif r_idx < 7:
                    stype = "VIP"
                else:
                    stype = "RECLINER"

                for col in range(1, s_info["cols"] + 1):
                    seats.append(
                        Seat(
                            screen_id=screen.id,
                            row=r_letter,
                            number=col,
                            seat_type=stype,
                            column_index=col,
                            is_active=True,
                        )
                    )
            db.add_all(seats)

    await db.flush()

    # 4. Shows & Pricing
    now = datetime.now(timezone.utc)
    base_times = [
        now.replace(hour=10, minute=30, second=0, microsecond=0) + timedelta(days=0),
        now.replace(hour=14, minute=15, second=0, microsecond=0) + timedelta(days=0),
        now.replace(hour=18, minute=45, second=0, microsecond=0) + timedelta(days=0),
        now.replace(hour=21, minute=30, second=0, microsecond=0) + timedelta(days=0),
        now.replace(hour=11, minute=0, second=0, microsecond=0) + timedelta(days=1),
        now.replace(hour=15, minute=30, second=0, microsecond=0) + timedelta(days=1),
        now.replace(hour=19, minute=0, second=0, microsecond=0) + timedelta(days=1),
    ]

    for idx, screen in enumerate(created_screens):
        for t_idx, st in enumerate(base_times[:5]):
            movie = movies[(idx + t_idx) % len(movies)]
            show = Show(
                movie_id=movie.id,
                screen_id=screen.id,
                start_time=st,
                end_time=st + timedelta(minutes=movie.duration_minutes + 20),
                language=movie.language,
                format=screen.screen_type,
                status="SCHEDULED",
                is_active=True,
            )
            db.add(show)
            await db.flush()

            # Dynamic pricing per tier
            is_imax = "IMAX" in screen.screen_type
            is_4dx = "4DX" in screen.screen_type
            mult = 1.4 if is_imax else (1.3 if is_4dx else 1.0)

            pricings = [
                ShowPricing(show_id=show.id, seat_type="STANDARD", price=round(220.0 * mult, 2)),
                ShowPricing(show_id=show.id, seat_type="PREMIUM", price=round(320.0 * mult, 2)),
                ShowPricing(show_id=show.id, seat_type="VIP", price=round(450.0 * mult, 2)),
                ShowPricing(show_id=show.id, seat_type="RECLINER", price=round(650.0 * mult, 2)),
            ]
            db.add_all(pricings)

    # 5. Promotions
    promos = [
        Promotion(
            code="WELCOME50",
            description="50% off on your first movie booking up to ₹150",
            discount_type="PERCENTAGE",
            discount_value=50.0,
            max_discount=150.0,
            min_spend=200.0,
            valid_from=now - timedelta(days=30),
            valid_to=now + timedelta(days=365),
            is_active=True,
        ),
        Promotion(
            code="FLAT100",
            description="Flat ₹100 discount on bookings above ₹500",
            discount_type="FLAT",
            discount_value=100.0,
            max_discount=100.0,
            min_spend=500.0,
            valid_from=now - timedelta(days=30),
            valid_to=now + timedelta(days=365),
            is_active=True,
        ),
    ]
    db.add_all(promos)

    await db.commit()
    logger.info("Demo inventory seeding completed successfully!")


if __name__ == "__main__":
    from app.database import AsyncSessionLocal
    async def main():
        async with AsyncSessionLocal() as db:
            await seed_database(db)
    asyncio.run(main())
