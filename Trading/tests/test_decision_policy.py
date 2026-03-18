"""
Tests for the decision policy engine.

Covers:
- All three policy modes (strict / normal / safe)
- BLOCK → always REJECT
- WARN handling per mode
- Lot reduction factor computation
- Warn cluster threshold
- Safe mode auto-activation
"""

from __future__ import annotations

import pytest
from unittest.mock import patch

from app.core.enums import FinalDecision, GuardCategory, GuardSeverity, GuardStatus, PolicyMode
from app.engine.decision_policy import (
    _compute_reduction_factor,
    collect_lockout_impacts,
    evaluate_decision,
    should_auto_enter_safe_mode,
)
from app.guards.base_guard import GuardResult


# ── Helpers ────────────────────────────────────────────────────────

def _gr(name: str, status: GuardStatus, **kw) -> GuardResult:
    return GuardResult(
        guard_name=name,
        category=GuardCategory.ACCOUNT,
        status=status,
        severity=GuardSeverity.MEDIUM,
        reason=f"{name} test",
        **kw,
    )


def _block(name: str, **kw) -> GuardResult:
    return _gr(name, GuardStatus.BLOCK, **kw)


def _warn(name: str, **kw) -> GuardResult:
    return _gr(name, GuardStatus.WARN, **kw)


def _pass(name: str) -> GuardResult:
    return _gr(name, GuardStatus.PASS)


# ── BLOCK handling ─────────────────────────────────────────────────

class TestBlockHandling:
    """Any BLOCK should always result in REJECT regardless of mode."""

    @pytest.mark.parametrize("mode", [PolicyMode.STRICT, PolicyMode.NORMAL, PolicyMode.SAFE])
    def test_single_block_rejects(self, mode):
        results = [_pass("a"), _block("daily_loss_limit"), _pass("b")]
        decision, reason, factor = evaluate_decision(results, mode)
        assert decision == FinalDecision.REJECT
        assert "daily_loss_limit" in reason
        assert factor is None

    def test_multiple_blocks_all_listed(self):
        results = [_block("kill_switch"), _block("mt5_connection")]
        decision, reason, _ = evaluate_decision(results, PolicyMode.STRICT)
        assert decision == FinalDecision.REJECT
        assert "kill_switch" in reason
        assert "mt5_connection" in reason


# ── All pass ───────────────────────────────────────────────────────

class TestAllPass:
    @pytest.mark.parametrize("mode", [PolicyMode.STRICT, PolicyMode.NORMAL, PolicyMode.SAFE])
    def test_all_pass_approves(self, mode):
        results = [_pass("a"), _pass("b"), _pass("c")]
        decision, reason, factor = evaluate_decision(results, mode)
        assert decision == FinalDecision.APPROVE
        assert factor is None


# ── STRICT mode ────────────────────────────────────────────────────

class TestStrictMode:
    def test_non_reducible_warn_rejects(self):
        """WARN on non-reducible guard → REJECT in strict mode."""
        results = [_pass("a"), _warn("overtrading")]
        decision, _, _ = evaluate_decision(results, PolicyMode.STRICT)
        assert decision == FinalDecision.REJECT

    def test_reducible_warn_reduces(self):
        """WARN on reducible guard → REDUCE in strict mode."""
        results = [_pass("a"), _warn("max_spread")]
        decision, _, factor = evaluate_decision(results, PolicyMode.STRICT)
        assert decision == FinalDecision.REDUCE
        assert factor is not None
        assert 0 < factor <= 1.0

    def test_mixed_reducible_warns(self):
        """Multiple reducible WARNs → compound reduction."""
        results = [_warn("max_spread"), _warn("volatility")]
        decision, _, factor = evaluate_decision(results, PolicyMode.STRICT)
        assert decision == FinalDecision.REDUCE
        assert factor < 0.85  # More than 1 WARN


# ── NORMAL mode ────────────────────────────────────────────────────

class TestNormalMode:
    def test_single_warn_reduces(self):
        results = [_pass("a"), _warn("confidence")]
        decision, _, factor = evaluate_decision(results, PolicyMode.NORMAL)
        assert decision == FinalDecision.REDUCE
        assert factor is not None

    @patch("app.engine.decision_policy.get_settings")
    def test_warn_cluster_rejects(self, mock_settings):
        """Too many WARNs in normal mode → REJECT."""
        mock_cfg = type("S", (), {"SAFE_MODE_WARN_CLUSTER_THRESHOLD": 3})()
        mock_settings.return_value = mock_cfg
        results = [_warn("a"), _warn("b"), _warn("c")]
        decision, reason, _ = evaluate_decision(results, PolicyMode.NORMAL)
        assert decision == FinalDecision.REJECT
        assert "cluster" in reason.lower() or "exceed" in reason.lower()


# ── SAFE mode ──────────────────────────────────────────────────────

class TestSafeMode:
    def test_non_reducible_warn_rejects(self):
        results = [_warn("overtrading")]
        decision, _, _ = evaluate_decision(results, PolicyMode.SAFE)
        assert decision == FinalDecision.REJECT

    def test_three_or_more_warns_rejects(self):
        results = [_warn("max_spread"), _warn("volatility"), _warn("confidence")]
        decision, _, _ = evaluate_decision(results, PolicyMode.SAFE)
        assert decision == FinalDecision.REJECT

    def test_single_reducible_warn_reduces_aggressively(self):
        results = [_warn("max_spread")]
        decision, _, factor = evaluate_decision(results, PolicyMode.SAFE)
        assert decision == FinalDecision.REDUCE
        # Safe mode applies 0.5 multiplier on top
        expected = 0.85 * 0.5
        assert factor == pytest.approx(expected, rel=0.01)


# ── Reduction factor ──────────────────────────────────────────────

class TestReductionFactor:
    def test_one_warn(self):
        assert _compute_reduction_factor([_warn("a")]) == pytest.approx(0.85)

    def test_two_warns(self):
        assert _compute_reduction_factor([_warn("a"), _warn("b")]) == pytest.approx(0.85 * 0.85)

    def test_minimum_floor(self):
        """Many WARNs should floor at 0.40."""
        warns = [_warn(f"g{i}") for i in range(20)]
        factor = _compute_reduction_factor(warns)
        assert factor == pytest.approx(0.40)


# ── Safe mode auto-activation ─────────────────────────────────────

class TestAutoSafeMode:
    def test_explicit_impact(self):
        results = [_pass("a"), _warn("vol", safe_mode_impact="activate_safe_mode")]
        assert should_auto_enter_safe_mode(results) is True

    @patch("app.engine.decision_policy.get_settings")
    def test_warn_cluster_triggers(self, mock_settings):
        mock_cfg = type("S", (), {"SAFE_MODE_WARN_CLUSTER_THRESHOLD": 3})()
        mock_settings.return_value = mock_cfg
        results = [_warn("a"), _warn("b"), _warn("c")]
        assert should_auto_enter_safe_mode(results) is True

    @patch("app.engine.decision_policy.get_settings")
    def test_no_trigger_below_threshold(self, mock_settings):
        mock_cfg = type("S", (), {"SAFE_MODE_WARN_CLUSTER_THRESHOLD": 5})()
        mock_settings.return_value = mock_cfg
        results = [_warn("a"), _pass("b")]
        assert should_auto_enter_safe_mode(results) is False


# ── Lockout impact collection ─────────────────────────────────────

class TestLockoutImpacts:
    def test_collects_from_blocks(self):
        results = [
            _block("daily_loss_limit", lockout_impact="DAILY"),
            _block("mt5_connection", lockout_impact="KILL_SWITCH"),
            _warn("vol", lockout_impact="SAFE_MODE"),
            _pass("ok"),
        ]
        impacts = collect_lockout_impacts(results)
        assert "DAILY" in impacts
        assert "KILL_SWITCH" in impacts
        assert "SAFE_MODE" not in impacts  # WARN not collected
