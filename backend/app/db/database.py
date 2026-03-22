"""Database initialization and session management."""
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./data/startup_arena.db")

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    """Create all tables and run lightweight migrations."""
    from app.models.debate import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Lightweight migration: add share_token column if missing
    async with engine.begin() as conn:
        try:
            await conn.execute(text("SELECT share_token FROM debates LIMIT 1"))
        except Exception:
            await conn.execute(text("ALTER TABLE debates ADD COLUMN share_token VARCHAR"))


async def get_session() -> AsyncSession:
    """Get async database session."""
    async with async_session() as session:
        yield session
