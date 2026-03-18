"""
Tests for system/operational guards.

Covers: MT5Connection, DuplicateOrder, PositionReconciliation,
KillSwitch, SafeMode.
"""

from __future__ import annotations

import pytest
from unittest.mock import patch

from app.core.enums import GuardStatus
from app.guards.base_guard import EvaluationContext


@pytest.fixture(autouse=True)
def mock_settings():
    cfg = type("Settings", (), {
        "MT5_CONNECTION_REQUIRED": True,
        "RECONCILIATION_REQUIRED_BEFORE_NEW_TRADE": True,
        "DUPLICATE_ORDER_LOCK_WINDOW_SECONDS": 10,
        "SAFE_MODE_MAX_TRADES_PER_DAY": 1,
        "SAFE_MODE_MIN_CONFIDENCE": 0.82,
        "SAFE_MODE_MIN_RR": 2.5,
    })()
    with patch("app.guards.system_guards.get_settings", return_value=cfg):
        yield cfg


# ── MT5ConnectionGuard ─────────────────────────────────────────────

class TestMT5ConnectionGuard:
    def test_passes_when_connected(self, clean_ctx):
        from app.guards.system_guards import MT5ConnectionGuard
        guard = MT5ConnectionGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_pass

    def test_blocks_when_disconnected(self, clean_ctx):
        from app.guards.system_guards import MT5ConnectionGuard
        clean_ctx.mt5_connected = False
        guard = MT5ConnectionGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block
        assert result.lockout_impact == "KILL_SWITCH"


# ── DuplicateOrderGuard ───────────────────────────────────────────

class TestDuplicateOrderGuard:
    def test_passes_no_duplicate(self, clean_ctx):
        from app.guards.system_guards import DuplicateOrderGuard
        guard = DuplicateOrderGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_pass

    def test_blocks_duplicate_signal(self, clean_ctx):
        from app.guards.system_guards import DuplicateOrderGuard
        clean_ctx.duplicate_signal = True
        guard = DuplicateOrderGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block

    def test_blocks_duplicate_order(self, clean_ctx):
        from app.guards.system_guards import DuplicateOrderGuard
        clean_ctx.duplicate_order = True
        guard = DuplicateOrderGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block
        assert result.lockout_impact == "KILL_SWITCH"


# ── PositionReconciliationGuard ───────────────────────────────────

class TestPositionReconciliationGuard:
    def test_passes_when_clean(self, clean_ctx):
        from app.guards.system_guards import PositionReconciliationGuard
        guard = PositionReconciliationGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_pass

    def test_blocks_when_mismatch(self, clean_ctx):
        from app.guards.system_guards import PositionReconciliationGuard
        clean_ctx.reconciliation_clean = False
        guard = PositionReconciliationGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block


# ── KillSwitchGuard ───────────────────────────────────────────────

class TestKillSwitchGuard:
    def test_passes_when_off(self, clean_ctx):
        from app.guards.system_guards import KillSwitchGuard
        guard = KillSwitchGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_pass

    def test_blocks_when_active(self, clean_ctx):
        from app.guards.system_guards import KillSwitchGuard
        clean_ctx.kill_switch_active = True
        guard = KillSwitchGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_block


# ── SafeModeGuard ─────────────────────────────────────────────────

class TestSafeModeGuard:
    def test_passes_when_off(self, clean_ctx):
        from app.guards.system_guards import SafeModeGuard
        guard = SafeModeGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_pass

    def test_warns_when_active(self, clean_ctx):
        from app.guards.system_guards import SafeModeGuard
        clean_ctx.safe_mode_active = True
        guard = SafeModeGuard()
        result = guard.evaluate(clean_ctx)
        assert result.is_warn


# ── Integration: guard verdicts are deterministic ─────────────────

class TestGuardDeterminism:
    """Same input → same output, always."""

    def test_same_input_same_output(self, clean_ctx):
        from app.guards.system_guards import KillSwitchGuard, MT5ConnectionGuard

        guards = [KillSwitchGuard(), MT5ConnectionGuard()]
        results_1 = [g.evaluate(clean_ctx) for g in guards]
        results_2 = [g.evaluate(clean_ctx) for g in guards]

        for r1, r2 in zip(results_1, results_2):
            assert r1.status == r2.status
            assert r1.guard_name == r2.guard_name
