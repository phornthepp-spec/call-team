"""
Tests for account/portfolio risk guards.

Covers: DailyLossLimit, WeeklyLossLimit, MonthlyLossLimit,
MaxTradesPerDay, MaxConsecutiveLosses, MaxSimultaneousPositions,
MarginSafety.
"""

from __future__ import annotations

import pytest
from unittest.mock import patch

from app.core.enums import GuardStatus
from app.guards.base_guard import EvaluationContext


# ── Shared settings mock ──────────────────────────────────────────

@pytest.fixture(autouse=True)
def mock_settings():
    cfg = type("Settings", (), {
        "DAILY_LOSS_LIMIT_PCT": 1.0,
        "WEEKLY_LOSS_LIMIT_PCT": 2.5,
        "MONTHLY_LOSS_LIMIT_PCT": 6.0,
        "MAX_RISK_PER_TRADE_PCT": 0.25,
        "MAX_OPEN_RISK_PCT": 1.0,
        "MAX_TRADES_PER_DAY": 3,
        "MAX_CONSECUTIVE_LOSSES": 2,
        "MAX_SIMULTANEOUS_POSITIONS": 1,
        "MAX_POSITION_SIZE_LOT": 0.05,
        "MIN_FREE_MARGIN_PCT": 300.0,
        "HARD_MIN_MARGIN_LEVEL_PCT": 200.0,
        "INTRADAY_DRAWDOWN_LIMIT_PCT": 1.25,
        "PROFIT_LOCK_TRIGGER_R": 1.5,
        "STOP_TRADING_AFTER_PROFIT_R": 2.0,
    })()
    with patch("app.guards.account_guards.get_settings", return_value=cfg):
        yield cfg


# ── DailyLossLimitGuard ───────────────────────────────────────────

class TestDailyLossLimitGuard:
    def test_passes_when_no_loss(self, clean_ctx):
        from app.guards.account_guards import DailyLossLimitGuard
        guard = DailyLossLimitGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_pass

    def test_blocks_when_at_limit(self, clean_ctx):
        from app.guards.account_guards import DailyLossLimitGuard
        clean_ctx.daily_loss_pct = 1.0  # exactly at 1%
        guard = DailyLossLimitGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block

    def test_blocks_when_over_limit(self, clean_ctx):
        from app.guards.account_guards import DailyLossLimitGuard
        clean_ctx.daily_loss_pct = 1.5
        guard = DailyLossLimitGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block

    def test_warns_when_approaching_limit(self, clean_ctx):
        from app.guards.account_guards import DailyLossLimitGuard
        clean_ctx.daily_loss_pct = 0.85  # 85% of 1.0 → above 80% threshold
        guard = DailyLossLimitGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_warn

    def test_blocks_when_already_locked(self, clean_ctx):
        from app.guards.account_guards import DailyLossLimitGuard
        clean_ctx.daily_locked = True
        clean_ctx.daily_loss_pct = 0.5
        guard = DailyLossLimitGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block

    def test_has_lockout_impact(self, clean_ctx):
        from app.guards.account_guards import DailyLossLimitGuard
        clean_ctx.daily_loss_pct = 1.5
        guard = DailyLossLimitGuard()
        result = guard.evaluate(clean_ctx)
        assert result.lockout_impact == "DAILY"


# ── WeeklyLossLimitGuard ──────────────────────────────────────────

class TestWeeklyLossLimitGuard:
    def test_passes_under_limit(self, clean_ctx):
        from app.guards.account_guards import WeeklyLossLimitGuard
        guard = WeeklyLossLimitGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_pass

    def test_blocks_at_limit(self, clean_ctx):
        from app.guards.account_guards import WeeklyLossLimitGuard
        clean_ctx.weekly_loss_pct = 2.5
        guard = WeeklyLossLimitGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block


# ── MonthlyLossLimitGuard ─────────────────────────────────────────

class TestMonthlyLossLimitGuard:
    def test_blocks_at_limit(self, clean_ctx):
        from app.guards.account_guards import MonthlyLossLimitGuard
        clean_ctx.monthly_loss_pct = 6.0
        guard = MonthlyLossLimitGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block


# ── MaxTradesPerDayGuard ──────────────────────────────────────────

class TestMaxTradesPerDayGuard:
    def test_passes_under_limit(self, clean_ctx):
        from app.guards.account_guards import MaxTradesPerDayGuard
        clean_ctx.daily_trades_taken = 2
        guard = MaxTradesPerDayGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_pass

    def test_blocks_at_limit(self, clean_ctx):
        from app.guards.account_guards import MaxTradesPerDayGuard
        clean_ctx.daily_trades_taken = 3
        guard = MaxTradesPerDayGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block


# ── MaxConsecutiveLossesGuard ─────────────────────────────────────

class TestMaxConsecutiveLossesGuard:
    def test_passes_under_limit(self, clean_ctx):
        from app.guards.account_guards import MaxConsecutiveLossesGuard
        clean_ctx.daily_consecutive_losses = 1
        guard = MaxConsecutiveLossesGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_pass

    def test_blocks_at_limit(self, clean_ctx):
        from app.guards.account_guards import MaxConsecutiveLossesGuard
        clean_ctx.daily_consecutive_losses = 2
        guard = MaxConsecutiveLossesGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block


# ── MaxSimultaneousPositionsGuard ─────────────────────────────────

class TestMaxSimultaneousPositionsGuard:
    def test_passes_when_no_positions(self, clean_ctx):
        from app.guards.account_guards import MaxSimultaneousPositionsGuard
        guard = MaxSimultaneousPositionsGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_pass

    def test_blocks_when_at_limit(self, clean_ctx):
        from app.guards.account_guards import MaxSimultaneousPositionsGuard
        clean_ctx.open_positions_count = 1  # max is 1
        guard = MaxSimultaneousPositionsGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block
