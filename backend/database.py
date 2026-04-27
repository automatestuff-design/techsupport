import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

_raw = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./techsupport.db")

# Normalize Postgres URLs to psycopg3 async driver.
# psycopg uses simple query protocol by default — no prepared statement
# conflicts with Supabase's PgBouncer/Supavisor in any pooling mode.
if _raw.startswith("postgres://"):
    DATABASE_URL = _raw.replace("postgres://", "postgresql+psycopg://", 1)
elif _raw.startswith("postgresql://") and "+psycopg" not in _raw and "+asyncpg" not in _raw:
    DATABASE_URL = _raw.replace("postgresql://", "postgresql+psycopg://", 1)
elif _raw.startswith("postgresql+asyncpg://"):
    DATABASE_URL = _raw.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
else:
    DATABASE_URL = _raw

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
