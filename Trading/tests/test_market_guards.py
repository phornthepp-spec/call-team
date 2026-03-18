"""
Tests for market/execution risk guards.

Covers: MaxSpread, MaxSlippage, Volatility, Session, PriceIntegrity.
"""

from __future__ import annotations

import time

import pytest
from unittest.mock import patch

from app.core.enums import GuardStatus
from app.guards.base_guard import EvaluationContext


@pytest.fixture(autouse=True)
def mock_settings():
    cfg = type("Settings", (), {
        "WARN_SPREAD_POINTS": 22.0,
        "MAX_SPREAD_POINTS": 30.0,
        "WARN_SLIPPAGE_POINTS": 12.0,
        "MAX_SLIPPAGE_POINTS": 20.0,
        "ATR_VOLATILITY_MULTIPLIER_MAX": 2.0,
        "CANDLE_RANGE_SPIKE_MULTIPLIER": 2.5,
        "ALLOWED_SESSIONS": ["London", "NewYorkOverlap"],
        "BLOCK_ROLLOVER_WINDOW": True,
        "ROLLOVER_BLOCK_MINUTES": 30,
        "NEWS_BLOCK_BEFORE_MINUTES": 30,
        "NEWS_BLOCK_AFTER_MINUTES": 15,
        "PRICE_FEED_FRESH_SECONDS": 3,
    })()
    with patch("app.guards.market_guards.get_settings", return_value=cfg):
        yield cfg


# ── MaxSpreadGuard ─────────────────────────────────────────────────

class TestMaxSpreadGuard:
    def test_passes_normal_spread(self, clean_ctx):
        from app.guards.market_guards import MaxSpreadGuard
        clean_ctx.spread_points = 15.0
        guard = MaxSpreadGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_pass

    def test_warns_elevated_spread(self, clean_ctx):
        from app.guards.market_guards import MaxSpreadGuard
        clean_ctx.spread_points = 25.0  # > 22 warn
        guard = MaxSpreadGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_warn

    def test_blocks_extreme_spread(self, clean_ctx):
        from app.guards.market_guards import MaxSpreadGuard
        clean_ctx.spread_points = 35.0  # > 30 max
        guard = MaxSpreadGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block

    def test_blocks_zero_spread_anomaly(self, clean_ctx):
        from app.guards.market_guards import MaxSpreadGuard
        clean_ctx.spread_points = 0.0
        guard = MaxSpreadGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block

    def test_blocks_negative_spread(self, clean_ctx):
        from app.guards.market_guards import MaxSpreadGuard
        clean_ctx.spread_points = -1.0
        guard = MaxSpreadGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block


# ── MaxSlippageGuard ───────────────────────────────────────────────

class TestMaxSlippageGuard:
    def test_passes_no_slippage(self, clean_ctx):
        from app.guards.market_guards import MaxSlippageGuard
        clean_ctx.recent_slippage_avg = 0.0
        guard = MaxSlippageGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_pass

    def test_warns_elevated_slippage(self, clean_ctx):
        from app.guards.market_guards import MaxSlippageGuard
        clean_ctx.recent_slippage_avg = 15.0  # > 12 warn
        guard = MaxSlippageGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_warn

    def test_blocks_extreme_slippage(self, clean_ctx):
        from app.guards.market_guards import MaxSlippageGuard
        clean_ctx.recent_slippage_avg = 25.0  # > 20 max
        guard = MaxSlippageGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block

    def test_slippage_block_triggers_safe_mode(self, clean_ctx):
        from app.guards.market_guards import MaxSlippageGuard
        clean_ctx.recent_slippage_avg = 25.0
        guard = MaxSlippageGuard()
        result = guard.evaluate(clean_ctx)
        assert result.safe_mode_impact == "activate_safe_mode"


# ── VolatilityGuard ───────────────────────────────────────────────

class TestVolatilityGuard:
    def test_passes_normal_volatility(self, clean_ctx):
        from app.guards.market_guards import VolatilityGuard
        clean_ctx.atr = 5.0
        clean_ctx.atr_baseline = 5.0
        guard = VolatilityGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_pass

    def test_blocks_atr_spike(self, clean_ctx):
        from app.guards.market_guards import VolatilityGuard
        clean_ctx.atr = 12.0
        clean_ctx.atr_baseline = 5.0  # ratio = 2.4 > 2.0
        guard = VolatilityGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block

    def test_passes_no_baseline(self, clean_ctx):
        from app.guards.market_guards import VolatilityGuard
        clean_ctx.atr_baseline = 0.0
        guard = VolatilityGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_pass


# ── SessionGuard ──────────────────────────────────────────────────

class TestSessionGuard:
    def test_passes_allowed_session(self, clean_ctx):
        from app.guards.market_guards import SessionGuard
        clean_ctx.current_session = "London"
        guard = SessionGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_pass

    def test_blocks_off_hours(self, clean_ctx):
        from app.guards.market_guards import SessionGuard
        clean_ctx.current_session = "OffHours"
        guard = SessionGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block

    def test_blocks_rollover(self, clean_ctx):
        from app.guards.market_guards import SessionGuard
        clean_ctx.is_rollover_window = True
        guard = SessionGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block


# ── PriceIntegrityGuard ───────────────────────────────────────────

class TestPriceIntegrityGuard:
    def test_passes_fresh_price(self, clean_ctx):
        from app.guards.market_guards import PriceIntegrityGuard
        clean_ctx.tick_time = time.time()
        clean_ctx.bid = 3000.0
        clean_ctx.ask = 3000.20
        guard = PriceIntegrityGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_pass

    def test_blocks_stale_price(self, clean_ctx):
        from app.guards.market_guards import PriceIntegrityGuard
        clean_ctx.tick_time = time.time() - 10  # 10 seconds old
        clean_ctx.bid = 3000.0
        clean_ctx.ask = 3000.20
        guard = PriceIntegrityGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block

    def test_blocks_inverted_price(self, clean_ctx):
        from app.guards.market_guards import PriceIntegrityGuard
        clean_ctx.tick_time = time.time()
        clean_ctx.bid = 3001.0
        clean_ctx.ask = 3000.0  # ask < bid = inverted
        guard = PriceIntegrityGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block
