"""
Decision policy engine.

Evaluates the aggregated guard results and produces a final APPROVE / REJECT /
REDUCE decision based on the active policy mode (strict / normal / safe).
"""

from __future__ import annotations

import logging
from typing import List, Optional, Tuple

from app.core.config import get_settings
from app.core.enums import FinalDecision, GuardStatus, PolicyMode
from app.guards.base_guard import GuardResult

logger = logging.getLogger(__name__)

# Guards that always cause hard BLOCK regardless of mode
HARD_BLOCK_GUARDS = frozenset({
    "kill_switch",
    "mt5_connection",
    "duplicate_order",
    "position_reconciliation",
    "price_integrity",
    "margin_safety",          # when severity is CRITICAL
    "daily_loss_limit",
    "weekly_loss_limit",
    "monthly_loss_limit",
})

# Guards whose WARN can reduce lot size (not reject)
LOT_REDUCIBLE_GUARDS = frozenset({
    "max_spread",
    "max_slippage",
    "volatility",
    "confidence",
    "strategy_drift",
    "liquidity",
    "margin_safety",          # when WARN (not BLOCK)
    "profit_lock",
    "safe_mode",
    "market_regime",
    "feature_availability",
})


def evaluate_decision(
    guard_results: List[GuardResult],
    policy_mode: PolicyMode,
) -> Tuple[FinalDecision, str, Optional[float]]:
    """
    Produce final decision from guard results.

    Returns:
        (decision, reason, lot_reduction_factor)
        lot_reduction_factor is None if not REDUCE, else 0.0-1.0.
    """
    blocks = [g for g in guard_results if g.is_block]
    warns = [g for g in guard_results if g.is_warn]

    # ── Any BLOCK => always reject ─────────────────────────────────
    if blocks:
        block_names = [b.guard_name for b in blocks]
        reasons = "; ".join(f"{b.guard_name}: {b.reason}" for b in blocks)
        logger.warning(
            "DECISION REJECT: %d BLOCK(s) [%s]", len(blocks), ", ".join(block_names)
        )
        return (FinalDecision.REJECT, reasons, None)

    # ── No blocks — evaluate WARNs by policy mode ──────────────────
    if not warns:
        return (FinalDecision.APPROVE, "All guards passed", None)

    warn_names = [w.guard_name for w in warns]

    if policy_mode == PolicyMode.STRICT:
        # In strict mode, configurable: reject if any WARN on non-lot-reducible guard
        non_reducible_warns = [w for w in warns if w.guard_name not in LOT_REDUCIBLE_GUARDS]
        if non_reducible_warns:
            reasons = "; ".join(f"{w.guard_name}: {w.reason}" for w in non_reducible_warns)
            return (
                FinalDecision.REJECT,
                f"Strict mode: non-reducible WARN(s): {reasons}",
                None,
            )
        # Reducible WARNs → reduce lot
        factor = _compute_reduction_factor(warns)
        reasons = "; ".join(f"{w.guard_name}: {w.reason}" for w in warns)
        return (
            FinalDecision.REDUCE,
            f"Strict mode: {len(warns)} WARN(s) → lot reduced: {reasons}",
            factor,
        )

    elif policy_mode == PolicyMode.NORMAL:
        # Normal mode: WARNs reduce lot, multiple WARNs compound
        factor = _compute_reduction_factor(warns)
        reasons = "; ".join(f"{w.guard_name}: {w.reason}" for w in warns)

        # If too many WARNs, reject instead
        cfg = get_settings()
        if len(warns) >= cfg.SAFE_MODE_WARN_CLUSTER_THRESHOLD:
            return (
                FinalDecision.REJECT,
                f"Normal mode: {len(warns)} WARNs exceed cluster threshold",
                None,
            )

        return (
            FinalDecision.REDUCE,
            f"Normal mode: {len(warns)} WARN(s) → lot reduced: {reasons}",
            factor,
        )

    elif policy_mode == PolicyMode.SAFE:
        # Safe mode: reject borderline signals, only pass strong signals
        non_reducible_warns = [w for w in warns if w.guard_name not in LOT_REDUCIBLE_GUARDS]
        if non_reducible_warns:
            reasons = "; ".join(f"{w.guard_name}: {w.reason}" for w in non_reducible_warns)
            return (
                FinalDecision.REJECT,
                f"Safe mode: rejecting borderline signal: {reasons}",
                None,
            )
        if len(warns) >= 3:
            return (
                FinalDecision.REJECT,
                f"Safe mode: {len(warns)} WARNs — too many for safe mode",
                None,
            )
        factor = _compute_reduction_factor(warns) * 0.5  # extra aggressive in safe mode
        reasons = "; ".join(f"{w.guard_name}: {w.reason}" for w in warns)
        return (
            FinalDecision.REDUCE,
            f"Safe mode: {len(warns)} WARN(s) → aggressive lot reduction: {reasons}",
            factor,
        )

    # Fallback
    return (FinalDecision.REJECT, "Unknown policy mode", None)


def _compute_reduction_factor(warns: List[GuardResult]) -> float:
    """
    Compute lot reduction factor from WARN count.

    Each WARN reduces by 15%, compounding. Minimum 40% of original lot.
    """
    factor = 1.0
    for _ in warns:
        factor *= 0.85
    return max(factor, 0.40)


def should_auto_enter_safe_mode(guard_results: List[GuardResult]) -> bool:
    """Check if guard results recommend auto-activating safe mode."""
    for g in guard_results:
        if g.safe_mode_impact == "activate_safe_mode":
            return True
    cfg = get_settings()
    warn_count = sum(1 for g in guard_results if g.is_warn)
    return warn_count >= cfg.SAFE_MODE_WARN_CLUSTER_THRESHOLD


def collect_lockout_impacts(guard_results: List[GuardResult]) -> List[str]:
    """Collect all lockout impacts triggered by BLOCKing guards."""
    impacts = []
    for g in guard_results:
        if g.is_block and g.lockout_impact:
            impacts.append(g.lockout_impact)
    return impacts
