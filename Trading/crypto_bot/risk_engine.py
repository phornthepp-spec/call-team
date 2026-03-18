"""
Risk Engine — the final authority over every trade.

Orchestrates:
1. Guard pipeline: Account → Market → Strategy
2. Short-circuits on CRITICAL BLOCKs
3. Position sizing
4. Final decision: APPROVE / REDUCE / REJECT
"""

from __future__ import annotations

import logging
import time
from enum import Enum
from typing import List, Optional, Tuple

from crypto_bot.config import get_config
from crypto_bot.guards.account_guards import get_account_guards
from crypto_bot.guards.base_guard import BaseGuard, EvaluationContext, GuardResult, GuardStatus
from crypto_bot.guards.market_guards import get_market_guards
from crypto_bot.guards.strategy_guards import get_strategy_guards

logger = logging.getLogger(__name__)


class FinalDecision(Enum):
    APPROVE = "APPROVE"
    REDUCE = "REDUCE"
    REJECT = "REJECT"


class RiskCheckResult:
    """Complete output of a risk engine evaluation."""

    def __init__(self):
        self.guard_results: List[GuardResult] = []
        self.decision: FinalDecision = FinalDecision.REJECT
        self.decision_reason: str = ""
        self.position_amount: float = 0.0
        self.lot_reduction_factor: Optional[float] = None
        self.execution_time_ms: int = 0
        self.pass_count: int = 0
        self.warn_count: int = 0
        self.block_count: int = 0

    @property
    def approved(self) -> bool:
        return self.decision in (FinalDecision.APPROVE, FinalDecision.REDUCE)


class RiskEngine:
    """
    Deterministic, rule-based risk engine.

    The signal generator can propose a trade, but the risk engine is
    ALWAYS the final authority. Every evaluation produces a full audit trail.
    """

    def __init__(self):
        self._guards: List[BaseGuard] = []
        self._build_guard_pipeline()

    def _build_guard_pipeline(self) -> None:
        """Build ordered guard pipeline: system/account → market → strategy."""
        self._guards = (
            get_account_guards()
            + get_market_guards()
            + get_strategy_guards()
        )
        logger.info("Risk engine initialized with %d guards", len(self._guards))

    def evaluate(self, ctx: EvaluationContext) -> RiskCheckResult:
        """
        Run the full risk evaluation pipeline.

        Returns a complete RiskCheckResult with decision and audit trail.
        """
        start_time = time.monotonic()
        result = RiskCheckResult()

        # ── Phase 1: Run all guards ───────────────────────────────
        for guard in self._guards:
            guard_result = guard.evaluate(ctx)
            result.guard_results.append(guard_result)

            if guard_result.is_pass:
                result.pass_count += 1
            elif guard_result.is_warn:
                result.warn_count += 1
            elif guard_result.is_block:
                result.block_count += 1

            # Short-circuit on CRITICAL BLOCK — still run remaining for audit
            if guard_result.is_block and guard_result.severity in ("CRITICAL", "HIGH"):
                remaining = self._guards[self._guards.index(guard) + 1:]
                for rg in remaining:
                    rr = rg.evaluate(ctx)
                    result.guard_results.append(rr)
                    if rr.is_pass:
                        result.pass_count += 1
                    elif rr.is_warn:
                        result.warn_count += 1
                    elif rr.is_block:
                        result.block_count += 1
                break

        # ── Phase 2: Final decision ───────────────────────────────
        decision, reason, reduction = self._evaluate_decision(result.guard_results)
        result.decision = decision
        result.decision_reason = reason
        result.lot_reduction_factor = reduction

        # ── Timing ────────────────────────────────────────────────
        result.execution_time_ms = int((time.monotonic() - start_time) * 1000)

        logger.info(
            "RISK ENGINE: decision=%s guards=%d pass=%d warn=%d block=%d "
            "time=%dms | %s",
            result.decision.value,
            len(result.guard_results),
            result.pass_count,
            result.warn_count,
            result.block_count,
            result.execution_time_ms,
            result.decision_reason[:200],
        )

        return result

    def _evaluate_decision(
        self,
        guard_results: List[GuardResult],
    ) -> Tuple[FinalDecision, str, Optional[float]]:
        """
        Produce final decision from guard results.

        Returns: (decision, reason, lot_reduction_factor)
        """
        cfg = get_config()
        blocks = [g for g in guard_results if g.is_block]
        warns = [g for g in guard_results if g.is_warn]

        # ── Any BLOCK → always reject ────────────────────────────
        if blocks:
            reasons = "; ".join(f"{b.guard_name}: {b.reason}" for b in blocks)
            return (FinalDecision.REJECT, reasons, None)

        # ── No blocks — evaluate WARNs ────────────────────────────
        if not warns:
            return (FinalDecision.APPROVE, "All guards passed", None)

        # Policy-based WARN handling
        mode = cfg.policy_mode

        if mode == "conservative":
            # Conservative: reject any WARN
            if warns:
                reasons = "; ".join(f"{w.guard_name}: {w.reason}" for w in warns)
                return (
                    FinalDecision.REJECT,
                    f"Conservative mode: {len(warns)} WARN(s): {reasons}",
                    None,
                )

        elif mode == "aggressive":
            # Aggressive: reduce lot on WARNs, only reject on 4+ WARNs
            if len(warns) >= 4:
                reasons = "; ".join(f"{w.guard_name}: {w.reason}" for w in warns)
                return (
                    FinalDecision.REJECT,
                    f"Aggressive mode: {len(warns)} WARNs too many",
                    None,
                )
            factor = self._compute_reduction_factor(warns)
            reasons = "; ".join(f"{w.guard_name}: {w.reason}" for w in warns)
            return (
                FinalDecision.REDUCE,
                f"Aggressive mode: {len(warns)} WARN(s) → lot reduced: {reasons}",
                factor,
            )

        else:
            # Balanced (default): reduce lot, reject on 3+ WARNs
            if len(warns) >= 3:
                reasons = "; ".join(f"{w.guard_name}: {w.reason}" for w in warns)
                return (
                    FinalDecision.REJECT,
                    f"Balanced mode: {len(warns)} WARNs exceed threshold",
                    None,
                )
            factor = self._compute_reduction_factor(warns)
            reasons = "; ".join(f"{w.guard_name}: {w.reason}" for w in warns)
            return (
                FinalDecision.REDUCE,
                f"Balanced mode: {len(warns)} WARN(s) → lot reduced: {reasons}",
                factor,
            )

    @staticmethod
    def _compute_reduction_factor(warns: List[GuardResult]) -> float:
        """
        Compute lot reduction factor from WARN count.

        Each WARN reduces by 15%, compounding. Minimum 40% of original.
        """
        cfg = get_config()
        factor = 1.0
        for _ in warns:
            factor *= cfg.warn_reduction_factor
        return max(factor, cfg.min_lot_reduction)
