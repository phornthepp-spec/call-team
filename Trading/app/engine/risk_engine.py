"""
Risk Engine — the final authority over every trade.

Orchestrates:
1. System health checks
2. Broker / MT5 connection checks
3. Reconciliation checks
4. Kill switch check
5. Account / portfolio risk checks
6. Market condition checks
7. AI / strategy quality checks
8. Execution readiness checks
9. Position sizing
10. Re-check open risk
11. Final decision
12. (Order execution is handled by the caller)
13. Post-trade audit logging

Short-circuits immediately on any hard BLOCK.
"""

from __future__ import annotations

import logging
import time
from typing import List, Optional, Tuple

from app.core.config import get_settings
from app.core.enums import FinalDecision, GuardStatus, PolicyMode
from app.engine.decision_policy import (
    collect_lockout_impacts,
    evaluate_decision,
    should_auto_enter_safe_mode,
)
from app.engine.position_sizer import calculate_position_size
from app.guards.account_guards import get_account_guards
from app.guards.base_guard import BaseGuard, EvaluationContext, GuardResult
from app.guards.market_guards import get_market_guards
from app.guards.strategy_guards import get_strategy_guards
from app.guards.system_guards import get_system_guards
from app.schemas.broker import BrokerSymbolConfig
from app.schemas.risk import PositionSizeResult

logger = logging.getLogger(__name__)


class RiskCheckResult:
    """Complete output of a risk engine evaluation."""

    def __init__(self):
        self.guard_results: List[GuardResult] = []
        self.decision: FinalDecision = FinalDecision.REJECT
        self.decision_reason: str = ""
        self.position_size: Optional[PositionSizeResult] = None
        self.policy_mode: PolicyMode = PolicyMode.STRICT
        self.lot_reduction_factor: Optional[float] = None
        self.lockout_impacts: List[str] = []
        self.should_enter_safe_mode: bool = False
        self.execution_time_ms: int = 0
        self.pass_count: int = 0
        self.warn_count: int = 0
        self.block_count: int = 0

    @property
    def approved(self) -> bool:
        return self.decision in (FinalDecision.APPROVE, FinalDecision.REDUCE)

    @property
    def final_lot(self) -> float:
        if self.position_size and self.position_size.is_valid:
            return self.position_size.final_lot
        return 0.0


class RiskEngine:
    """
    Deterministic, rule-based risk evaluation engine.

    The AI can propose a signal, but the risk engine is always the final
    authority. Every evaluation produces a full audit trail.
    """

    def __init__(self):
        self._guards: List[BaseGuard] = []
        self._build_guard_pipeline()

    def _build_guard_pipeline(self) -> None:
        """
        Build the ordered guard pipeline.
        Order matters: system → account → market → strategy.
        """
        self._guards = (
            get_system_guards()
            + get_account_guards()
            + get_market_guards()
            + get_strategy_guards()
        )
        logger.info("Risk engine initialized with %d guards", len(self._guards))

    def evaluate(
        self,
        ctx: EvaluationContext,
        symbol_config: BrokerSymbolConfig,
        policy_mode: Optional[PolicyMode] = None,
    ) -> RiskCheckResult:
        """
        Run the full risk evaluation pipeline.

        Args:
            ctx: Pre-populated evaluation context with all required data.
            symbol_config: Broker-specific symbol constraints.
            policy_mode: Override policy mode (defaults to config).

        Returns:
            Complete RiskCheckResult with decision, guard details, and lot.
        """
        start_time = time.monotonic()
        cfg = get_settings()
        result = RiskCheckResult()
        result.policy_mode = policy_mode or PolicyMode(cfg.POLICY_MODE)

        # ── Phase 1-8: Run all guards ──────────────────────────────
        for guard in self._guards:
            guard_result = guard.evaluate(ctx)
            result.guard_results.append(guard_result)

            # Count
            if guard_result.is_pass:
                result.pass_count += 1
            elif guard_result.is_warn:
                result.warn_count += 1
            elif guard_result.is_block:
                result.block_count += 1

            # Short-circuit on CRITICAL BLOCK
            if guard_result.is_block and guard_result.severity.value in ("CRITICAL", "HIGH"):
                # Still run remaining guards for audit, but mark decision early
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

        # ── Phase 9: Position sizing ───────────────────────────────
        position_result = calculate_position_size(
            balance=ctx.balance,
            equity=ctx.equity,
            entry_price=ctx.entry_price,
            stop_loss=ctx.stop_loss,
            symbol_config=symbol_config,
            warn_count=result.warn_count,
            safe_mode_active=ctx.safe_mode_active,
            open_risk_pct=ctx.open_risk_pct,
        )
        result.position_size = position_result

        # If position sizing failed, it's a BLOCK
        if not position_result.is_valid:
            result.guard_results.append(GuardResult(
                guard_name="position_sizer",
                category="ACCOUNT",
                status=GuardStatus.BLOCK,
                severity="HIGH",
                reason=position_result.rejection_reason or "Position sizing failed",
                action="reject",
            ))
            result.block_count += 1

        # ── Phase 10: Update context with computed lot for re-check ─
        ctx.computed_lot = position_result.final_lot
        ctx.risk_per_trade_pct = position_result.risk_pct_used

        # ── Phase 11: Final decision ───────────────────────────────
        decision, reason, reduction_factor = evaluate_decision(
            result.guard_results, result.policy_mode
        )
        result.decision = decision
        result.decision_reason = reason
        result.lot_reduction_factor = reduction_factor

        # Apply reduction factor to lot if REDUCE
        if decision == FinalDecision.REDUCE and reduction_factor is not None:
            import math
            vol_step = symbol_config.volume_step
            reduced = position_result.final_lot * reduction_factor
            reduced = math.floor(reduced / vol_step) * vol_step
            reduced = round(reduced, 8)
            if reduced < symbol_config.volume_min:
                result.decision = FinalDecision.REJECT
                result.decision_reason += f" | Reduced lot {reduced} below minimum"
            else:
                position_result.final_lot = reduced

        # ── Lockout / safe mode impacts ────────────────────────────
        result.lockout_impacts = collect_lockout_impacts(result.guard_results)
        result.should_enter_safe_mode = should_auto_enter_safe_mode(result.guard_results)

        # ── Timing ─────────────────────────────────────────────────
        result.execution_time_ms = int((time.monotonic() - start_time) * 1000)

        logger.info(
            "RISK ENGINE: decision=%s mode=%s guards=%d "
            "pass=%d warn=%d block=%d lot=%.4f time=%dms | %s",
            result.decision.value,
            result.policy_mode.value,
            len(result.guard_results),
            result.pass_count,
            result.warn_count,
            result.block_count,
            result.final_lot,
            result.execution_time_ms,
            result.decision_reason[:200],
        )

        return result
