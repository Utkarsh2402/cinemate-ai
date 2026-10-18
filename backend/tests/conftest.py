import pytest
import pytest_asyncio
from typing import AsyncGenerator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.database import Base, get_db
from app.main import app
from app.redis_client import redis_service
from app.common.security import get_password_hash, create_access_token
from app.models.user import User
from app.models.movie import Movie
from app.models.theater import Theater, Screen, Seat
from app.models.show import Show, ShowPricing
from datetime import datetime, date, timedelta, timezone
import fakeredis.aioredis as fake_aioredis

# In-memory test database
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_redis():
    redis_service.client = fake_aioredis.FakeRedis(decode_responses=True)
    redis_service._is_fake = True
    yield
    await redis_service.close()


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def seed_test_data(db_session: AsyncSession):
    # Customer
    customer = User(
        email="test_user@cinemate.ai",
        hashed_password=get_password_hash("Secret123"),
        full_name="Test Customer",
        role="customer",
        is_active=True,
    )
    # Admin
    admin = User(
        email="test_admin@cinemate.ai",
        hashed_password=get_password_hash("AdminSecret123"),
        full_name="Test Admin",
        role="admin",
        is_active=True,
    )
    db_session.add_all([customer, admin])
    await db_session.flush()

    # Movie
    movie = Movie(
        title="Dune: Part Two",
        synopsis="Paul Atreides unites with Chani and the Fremen.",
        release_date=date.today(),
        duration_minutes=166,
        poster_url="https://example.com/dune.jpg",
        rating=8.8,
        certification="U/A",
        language="English",
        genres=["Sci-Fi", "Action"],
        is_active=True,
    )
    db_session.add(movie)
    await db_session.flush()

    # Theater
    theater = Theater(
        name="PVR Select Citywalk",
        address="Saket District Centre",
        city="Delhi",
        state="Delhi",
        postal_code="110017",
        amenities=["IMAX", "Dolby Atmos"],
        is_active=True,
    )
    db_session.add(theater)
    await db_session.flush()

    # Screen
    screen = Screen(
        theater_id=theater.id,
        name="Audi 1 (IMAX)",
        screen_type="IMAX",
        rows_count=4,
        cols_count=4,
        total_seats=16,
    )
    db_session.add(screen)
    await db_session.flush()

    # Seats
    seats = []
    for r_idx, r in enumerate(["A", "B", "C", "D"]):
        stype = "STANDARD" if r_idx < 2 else "PREMIUM"
        for c in range(1, 5):
            seats.append(
                Seat(
                    screen_id=screen.id,
                    row=r,
                    number=c,
                    seat_type=stype,
                    column_index=c,
                    is_active=True,
                )
            )
    db_session.add_all(seats)
    await db_session.flush()

    # Show
    now = datetime.now(timezone.utc)
    show = Show(
        movie_id=movie.id,
        screen_id=screen.id,
        start_time=now + timedelta(hours=24),
        end_time=now + timedelta(hours=27),
        language="English",
        format="IMAX",
        status="SCHEDULED",
        is_active=True,
    )
    db_session.add(show)
    await db_session.flush()

    pricings = [
        ShowPricing(show_id=show.id, seat_type="STANDARD", price=300.0),
        ShowPricing(show_id=show.id, seat_type="PREMIUM", price=450.0),
    ]
    db_session.add_all(pricings)
    await db_session.commit()

    return {
        "customer": customer,
        "admin": admin,
        "movie": movie,
        "theater": theater,
        "screen": screen,
        "seats": seats,
        "show": show,
    }


@pytest.fixture
def auth_headers(seed_test_data):
    token = create_access_token(subject=seed_test_data["customer"].id, role="customer")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(seed_test_data):
    token = create_access_token(subject=seed_test_data["admin"].id, role="admin")
    return {"Authorization": f"Bearer {token}"}
