"""
FastAPI dependency injection providers.
"""

from __future__ import annotations

from typing import AsyncGenerator

from fastapi import Depends, Request

from app.core.config import AppSettings, get_settings
from app.db.session import SessionLocal


async def get_db() -> AsyncGenerator:
    """Yield an async database session."""
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def get_auto_trader(request: Request):
    """Return the AutoTrader instance from app state."""
    return getattr(request.app.state, "auto_trader", None)


def get_system_state(request: Request):
    """Return the SystemStateService from app state."""
    return getattr(request.app.state, "system_state", None)


def get_mt5_service(request: Request):
    """Return the MT5Service from app state."""
    return getattr(request.app.state, "mt5_service", None)


def get_broker_profile(request: Request):
    """Return the active broker profile from app state."""
    return getattr(request.app.state, "broker_profile", None)


def get_config() -> AppSettings:
    """Return cached application settings."""
    return get_settings()
