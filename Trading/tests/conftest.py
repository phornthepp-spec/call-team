"""
Shared test fixtures for the XAUUSD Full-Auto Trading System.

Uses monkeypatch to override get_settings() so tests use predictable defaults
without needing a real .env or settings.json.
"""

from __future__ import annotations

import os
import pytest

# Ensure simulation mode for tests
os.environ.setdefault("MT5_SIMULATION_MODE", "true")
os.environ.setdefault("MT5_LOGIN", "0")
os.environ.setdefault("MT5_PASSWORD", "")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///test.db")

from app.core.config import AppSettings
from app.core.enums import GuardCategory, GuardSeverity, GuardStatus
from app.guards.base_guard import EvaluationContext, GuardResult
from app.schemas.broker import BrokerSymbolConfig


@pytest.fixture
def default_settings() -> AppSettings:
    """Return default settings with known values for deterministic testing."""
    return AppSettings(
        POLICY_MODE="strict",
        DAILY_LOSS_LIMIT_PCT=1.0,
        WEEKLY_LOSS_LIMIT_PCT=2.5,
        MONTHLY_LOSS_LIMIT_PCT=6.0,
        MAX_RISK_PER_TRADE_PCT=0.25,
        MAX_OPEN_RISK_PCT=1.0,
        MAX_TRADES_PER_DAY=3,
        MAX_CONSECUTIVE_LOSSES=2,
        MAX_SIMULTANEOUS_POSITIONS=1,
        MAX_POSITION_SIZE_LOT=0.05,
        MIN_FREE_MARGIN_PCT=300.0,
        HARD_MIN_MARGIN_LEVEL_PCT=200.0,
        INTRADAY_DRAWDOWN_LIMIT_PCT=1.25,
        WARN_SPREAD_POINTS=22.0,
        MAX_SPREAD_POINTS=30.0,
        WARN_SLIPPAGE_POINTS=12.0,
        MAX_SLIPPAGE_POINTS=20.0,
        ATR_VOLATILITY_MULTIPLIER_MAX=2.0,
        MIN_RR=1.8,
        MIN_AI_CONFIDENCE=0.70,
        WARN_AI_CONFIDENCE=0.78,
        MIN_CONFIRMATIONS_REQUIRED=3,
        COOLDOWN_AFTER_TRADE_MINUTES=10,
        COOLDOWN_AFTER_LOSS_MINUTES=20,
        MAX_TRADES_PER_HOUR=1,
        SAFE_MODE_RISK_MULTIPLIER=0.5,
        SAFE_MODE_WARN_CLUSTER_THRESHOLD=5,
    )


@pytest.fixture
def clean_ctx() -> EvaluationContext:
    """An evaluation context where everything is healthy/passing."""
    return EvaluationContext(
        # Account — healthy
        balance=10_000.0,
        equity=10_000.0,
        margin=0.0,
        free_margin=10_000.0,
        margin_level=0.0,
        open_positions_count=0,
        # Daily — clean
        daily_loss_pct=0.0,
        daily_trades_taken=0,
        daily_consecutive_losses=0,
        daily_profit_r=0.0,
        daily_locked=False,
        # Weekly / monthly — clean
        weekly_loss_pct=0.0,
        weekly_locked=False,
        monthly_loss_pct=0.0,
        monthly_locked=False,
        # Open risk
        open_risk_pct=0.0,
        # Signal — decent quality
        signal_side="BUY",
        entry_price=3000.0,
        stop_loss=2990.0,
        take_profit=3020.0,
        rr_ratio=2.0,
        confidence=0.85,
        confirmation_count=4,
        strategy_name="trend_breakout",
        # Market — normal
        bid=3000.0,
        ask=3000.20,
        spread_points=20.0,
        atr=5.0,
        atr_baseline=5.0,
        recent_candle_range=3.0,
        avg_candle_range=3.0,
        current_session="London",
        market_regime="TRENDING_UP",
        volatility_state="NORMAL",
        is_rollover_window=False,
        # System — healthy
        mt5_connected=True,
        broker_health_ok=True,
        reconciliation_clean=True,
        kill_switch_active=False,
        safe_mode_active=False,
        duplicate_signal=False,
        duplicate_order=False,
        # History — no recent activity
        last_trade_timestamp=None,
        last_loss_timestamp=None,
        trades_this_hour=0,
        recent_loss_streak=0,
        recent_warn_count=0,
        recent_slippage_avg=0.0,
        features_available=True,
        feature_latency_ms=0,
    )


@pytest.fixture
def xauusd_symbol() -> BrokerSymbolConfig:
    """Standard XAUUSD symbol config."""
    return BrokerSymbolConfig(
        canonical_symbol="XAUUSD",
        broker_symbol="XAUUSD",
        aliases=["XAUUSD", "GOLD"],
        contract_size=100.0,
        volume_min=0.01,
        volume_max=100.0,
        volume_step=0.01,
        point=0.01,
        digits=2,
        stop_level=0,
        freeze_level=0,
    )


def make_guard_result(
    name: str = "test_guard",
    status: GuardStatus = GuardStatus.PASS,
    category: GuardCategory = GuardCategory.ACCOUNT,
    severity: GuardSeverity = GuardSeverity.MEDIUM,
    reason: str = "test",
    **kwargs,
) -> GuardResult:
    """Helper to quickly create GuardResult for tests."""
    return GuardResult(
        guard_name=name,
        category=category,
        status=status,
        severity=severity,
        reason=reason,
        **kwargs,
    )
