from typing import List
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_BASE_DIR = Path(__file__).resolve().parent.parent
_DEFAULT_DB_FILE = (_BASE_DIR / "cinemate.db").as_posix()


class Settings(BaseSettings):
    PROJECT_NAME: str = "CineMate AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str = Field(
        default=f"sqlite+aiosqlite:///{_DEFAULT_DB_FILE}",
        description="Async database connection URL (PostgreSQL asyncpg or SQLite aiosqlite)",
    )
    SYNC_DATABASE_URL: str = Field(
        default=f"sqlite:///{_DEFAULT_DB_FILE}",
        description="Synchronous database connection URL for Alembic migrations",
    )
    DB_ECHO: bool = False

    # Redis
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL for caching, rate limiting, and distributed hold coordination",
    )
    USE_FAKEREDIS_FALLBACK: bool = True

    # Security & JWT
    SECRET_KEY: str = "cinemate-super-secret-key-change-in-production-2026-min-32-chars!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Business Rules
    SEAT_HOLD_DURATION_SECONDS: int = 600  # 10 minutes hold
    MAX_SEATS_PER_BOOKING: int = 10
    CANCELLATION_WINDOW_HOURS: int = 2  # Cancellations allowed up to 2 hours before showtime
    REFUND_PERCENTAGE: float = 100.0

    # Payment Sandbox
    PAYMENT_WEBHOOK_SECRET: str = "cinemate_sandbox_whsec_secret_key_998877"

    # AI Configuration
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    AI_MODEL: str = "gemini-flash-latest"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow",
    )


settings = Settings()
