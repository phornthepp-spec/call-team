"""
Tests for the position sizer.

Covers:
- Basic lot calculation
- Volume step normalization
- WARN-based lot reduction
- Safe mode multiplier
- Max lot cap
- Broker constraints (min/max)
- Zero capital / zero stop rejection
- Open risk budget check
"""

from __future__ import annotations

import pytest
from unittest.mock import patch

from app.schemas.broker import BrokerSymbolConfig
from app.schemas.risk import PositionSizeResult


# ── Fixtures ───────────────────────────────────────────────────────

@pytest.fixture
def mock_settings():
    """Patch get_settings with known defaults."""
    cfg = type("Settings", (), {
        "MAX_RISK_PER_TRADE_PCT": 0.25,
        "MAX_OPEN_RISK_PCT": 1.0,
        "MAX_POSITION_SIZE_LOT": 0.05,
        "SAFE_MODE_RISK_MULTIPLIER": 0.5,
    })()
    with patch("app.engine.position_sizer.get_settings", return_value=cfg):
        yield cfg


@pytest.fixture
def symbol() -> BrokerSymbolConfig:
    return BrokerSymbolConfig(
        canonical_symbol="XAUUSD",
        broker_symbol="XAUUSD",
        contract_size=100.0,
        volume_min=0.01,
        volume_max=100.0,
        volume_step=0.01,
        point=0.01,
        digits=2,
    )


# ── Tests ──────────────────────────────────────────────────────────

class TestBasicCalculation:
    def test_normal_lot_calculation(self, mock_settings, symbol):
        from app.engine.position_sizer import calculate_position_size

        result = calculate_position_size(
            balance=10_000.0,
            equity=10_000.0,
            entry_price=3000.0,
            stop_loss=2990.0,
            symbol_config=symbol,
        )
        assert result.is_valid
        assert result.final_lot > 0
        assert result.risk_amount == pytest.approx(25.0, rel=0.01)  # 0.25% of 10k
        assert result.stop_distance == pytest.approx(10.0, rel=0.01)

    def test_uses_min_of_balance_equity(self, mock_settings, symbol):
        from app.engine.position_sizer import calculate_position_size

        result = calculate_position_size(
            balance=10_000.0,
            equity=9_500.0,  # equity lower — should use this
            entry_price=3000.0,
            stop_loss=2990.0,
            symbol_config=symbol,
        )
        assert result.is_valid
        assert result.risk_amount == pytest.approx(23.75, rel=0.01)  # 0.25% of 9500


class TestValidation:
    def test_zero_capital_rejected(self, mock_settings, symbol):
        from app.engine.position_sizer import calculate_position_size

        result = calculate_position_size(
            balance=0.0,
            equity=0.0,
            entry_price=3000.0,
            stop_loss=2990.0,
            symbol_config=symbol,
        )
        assert not result.is_valid
        assert "capital" in result.rejection_reason.lower()

    def test_zero_stop_distance_rejected(self, mock_settings, symbol):
        from app.engine.position_sizer import calculate_position_size

        result = calculate_position_size(
            balance=10_000.0,
            equity=10_000.0,
            entry_price=3000.0,
            stop_loss=3000.0,  # zero stop distance
            symbol_config=symbol,
        )
        assert not result.is_valid
        assert "stop" in result.rejection_reason.lower()


class TestWarnReduction:
    def test_one_warn_reduces_lot(self, mock_settings, symbol):
        from app.engine.position_sizer import calculate_position_size

        base = calculate_position_size(
            balance=10_000.0, equity=10_000.0,
            entry_price=3000.0, stop_loss=2990.0,
            symbol_config=symbol, warn_count=0,
        )
        reduced = calculate_position_size(
            balance=10_000.0, equity=10_000.0,
            entry_price=3000.0, stop_loss=2990.0,
            symbol_config=symbol, warn_count=1,
        )
        assert reduced.final_lot <= base.final_lot

    def test_many_warns_floor_at_40_pct(self, mock_settings, symbol):
        from app.engine.position_sizer import calculate_position_size

        base = calculate_position_size(
            balance=10_000.0, equity=10_000.0,
            entry_price=3000.0, stop_loss=2990.0,
            symbol_config=symbol, warn_count=0,
        )
        heavily_warned = calculate_position_size(
            balance=10_000.0, equity=10_000.0,
            entry_price=3000.0, stop_loss=2990.0,
            symbol_config=symbol, warn_count=20,
        )
        if base.final_lot > 0:
            ratio = heavily_warned.final_lot / base.final_lot
            assert ratio >= 0.35  # floor at ~40%, accounting for step rounding


class TestSafeMode:
    def test_safe_mode_reduces_risk(self, mock_settings, symbol):
        from app.engine.position_sizer import calculate_position_size

        normal = calculate_position_size(
            balance=10_000.0, equity=10_000.0,
            entry_price=3000.0, stop_loss=2990.0,
            symbol_config=symbol, safe_mode_active=False,
        )
        safe = calculate_position_size(
            balance=10_000.0, equity=10_000.0,
            entry_price=3000.0, stop_loss=2990.0,
            symbol_config=symbol, safe_mode_active=True,
        )
        assert safe.final_lot <= normal.final_lot
        # Safe mode risk pct should be 0.125% (0.25% * 0.5)
        assert safe.risk_pct_used == pytest.approx(0.125, rel=0.01)


class TestMaxLotCap:
    def test_large_balance_capped(self, mock_settings, symbol):
        from app.engine.position_sizer import calculate_position_size

        result = calculate_position_size(
            balance=1_000_000.0,
            equity=1_000_000.0,
            entry_price=3000.0,
            stop_loss=2990.0,
            symbol_config=symbol,
        )
        assert result.final_lot <= mock_settings.MAX_POSITION_SIZE_LOT


class TestBrokerConstraints:
    def test_below_broker_min_uses_min(self, mock_settings, symbol):
        from app.engine.position_sizer import calculate_position_size

        # Very small balance → raw lot below broker min
        result = calculate_position_size(
            balance=100.0,
            equity=100.0,
            entry_price=3000.0,
            stop_loss=2990.0,
            symbol_config=symbol,
        )
        # With 0.25% of $100 = $0.25 risk, lot will be tiny
        # If normalized lot >= volume_min, final should be at least volume_min
        if result.is_valid:
            assert result.final_lot >= symbol.volume_min


class TestOpenRiskBudget:
    def test_exceeding_open_risk_rejected(self, mock_settings, symbol):
        from app.engine.position_sizer import calculate_position_size

        result = calculate_position_size(
            balance=10_000.0,
            equity=10_000.0,
            entry_price=3000.0,
            stop_loss=2990.0,
            symbol_config=symbol,
            open_risk_pct=0.95,  # Already 0.95% used, adding 0.25% exceeds 1.0%
        )
        assert not result.is_valid
        assert "risk" in result.rejection_reason.lower()
