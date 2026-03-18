"""
Async SQLAlchemy engine and session factory.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

_cfg = get_settings()

engine = create_async_engine(
    _cfg.DATABASE_URL,
    echo=_cfg.DATABASE_ECHO,
    pool_size=_cfg.DB_POOL_SIZE,
    max_overflow=_cfg.DB_MAX_OVERFLOW,
    pool_pre_ping=True,
)

SessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
