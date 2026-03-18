"""
Application configuration using pydantic-settings.

All settings are loaded from environment variables or a .env file.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the XAUUSD trading system."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────────────
    APP_NAME: str = "XAUUSD Trading System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # ── Database ─────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/trading"
    DATABASE_ECHO: bool = False

    # ── Authentication / JWT ─────────────────────────────────────────────
    SECRET_KEY: str = "CHANGE-ME-to-a-random-64-char-hex-string"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # ── MetaTrader 5 ─────────────────────────────────────────────────────
    MT5_TERMINAL_PATH: Optional[str] = None
    MT5_LOGIN: Optional[int] = None
    MT5_PASSWORD: Optional[str] = None
    MT5_SERVER: Optional[str] = None

    # ── Risk Management ──────────────────────────────────────────────────
    RISK_PER_TRADE_PCT: float = 0.5
    DAILY_LOSS_LIMIT_PCT: float = 1.0
    WEEKLY_LOSS_LIMIT_PCT: float = 3.0
    MAX_TRADES_PER_DAY: int = 3
    MAX_CONSECUTIVE_LOSSES: int = 2
    MIN_RR: float = 1.5
    MAX_SPREAD_POINTS: int = 30


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton of the application settings."""
    return Settings()
