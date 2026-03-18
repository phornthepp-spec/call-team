"""
Configuration — loads settings from .env + settings.json.

Environment variables override settings.json values where applicable.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

_BASE_DIR = Path(__file__).resolve().parent


def _load_settings_json() -> Dict[str, Any]:
    """Load settings.json from the module directory."""
    path = _BASE_DIR / "settings.json"
    if not path.exists():
        logger.warning("settings.json not found at %s — using defaults", path)
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@dataclass(frozen=False)
class Config:
    """Central configuration object."""

    # ── Exchange ──────────────────────────────────────────────────
    exchange_id: str = "binance"
    api_key: str = ""
    api_secret: str = ""

    # ── Mode ──────────────────────────────────────────────────────
    dry_run: bool = True

    # ── Trading ───────────────────────────────────────────────────
    symbol: str = "BTC/USDT"
    timeframe: str = "15m"
    evaluation_interval_seconds: int = 60
    max_open_positions: int = 3
    max_trades_per_day: int = 10

    # ── Strategy ──────────────────────────────────────────────────
    ema_fast: int = 9
    ema_slow: int = 21
    ema_trend: int = 50
    ema_macro: int = 200
    rsi_period: int = 14
    macd_fast: int = 12
    macd_slow: int = 26
    macd_signal: int = 9
    atr_period: int = 14
    bb_period: int = 20
    bb_std: float = 2.0
    volume_ma_period: int = 20
    volume_surge_multiplier: float = 1.5
    min_confirmations: int = 3
    min_confidence: float = 0.65
    min_rr_ratio: float = 1.5
    sl_atr_multiplier: float = 1.5
    tp1_rr: float = 1.0
    tp2_rr: float = 2.0
    tp1_close_pct: float = 0.5
    bars_lookback: int = 300

    # ── Risk ──────────────────────────────────────────────────────
    risk_per_trade_pct: float = 1.5
    daily_loss_limit_pct: float = 3.0
    max_consecutive_losses: int = 3
    min_balance_usd: float = 50.0
    max_open_risk_pct: float = 5.0
    warn_reduction_factor: float = 0.85
    min_lot_reduction: float = 0.40

    # ── Market guards ─────────────────────────────────────────────
    max_spread_pct: float = 0.10
    warn_spread_pct: float = 0.05
    max_atr_spike_multiplier: float = 2.5
    min_volume_ratio: float = 0.3
    price_stale_seconds: int = 30

    # ── Cooldowns ─────────────────────────────────────────────────
    cooldown_after_trade_seconds: int = 300
    cooldown_after_loss_seconds: int = 900
    cooldown_same_direction_seconds: int = 1800
    cooldown_after_consecutive_loss_seconds: int = 3600

    # ── Trailing stop ─────────────────────────────────────────────
    trailing_stop_enabled: bool = True
    trailing_stop_activation_rr: float = 0.8
    trailing_stop_trail_atr_multiplier: float = 0.5
    trailing_stop_check_interval_seconds: int = 15

    # ── Policy ────────────────────────────────────────────────────
    policy_mode: str = "balanced"

    # ── Logging ───────────────────────────────────────────────────
    log_level: str = "INFO"
    log_dir: str = "logs"

    # ── Raw settings dict (for policy overrides) ──────────────────
    _raw: Dict[str, Any] = field(default_factory=dict, repr=False)

    def apply_policy_overrides(self) -> None:
        """Apply policy-mode-specific overrides from settings.json."""
        policy_section = self._raw.get("policy", {})
        mode = self.policy_mode
        overrides = policy_section.get(mode, {})

        for key, value in overrides.items():
            if hasattr(self, key):
                setattr(self, key, value)
                logger.debug("Policy override: %s = %s (mode=%s)", key, value, mode)

    @property
    def log_dir_path(self) -> Path:
        p = _BASE_DIR / self.log_dir
        p.mkdir(parents=True, exist_ok=True)
        return p


def load_config(env_path: Optional[str] = None) -> Config:
    """
    Load config by merging .env → settings.json → env overrides.

    Priority: env vars > settings.json > defaults.
    """
    # Load .env
    env_file = Path(env_path) if env_path else _BASE_DIR / ".env"
    if env_file.exists():
        load_dotenv(env_file)
        logger.info("Loaded .env from %s", env_file)

    # Load settings.json
    raw = _load_settings_json()

    cfg = Config(_raw=raw)

    # ── Merge settings.json into config ──────────────────────────
    _section = raw.get("trading", {})
    cfg.symbol = _section.get("symbol", cfg.symbol)
    cfg.timeframe = _section.get("timeframe", cfg.timeframe)
    cfg.evaluation_interval_seconds = _section.get("evaluation_interval_seconds", cfg.evaluation_interval_seconds)
    cfg.max_open_positions = _section.get("max_open_positions", cfg.max_open_positions)
    cfg.max_trades_per_day = _section.get("max_trades_per_day", cfg.max_trades_per_day)

    _section = raw.get("strategy", {})
    for key in (
        "ema_fast", "ema_slow", "ema_trend", "ema_macro",
        "rsi_period", "macd_fast", "macd_slow", "macd_signal",
        "atr_period", "bb_period", "bb_std", "volume_ma_period",
        "volume_surge_multiplier", "min_confirmations", "min_confidence",
        "min_rr_ratio", "sl_atr_multiplier", "tp1_rr", "tp2_rr",
        "tp1_close_pct", "bars_lookback",
    ):
        if key in _section:
            setattr(cfg, key, _section[key])

    _section = raw.get("risk", {})
    for key in (
        "risk_per_trade_pct", "daily_loss_limit_pct", "max_consecutive_losses",
        "min_balance_usd", "max_open_risk_pct", "warn_reduction_factor",
        "min_lot_reduction",
    ):
        if key in _section:
            setattr(cfg, key, _section[key])

    _section = raw.get("market_guards", {})
    for key in ("max_spread_pct", "warn_spread_pct", "max_atr_spike_multiplier",
                "min_volume_ratio", "price_stale_seconds"):
        if key in _section:
            setattr(cfg, key, _section[key])

    _section = raw.get("cooldowns", {})
    _cd_mapping = {
        "after_trade_seconds": "cooldown_after_trade_seconds",
        "after_loss_seconds": "cooldown_after_loss_seconds",
        "same_direction_seconds": "cooldown_same_direction_seconds",
        "after_consecutive_loss_seconds": "cooldown_after_consecutive_loss_seconds",
    }
    for json_key, attr_key in _cd_mapping.items():
        if json_key in _section:
            setattr(cfg, attr_key, _section[json_key])

    _section = raw.get("trailing_stop", {})
    _ts_mapping = {
        "enabled": "trailing_stop_enabled",
        "activation_rr": "trailing_stop_activation_rr",
        "trail_atr_multiplier": "trailing_stop_trail_atr_multiplier",
        "check_interval_seconds": "trailing_stop_check_interval_seconds",
    }
    for json_key, attr_key in _ts_mapping.items():
        if json_key in _section:
            setattr(cfg, attr_key, _section[json_key])

    _section = raw.get("policy", {})
    cfg.policy_mode = _section.get("active_mode", cfg.policy_mode)

    # ── Environment variable overrides (highest priority) ────────
    cfg.exchange_id = os.getenv("EXCHANGE_ID", cfg.exchange_id)
    cfg.api_key = os.getenv("EXCHANGE_API_KEY", cfg.api_key)
    cfg.api_secret = os.getenv("EXCHANGE_API_SECRET", cfg.api_secret)
    cfg.dry_run = os.getenv("DRY_RUN", "true").lower() in ("true", "1", "yes")
    cfg.symbol = os.getenv("SYMBOL", cfg.symbol)
    cfg.timeframe = os.getenv("TIMEFRAME", cfg.timeframe)
    cfg.log_level = os.getenv("LOG_LEVEL", cfg.log_level)
    cfg.log_dir = os.getenv("LOG_DIR", cfg.log_dir)

    # Apply policy overrides
    cfg.apply_policy_overrides()

    logger.info(
        "Config loaded: exchange=%s symbol=%s timeframe=%s dry_run=%s policy=%s",
        cfg.exchange_id, cfg.symbol, cfg.timeframe, cfg.dry_run, cfg.policy_mode,
    )

    return cfg


# ── Singleton ─────────────────────────────────────────────────────
_config: Optional[Config] = None


def get_config(force_reload: bool = False) -> Config:
    """Get or create the singleton config instance."""
    global _config
    if _config is None or force_reload:
        _config = load_config()
    return _config
