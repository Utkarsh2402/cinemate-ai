import asyncio
import os
import sys
from datetime import datetime, date, timedelta, timezone
from sqlalchemy import select, delete

# Ensure python path has backend
sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import AsyncSessionLocal
from app.models.movie import Movie
from app.models.theater import Screen
from app.models.show import Show, ShowPricing

NETFLIX_REALTIME_MOVIES = [
    {
        "title": "Amar Singh Chamkila",
        "original_title": "Amar Singh Chamkila",
        "synopsis": "The humble singer whose brash lyrics ignited fame and fury across Punjab. The untold true story of Punjab's original rockstar, starring Diljit Dosanjh and Parineeti Chopra.",
        "release_date": date(2024, 4, 12),
        "duration_minutes": 145,
        "poster_url": "https://m.media-amazon.com/images/M/MV5BYzA2N2U2YmEtYjBiOC00NmViLTg4YmUtOTFlNmI3ZGY3ZTBhXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "backdrop_url": "https://m.media-amazon.com/images/M/MV5BYzA2N2U2YmEtYjBiOC00NmViLTg4YmUtOTFlNmI3ZGY3ZTBhXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "rating": 8.4,
        "vote_count": 38000,
        "certification": "U/A",
        "language": "Hindi",
        "genres": ["Drama", "Biography", "Music", "Netflix"],
    },
    {
        "title": "Animal",
        "original_title": "Animal",
        "synopsis": "A son undergoes a terrifying transformation as his obsessive love for his distant father pushes him into a brutal underworld war of bloody vengeance.",
        "release_date": date(2023, 12, 1),
        "duration_minutes": 201,
        "poster_url": "https://m.media-amazon.com/images/M/MV5BMjY5YmIwM2EtNDQ2Ny00YmYwLTlkNmYtZWQwMWRjOWZhOTZhXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "backdrop_url": "https://m.media-amazon.com/images/M/MV5BMjY5YmIwM2EtNDQ2Ny00YmYwLTlkNmYtZWQwMWRjOWZhOTZhXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "rating": 8.1,
        "vote_count": 89000,
        "certification": "A",
        "language": "Hindi",
        "genres": ["Action", "Crime", "Drama", "Netflix"],
    },
    {
        "title": "Sector 36",
        "original_title": "Sector 36",
        "synopsis": "Inspired by shocking true events: when slum children vanish without a trace, a corrupt police officer unearths a dark web of serial abductions and gruesome murders.",
        "release_date": date(2024, 9, 13),
        "duration_minutes": 124,
        "poster_url": "https://m.media-amazon.com/images/M/MV5BZTIxOWU3OWEtY2JmNy00MTk1LWFjMjUtMTY2ZDNiMmY3NzM1XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "backdrop_url": "https://m.media-amazon.com/images/M/MV5BZTIxOWU3OWEtY2JmNy00MTk1LWFjMjUtMTY2ZDNiMmY3NzM1XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "rating": 8.2,
        "vote_count": 21000,
        "certification": "A",
        "language": "Hindi",
        "genres": ["Crime", "Thriller", "Drama", "Netflix"],
    },
    {
        "title": "Maharaj",
        "original_title": "Maharaj",
        "synopsis": "In 1862 Bombay, fearless journalist Karsandas Mulji takes on a revered religious leader who abuses his power, resulting in the historic Maharaj Libel Case.",
        "release_date": date(2024, 6, 21),
        "duration_minutes": 131,
        "poster_url": "https://m.media-amazon.com/images/M/MV5BZjY5MmU1NDktMDVjMi00Mjc3LTk4ODgtOTZkOGMxN2U4M2E4XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "backdrop_url": "https://m.media-amazon.com/images/M/MV5BZjY5MmU1NDktMDVjMi00Mjc3LTk4ODgtOTZkOGMxN2U4M2E4XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "rating": 7.9,
        "vote_count": 18000,
        "certification": "U/A",
        "language": "Hindi",
        "genres": ["Drama", "History", "Netflix"],
    },
    {
        "title": "CTRL",
        "original_title": "CTRL",
        "synopsis": "Nella and Joe are the perfect influencer couple. But when Joe cheats, Nella uses a cutting-edge AI assistant to erase him from her life—until the AI takes full control.",
        "release_date": date(2024, 10, 4),
        "duration_minutes": 100,
        "poster_url": "https://m.media-amazon.com/images/M/MV5BNTIwM2JhYTItYWM1Ni00MjhhLTk2ZTItZTk2ODRkYTk1MTljXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "backdrop_url": "https://m.media-amazon.com/images/M/MV5BNTIwM2JhYTItYWM1Ni00MjhhLTk2ZTItZTk2ODRkYTk1MTljXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "rating": 7.6,
        "vote_count": 14000,
        "certification": "U/A",
        "language": "Hindi",
        "genres": ["Thriller", "Sci-Fi", "Drama", "Netflix"],
    },
    {
        "title": "Do Patti",
        "original_title": "Do Patti",
        "synopsis": "A chilling attempted murder in the misty hills of Uttarakhand pits a fierce cop against two enigmatic twin sisters harbouring dangerous secrets.",
        "release_date": date(2024, 10, 25),
        "duration_minutes": 112,
        "poster_url": "https://m.media-amazon.com/images/M/MV5BZGFmNzA1MWUtODhhNi00MTQ2LTlhZjgtN2E1YWRmOGI5ZGRlXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "backdrop_url": "https://m.media-amazon.com/images/M/MV5BZGFmNzA1MWUtODhhNi00MTQ2LTlhZjgtN2E1YWRmOGI5ZGRlXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "rating": 7.7,
        "vote_count": 16500,
        "certification": "U/A",
        "language": "Hindi",
        "genres": ["Mystery", "Thriller", "Drama", "Netflix"],
    },
    {
        "title": "Extraction 2",
        "original_title": "Extraction II",
        "synopsis": "Back from the brink of death, highly skilled commando Tyler Rake embarks on another deadly extraction mission into a maximum security Georgian prison.",
        "release_date": date(2023, 6, 16),
        "duration_minutes": 122,
        "poster_url": "https://m.media-amazon.com/images/M/MV5BOGZmNTE2M2MtMTU0YS00MDQ1LThlYjMtZDVhMDRkNGQzODAyXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "backdrop_url": "https://m.media-amazon.com/images/M/MV5BOGZmNTE2M2MtMTU0YS00MDQ1LThlYjMtZDVhMDRkNGQzODAyXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "rating": 8.0,
        "vote_count": 145000,
        "certification": "A",
        "language": "English",
        "genres": ["Action", "Thriller", "Netflix"],
    },
    {
        "title": "Red Notice",
        "original_title": "Red Notice",
        "synopsis": "An FBI top profiler teams up with an international art thief to capture the world's most elusive Cleopatra egg heist criminal, starring Dwayne Johnson and Ryan Reynolds.",
        "release_date": date(2021, 11, 12),
        "duration_minutes": 118,
        "poster_url": "https://m.media-amazon.com/images/M/MV5BZmRjODgyMzEtMzIxYS00OWY2LTk4YjUtMGMzZDA4NjBkMmY2XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "backdrop_url": "https://m.media-amazon.com/images/M/MV5BZmRjODgyMzEtMzIxYS00OWY2LTk4YjUtMGMzZDA4NjBkMmY2XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "rating": 7.8,
        "vote_count": 310000,
        "certification": "U/A",
        "language": "English",
        "genres": ["Action", "Comedy", "Crime", "Netflix"],
    },
    {
        "title": "Glass Onion: A Knives Out Mystery",
        "original_title": "Glass Onion: A Knives Out Mystery",
        "synopsis": "Famed detective Benoit Blanc arrives on a secluded private Greek estate to peel back the layers of a murder mystery game that turns deadly real.",
        "release_date": date(2022, 12, 23),
        "duration_minutes": 139,
        "poster_url": "https://m.media-amazon.com/images/M/MV5BYmZlZDZkMDItNzPjOC00YTU1LWI5OGMtMGZhYzcwZTFkNmY0XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "backdrop_url": "https://m.media-amazon.com/images/M/MV5BYmZlZDZkMDItNzPjOC00YTU1LWI5OGMtMGZhYzcwZTFkNmY0XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "rating": 8.2,
        "vote_count": 220000,
        "certification": "U/A",
        "language": "English",
        "genres": ["Mystery", "Comedy", "Crime", "Netflix"],
    },
    {
        "title": "RRR",
        "original_title": "RRR: Rise Roar Revolt",
        "synopsis": "A fearless revolutionary and an officer in the British force develop an unbreakable brotherhood before discovering each other's secret identities in SS Rajamouli's masterpiece.",
        "release_date": date(2022, 3, 25),
        "duration_minutes": 187,
        "poster_url": "https://m.media-amazon.com/images/M/MV5BNWMwODYyNmQtMTBmMS00NTQ3LTk2ZWMtPGEyNDljOTVlMDRjXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "backdrop_url": "https://m.media-amazon.com/images/M/MV5BNWMwODYyNmQtMTBmMS00NTQ3LTk2ZWMtPGEyNDljOTVlMDRjXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "rating": 8.8,
        "vote_count": 195000,
        "certification": "U/A",
        "language": "Hindi",
        "genres": ["Action", "Drama", "History", "Netflix"],
    },
    {
        "title": "12th Fail",
        "original_title": "12th Fail",
        "synopsis": "Based on the inspiring real-life journey of Manoj Kumar Sharma, who restarted his life from nothing to conquer the UPSC exams through sheer determination.",
        "release_date": date(2023, 10, 27),
        "duration_minutes": 147,
        "poster_url": "https://m.media-amazon.com/images/M/MV5BNTk5YmFhODEtODk5Ny00MmQzLTgzODctMmFmZjM5OWFjMjY1XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "backdrop_url": "https://m.media-amazon.com/images/M/MV5BNTk5YmFhODEtODk5Ny00MmQzLTgzODctMmFmZjM5OWFjMjY1XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "rating": 9.2,
        "vote_count": 115000,
        "certification": "U",
        "language": "Hindi",
        "genres": ["Drama", "Biography", "Netflix"],
    },
    {
        "title": "Stree 2",
        "original_title": "Stree 2: Sarkate Ka Aatank",
        "synopsis": "The headless spirit Sarkate terrorizes Chanderi by abducting modern women. Vicky, Bittu, Janna, and Rudra must summon their courage and join forces with Stree.",
        "release_date": date(2024, 8, 15),
        "duration_minutes": 147,
        "poster_url": "https://m.media-amazon.com/images/M/MV5BOGZmNzc5YTYtMmExNS00ZTIwLWFmZDEtOGQwY2YxMWRlYTU1XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "backdrop_url": "https://m.media-amazon.com/images/M/MV5BOGZmNzc5YTYtMmExNS00ZTIwLWFmZDEtOGQwY2YxMWRlYTU1XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "rating": 8.3,
        "vote_count": 64000,
        "certification": "U/A",
        "language": "Hindi",
        "genres": ["Comedy", "Horror", "Netflix"],
    },
    {
        "title": "Dunki",
        "original_title": "Dunki",
        "synopsis": "A heartwarming saga of four Punjabi friends who attempt the perilous 'Donkey Flight' border journey to the UK under the leadership of a loyal soldier, Shah Rukh Khan.",
        "release_date": date(2023, 12, 21),
        "duration_minutes": 161,
        "poster_url": "https://m.media-amazon.com/images/M/MV5BYzA2ZTBhMzQtZGRhYy00NzVjLThmYjUtNTRmNWFkY2IzZDhmXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "backdrop_url": "https://m.media-amazon.com/images/M/MV5BYzA2ZTBhMzQtZGRhYy00NzVjLThmYjUtNTRmNWFkY2IzZDhmXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "rating": 7.6,
        "vote_count": 78000,
        "certification": "U/A",
        "language": "Hindi",
        "genres": ["Comedy", "Drama", "Netflix"],
    },
    {
        "title": "Jawan: Extended Cut",
        "original_title": "Jawan",
        "synopsis": "An emotional journey of a prison jailer and his vigilante crew of women who hijack trains to right systemic injustices, revealing deep family secrets.",
        "release_date": date(2023, 9, 7),
        "duration_minutes": 171,
        "poster_url": "https://m.media-amazon.com/images/M/MV5BMjY1M2RhYTgtY2Y5Ny00OTlhLWE4Y2EtMjJmZGE4ZGE5OWU4XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "backdrop_url": "https://m.media-amazon.com/images/M/MV5BMjY1M2RhYTgtY2Y5Ny00OTlhLWE4Y2EtMjJmZGE4ZGE5OWU4XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        "rating": 8.4,
        "vote_count": 110000,
        "certification": "U/A",
        "language": "Hindi",
        "genres": ["Action", "Thriller", "Netflix"],
    },
]


async def sync_netflix_movies():
    print("Connecting to Supabase PostgreSQL database...")
    async with AsyncSessionLocal() as session:
        # 1. Fetch available screens
        screens_res = await session.execute(select(Screen))
        screens = list(screens_res.scalars().all())
        if not screens:
            print("No screens found in database. Please run initial seed first.")
            return

        print(f"Found {len(screens)} screens. Upserting {len(NETFLIX_REALTIME_MOVIES)} Netflix movies...")

        now = datetime.now(timezone.utc)
        shows_to_create = []

        for movie_dict in NETFLIX_REALTIME_MOVIES:
            # Check if movie already exists by title
            stmt = select(Movie).where(Movie.title == movie_dict["title"])
            existing = (await session.execute(stmt)).scalar_one_or_none()

            if existing:
                # Update metadata and poster
                existing.poster_url = movie_dict["poster_url"]
                existing.backdrop_url = movie_dict["backdrop_url"]
                existing.synopsis = movie_dict["synopsis"]
                existing.rating = movie_dict["rating"]
                existing.genres = movie_dict["genres"]
                existing.language = movie_dict["language"]
                existing.duration_minutes = movie_dict["duration_minutes"]
                movie_obj = existing
                print(f"Updated existing movie: {movie_obj.title}")
            else:
                movie_obj = Movie(**movie_dict)
                session.add(movie_obj)
                await session.flush()
                print(f"Created new Netflix movie: {movie_obj.title}")

            # Ensure this movie has active showtimes for today and tomorrow
            show_check = await session.execute(select(Show).where(Show.movie_id == movie_obj.id))
            existing_shows = list(show_check.scalars().all())

            if len(existing_shows) < 2:
                for day_offset in [0, 1]:
                    for screen_idx, start_hour in enumerate([14, 18, 21]):
                        target_screen = screens[screen_idx % len(screens)]
                        show_time = (now + timedelta(days=day_offset)).replace(
                            hour=start_hour, minute=0, second=0, microsecond=0
                        )
                        show = Show(
                            movie_id=movie_obj.id,
                            screen_id=target_screen.id,
                            start_time=show_time,
                            end_time=show_time + timedelta(minutes=movie_obj.duration_minutes),
                            format="Dolby Atmos" if screen_idx % 2 == 0 else "IMAX 4K",
                            is_active=True,
                        )
                        session.add(show)
                        await session.flush()

                        # Add pricing
                        pricing = [
                            ShowPricing(show_id=show.id, seat_type="STANDARD", price=250.0),
                            ShowPricing(show_id=show.id, seat_type="PREMIUM", price=350.0),
                            ShowPricing(show_id=show.id, seat_type="VIP", price=500.0),
                            ShowPricing(show_id=show.id, seat_type="RECLINER", price=650.0),
                        ]
                        session.add_all(pricing)

        await session.commit()
        print(f"\nSUCCESS! All {len(NETFLIX_REALTIME_MOVIES)} Netflix real-time movies synchronized to Supabase!")


if __name__ == "__main__":
    asyncio.run(sync_netflix_movies())
