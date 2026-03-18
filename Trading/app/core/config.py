"""
Centralised configuration loaded from environment variables and JSON config.

Precedence: env vars > settings.json > defaults defined here.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import Field
from pydantic_settings import BaseSettings


# ── Helpers ─────────────────────────────────────────────────────────────

def _load_json_config() -> Dict[str, Any]:
    """Load settings.json from project root if it exists."""
    candidates = [
        Path(os.environ.get("SETTINGS_FILE", "")),
        Path("settings.json"),
        Path("settings.example.json"),
    ]
    for path in candidates:
        if path.is_file():
            with open(path, "r") as f:
                return json.load(f)
    return {}


_JSON = _load_json_config()


def _j(section: str, key: str, default: Any = None) -> Any:
    """Read a value from the JSON config."""
    return _JSON.get(section, {}).get(key, default)


# ── Application Settings ───────────────────────────────────────────────

def _build_database_url() -> str:
    """Build DATABASE_URL, supporting Cloud SQL Unix socket if configured.

    If INSTANCE_CONNECTION_NAME is set (e.g. project:region:instance),
    builds a URL using the Cloud SQL Auth Proxy Unix socket path.
    Otherwise falls back to DATABASE_URL env var or the default.
    """
    instance = os.environ.get("INSTANCE_CONNECTION_NAME")
    if instance:
        user = os.environ.get("DB_USER", "trading_user")
        password = os.environ.get("DB_PASSWORD", "")
        db_name = os.environ.get("DB_NAME", "trading")
        socket_path = f"/cloudsql/{instance}"
        return f"postgresql+asyncpg://{user}:{password}@/{db_name}?host={socket_path}"
    return os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@localhost:5432/trading",
    )


class AppSettings(BaseSettings):
    """Top-level application settings."""

    APP_NAME: str = "XAUUSD Full-Auto Trading System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # json | text

    # Database — auto-detects Cloud SQL socket via INSTANCE_CONNECTION_NAME
    DATABASE_URL: str = Field(default_factory=_build_database_url)
    DATABASE_ECHO: bool = False
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20

    # Security
    SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # ── Broker / MT5 ────────────────────────────────────────────────
    BROKER_NAME: str = _j("broker", "broker_name", "ACCM")
    BROKER_DOMAIN: str = _j("broker", "broker_domain", "accm.global")
    MT5_LOGIN: int = int(os.environ.get("MT5_LOGIN", "0"))
    MT5_PASSWORD: str = os.environ.get("MT5_PASSWORD", "")
    MT5_SERVER: str = os.environ.get("MT5_SERVER", "ACCM-Live")
    MT5_TERMINAL_PATH: str = os.environ.get(
        "MT5_TERMINAL_PATH", r"C:\Program Files\MetaTrader 5\terminal64.exe"
    )
    MT5_TERMINAL_DATA_PATH: str = os.environ.get("MT5_TERMINAL_DATA_PATH", "")
    MT5_SIMULATION_MODE: bool = os.environ.get("MT5_SIMULATION_MODE", "false").lower() == "true"

    # ── Primary instrument ──────────────────────────────────────────
    PRIMARY_SYMBOL: str = "XAUUSD"
    PRIMARY_TIMEFRAME: str = "M15"

    # ── Policy mode ─────────────────────────────────────────────────
    POLICY_MODE: str = _j("mode_policy", "active_mode", "strict")

    # ══════════════════════════════════════════════════════════════════
    #  Account / Portfolio Risk Defaults
    # ══════════════════════════════════════════════════════════════════
    DAILY_LOSS_LIMIT_PCT: float = _j("account_risk", "daily_loss_limit_pct", 1.0)
    WEEKLY_LOSS_LIMIT_PCT: float = _j("account_risk", "weekly_loss_limit_pct", 2.5)
    MONTHLY_LOSS_LIMIT_PCT: float = _j("account_risk", "monthly_loss_limit_pct", 6.0)
    MAX_RISK_PER_TRADE_PCT: float = _j("account_risk", "max_risk_per_trade_pct", 0.25)
    MAX_OPEN_RISK_PCT: float = _j("account_risk", "max_open_risk_pct", 1.0)
    MAX_TRADES_PER_DAY: int = _j("account_risk", "max_trades_per_day", 3)
    MAX_CONSECUTIVE_LOSSES: int = _j("account_risk", "max_consecutive_losses", 2)
    MAX_SIMULTANEOUS_POSITIONS: int = _j("account_risk", "max_simultaneous_positions", 1)
    MAX_POSITION_SIZE_LOT: float = _j("account_risk", "max_position_size_lot", 0.05)
    MIN_FREE_MARGIN_PCT: float = _j("account_risk", "min_free_margin_pct", 300.0)
    HARD_MIN_MARGIN_LEVEL_PCT: float = _j("account_risk", "hard_min_margin_level_pct", 200.0)
    INTRADAY_DRAWDOWN_LIMIT_PCT: float = _j("account_risk", "intraday_drawdown_limit_pct", 1.25)
    PROFIT_LOCK_TRIGGER_R: float = _j("account_risk", "profit_lock_trigger_r", 1.5)
    STOP_TRADING_AFTER_PROFIT_R: float = _j("account_risk", "stop_trading_after_profit_r", 2.0)

    # ══════════════════════════════════════════════════════════════════
    #  Market / Execution Risk Defaults
    # ══════════════════════════════════════════════════════════════════
    WARN_SPREAD_POINTS: float = _j("market_execution", "warn_spread_points", 22.0)
    MAX_SPREAD_POINTS: float = _j("market_execution", "max_spread_points", 30.0)
    WARN_SLIPPAGE_POINTS: float = _j("market_execution", "warn_slippage_points", 12.0)
    MAX_SLIPPAGE_POINTS: float = _j("market_execution", "max_slippage_points", 20.0)
    ATR_VOLATILITY_MULTIPLIER_MAX: float = _j("market_execution", "atr_volatility_multiplier_max", 2.0)
    CANDLE_RANGE_SPIKE_MULTIPLIER: float = _j("market_execution", "candle_range_spike_multiplier", 2.5)
    ALLOWED_SESSIONS: List[str] = _j("market_execution", "allowed_sessions", ["London", "NewYorkOverlap"])
    BLOCK_ROLLOVER_WINDOW: bool = _j("market_execution", "block_rollover_window", True)
    ROLLOVER_BLOCK_MINUTES: int = _j("market_execution", "rollover_block_minutes", 30)
    NEWS_BLOCK_BEFORE_MINUTES: int = _j("market_execution", "news_block_before_minutes", 30)
    NEWS_BLOCK_AFTER_MINUTES: int = _j("market_execution", "news_block_after_minutes", 15)
    MAX_ORDER_RETRIES: int = _j("market_execution", "max_order_retries", 1)
    PRICE_FEED_FRESH_SECONDS: int = _j("market_execution", "price_feed_fresh_seconds", 3)

    # ══════════════════════════════════════════════════════════════════
    #  Strategy / AI Defaults
    # ══════════════════════════════════════════════════════════════════
    MIN_RR: float = _j("strategy_ai", "min_rr", 1.8)
    MIN_AI_CONFIDENCE: float = _j("strategy_ai", "min_ai_confidence", 0.70)
    WARN_AI_CONFIDENCE: float = _j("strategy_ai", "warn_ai_confidence", 0.78)
    MIN_CONFIRMATIONS_REQUIRED: int = _j("strategy_ai", "min_confirmations_required", 3)
    COOLDOWN_AFTER_TRADE_MINUTES: int = _j("strategy_ai", "cooldown_after_trade_minutes", 10)
    COOLDOWN_AFTER_LOSS_MINUTES: int = _j("strategy_ai", "cooldown_after_loss_minutes", 20)
    REENTRY_BLOCK_SAME_DIRECTION_MINUTES: int = _j("strategy_ai", "reentry_block_same_direction_minutes", 30)
    MAX_TRADES_PER_HOUR: int = _j("strategy_ai", "max_trades_per_hour", 1)
    STRATEGY_DRIFT_LOSS_STREAK_LIMIT: int = _j("strategy_ai", "strategy_drift_loss_streak_limit", 4)
    STRATEGY_DRIFT_EXPECTANCY_THRESHOLD: float = _j("strategy_ai", "strategy_drift_expectancy_threshold", 0.0)
    FEATURE_TIMEOUT_SECONDS: int = _j("strategy_ai", "feature_timeout_seconds", 2)

    # ══════════════════════════════════════════════════════════════════
    #  System / Operational Defaults
    # ══════════════════════════════════════════════════════════════════
    MT5_CONNECTION_REQUIRED: bool = True
    BROKER_PING_TIMEOUT_SECONDS: int = _j("system_operational", "broker_ping_timeout_seconds", 3)
    DUPLICATE_ORDER_LOCK_WINDOW_SECONDS: int = _j("system_operational", "duplicate_order_lock_window_seconds", 10)
    RECONCILIATION_REQUIRED_BEFORE_NEW_TRADE: bool = True

    # ══════════════════════════════════════════════════════════════════
    #  Safe Mode
    # ══════════════════════════════════════════════════════════════════
    SAFE_MODE_RISK_MULTIPLIER: float = _j("safe_mode_policy", "risk_multiplier", 0.5)
    SAFE_MODE_MAX_TRADES_PER_DAY: int = _j("safe_mode_policy", "max_trades_per_day", 1)
    SAFE_MODE_MIN_CONFIDENCE: float = _j("safe_mode_policy", "min_confidence", 0.82)
    SAFE_MODE_MIN_RR: float = _j("safe_mode_policy", "min_rr", 2.5)
    SAFE_MODE_WARN_CLUSTER_THRESHOLD: int = _j("safe_mode_policy", "warn_cluster_threshold", 5)

    # ══════════════════════════════════════════════════════════════════
    #  Auto-Trade Loop
    # ══════════════════════════════════════════════════════════════════
    AUTO_TRADE_INTERVAL_SECONDS: int = 60
    AUTO_TRADE_MAGIC_NUMBER: int = 999999
    COMMENT_PREFIX: str = "7H-AUTO"

    model_config = {"env_prefix": "", "env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> AppSettings:
    return AppSettings()
