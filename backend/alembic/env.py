import os
import sys
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# Add current path
sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.database import Base
from app.models import *  # Import all models for metadata detection

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Override URL dynamically from application settings
sync_url = settings.SYNC_DATABASE_URL
if "sqlite+aiosqlite" in settings.DATABASE_URL:
    sync_url = settings.DATABASE_URL.replace("sqlite+aiosqlite", "sqlite")
elif "postgresql+asyncpg" in settings.DATABASE_URL:
    sync_url = settings.DATABASE_URL.replace("postgresql+asyncpg", "postgresql+psycopg").replace("ssl=require", "sslmode=require")
    if "pooler.supabase.com" in sync_url and "sslmode" not in sync_url:
        sync_url += "?sslmode=require"

config.set_main_option("sqlalchemy.url", sync_url.replace("%", "%%"))


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # Enables SQLite batch alterations
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
