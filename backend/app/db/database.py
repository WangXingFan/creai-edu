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

    debate_column_types = {
        "share_token": "VARCHAR",
        "agent_states": "JSON",
        "action_trace": "JSON",
        "evidence_board": "JSON",
        "shared_blackboard": "JSON",
        "halt_reason": "TEXT",
        "step_count": "INTEGER DEFAULT 0",
        "event_cache": "JSON",
        "cache_enabled": "BOOLEAN DEFAULT 0",
        # 双创课堂场景：班级与学生归属
        "class_id": "VARCHAR",
        "student_name": "VARCHAR",
        "student_id": "VARCHAR",
    }

    async def ensure_debate_column(column_name: str) -> None:
        sql_type = debate_column_types[column_name]
        async with engine.begin() as conn:
            try:
                await conn.execute(text(f"SELECT {column_name} FROM debates LIMIT 1"))
            except Exception:
                await conn.execute(text(f"ALTER TABLE debates ADD COLUMN {column_name} {sql_type}"))

    # Lightweight migrations for older SQLite databases.
    for column_name in debate_column_types:
        await ensure_debate_column(column_name)

    # Index on class_id for fast class-scope queries.
    async with engine.begin() as conn:
        try:
            await conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_debates_class_id ON debates (class_id)")
            )
        except Exception:
            pass


async def get_session() -> AsyncSession:
    """Get async database session."""
    async with async_session() as session:
        yield session
