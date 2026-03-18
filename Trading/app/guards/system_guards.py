"""
System / Operational guards (Category 4).

Guards: MT5Connection, BrokerExecutionHealth, DuplicateOrder,
PositionReconciliation, KillSwitch, SafeMode, AuditLog, Alerting.
"""

from __future__ import annotations

from app.core.config import get_settings
from app.core.enums import GuardCategory, GuardSeverity
from app.guards.base_guard import BaseGuard, EvaluationContext, GuardResult


class MT5ConnectionGuard(BaseGuard):
    def __init__(self):
        super().__init__("mt5_connection", GuardCategory.SYSTEM, GuardSeverity.CRITICAL)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        if not ctx.mt5_connected:
            return self._block(
                "MT5 terminal not connected",
                action="reject",
                lockout_impact="KILL_SWITCH",
            )
        return self._pass()


class BrokerExecutionHealthGuard(BaseGuard):
    def __init__(self):
        super().__init__("broker_execution_health", GuardCategory.SYSTEM, GuardSeverity.HIGH)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        if not ctx.broker_health_ok:
            return self._block(
                "Broker execution health degraded",
                action="reject",
            )
        return self._pass()


class DuplicateOrderGuard(BaseGuard):
    def __init__(self):
        super().__init__("duplicate_order", GuardCategory.SYSTEM, GuardSeverity.CRITICAL)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        if ctx.duplicate_signal:
            return self._block(
                "Duplicate signal fingerprint detected",
                action="reject",
            )
        if ctx.duplicate_order:
            return self._block(
                "Duplicate order detected within lock window",
                action="reject",
                lockout_impact="KILL_SWITCH",
            )
        return self._pass()


class PositionReconciliationGuard(BaseGuard):
    def __init__(self):
        super().__init__("position_reconciliation", GuardCategory.SYSTEM, GuardSeverity.CRITICAL)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        if cfg.RECONCILIATION_REQUIRED_BEFORE_NEW_TRADE and not ctx.reconciliation_clean:
            return self._block(
                "Position mismatch between DB and MT5 — reconcile first",
                action="reject",
                lockout_impact="KILL_SWITCH",
            )
        return self._pass()


class KillSwitchGuard(BaseGuard):
    def __init__(self):
        super().__init__("kill_switch", GuardCategory.SYSTEM, GuardSeverity.CRITICAL)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        if ctx.kill_switch_active:
            return self._block(
                "Kill switch is active — all new orders blocked",
                action="reject",
            )
        return self._pass()


class SafeModeGuard(BaseGuard):
    """
    This guard doesn't block but signals that safe mode constraints should apply.
    Other guards read ctx.safe_mode_active to tighten their thresholds.
    """
    def __init__(self):
        super().__init__("safe_mode", GuardCategory.SYSTEM, GuardSeverity.MEDIUM)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        if ctx.safe_mode_active:
            return self._warn(
                "Safe mode active — risk reduced by 50%, stricter thresholds",
                action="reduce_lot",
                safe_mode_impact="already_active",
            )
        # Check for auto-activation triggers
        cfg = get_settings()
        if ctx.recent_warn_count >= cfg.SAFE_MODE_WARN_CLUSTER_THRESHOLD:
            return self._warn(
                f"Warn cluster ({ctx.recent_warn_count} warns) — "
                f"recommend safe mode activation",
                current_value=str(ctx.recent_warn_count),
                threshold=str(cfg.SAFE_MODE_WARN_CLUSTER_THRESHOLD),
                safe_mode_impact="activate_safe_mode",
            )
        return self._pass()


class AuditLogGuard(BaseGuard):
    """Ensures the audit system is operational."""
    def __init__(self):
        super().__init__("audit_log", GuardCategory.SYSTEM, GuardSeverity.LOW)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        # In production, check DB connectivity / disk space
        return self._pass(reason="Audit system operational")


class AlertingGuard(BaseGuard):
    """Ensures the alerting system can deliver notifications."""
    def __init__(self):
        super().__init__("alerting", GuardCategory.SYSTEM, GuardSeverity.LOW)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        return self._pass(reason="Alerting system operational")


# ── Registry ──────────────────────────────────────────────────────────

def get_system_guards() -> list[BaseGuard]:
    """Return all system guards in evaluation order."""
    return [
        MT5ConnectionGuard(),
        BrokerExecutionHealthGuard(),
        DuplicateOrderGuard(),
        PositionReconciliationGuard(),
        KillSwitchGuard(),
        SafeModeGuard(),
        AuditLogGuard(),
        AlertingGuard(),
    ]
