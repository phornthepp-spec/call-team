"""
Account / Portfolio risk guards (Category 1).

Guards: DailyLossLimit, WeeklyLossLimit, MonthlyLossLimit, MaxRiskPerTrade,
MaxOpenRisk, MaxTradesPerDay, MaxConsecutiveLosses, MaxSimultaneousPositions,
PositionSizeCap, MarginSafety, EquityDrawdown, ProfitLock.
"""

from __future__ import annotations

from app.core.config import get_settings
from app.core.enums import GuardCategory, GuardSeverity
from app.guards.base_guard import BaseGuard, EvaluationContext, GuardResult


class DailyLossLimitGuard(BaseGuard):
    def __init__(self):
        super().__init__("daily_loss_limit", GuardCategory.ACCOUNT, GuardSeverity.CRITICAL)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        limit = cfg.DAILY_LOSS_LIMIT_PCT
        if ctx.daily_locked:
            return self._block(
                f"Daily lockout already active",
                current_value=f"{ctx.daily_loss_pct:.2f}%",
                threshold=f"{limit}%",
                action="reject",
                lockout_impact="DAILY",
            )
        if ctx.daily_loss_pct >= limit:
            return self._block(
                f"Daily loss {ctx.daily_loss_pct:.2f}% >= limit {limit}%",
                current_value=f"{ctx.daily_loss_pct:.2f}%",
                threshold=f"{limit}%",
                action="reject + lockout",
                lockout_impact="DAILY",
            )
        if ctx.daily_loss_pct >= limit * 0.8:
            return self._warn(
                f"Daily loss {ctx.daily_loss_pct:.2f}% approaching limit {limit}%",
                current_value=f"{ctx.daily_loss_pct:.2f}%",
                threshold=f"{limit}%",
                action="reduce_lot",
            )
        return self._pass(
            current_value=f"{ctx.daily_loss_pct:.2f}%",
            threshold=f"{limit}%",
        )


class WeeklyLossLimitGuard(BaseGuard):
    def __init__(self):
        super().__init__("weekly_loss_limit", GuardCategory.ACCOUNT, GuardSeverity.CRITICAL)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        limit = cfg.WEEKLY_LOSS_LIMIT_PCT
        if ctx.weekly_locked:
            return self._block("Weekly lockout already active",
                               lockout_impact="WEEKLY")
        if ctx.weekly_loss_pct >= limit:
            return self._block(
                f"Weekly loss {ctx.weekly_loss_pct:.2f}% >= limit {limit}%",
                current_value=f"{ctx.weekly_loss_pct:.2f}%",
                threshold=f"{limit}%",
                action="reject",
                lockout_impact="WEEKLY",
            )
        return self._pass(
            current_value=f"{ctx.weekly_loss_pct:.2f}%",
            threshold=f"{limit}%",
        )


class MonthlyLossLimitGuard(BaseGuard):
    def __init__(self):
        super().__init__("monthly_loss_limit", GuardCategory.ACCOUNT, GuardSeverity.CRITICAL)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        limit = cfg.MONTHLY_LOSS_LIMIT_PCT
        if ctx.monthly_locked:
            return self._block("Monthly lockout already active",
                               lockout_impact="MONTHLY")
        if ctx.monthly_loss_pct >= limit:
            return self._block(
                f"Monthly loss {ctx.monthly_loss_pct:.2f}% >= limit {limit}%",
                current_value=f"{ctx.monthly_loss_pct:.2f}%",
                threshold=f"{limit}%",
                action="reject",
                lockout_impact="MONTHLY",
            )
        return self._pass(
            current_value=f"{ctx.monthly_loss_pct:.2f}%",
            threshold=f"{limit}%",
        )


class MaxRiskPerTradeGuard(BaseGuard):
    def __init__(self):
        super().__init__("max_risk_per_trade", GuardCategory.ACCOUNT, GuardSeverity.HIGH)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        limit = cfg.MAX_RISK_PER_TRADE_PCT
        actual = ctx.risk_per_trade_pct
        if actual > limit:
            return self._block(
                f"Risk per trade {actual:.3f}% > limit {limit}%",
                current_value=f"{actual:.3f}%",
                threshold=f"{limit}%",
                action="reject",
            )
        return self._pass(current_value=f"{actual:.3f}%", threshold=f"{limit}%")


class MaxOpenRiskGuard(BaseGuard):
    def __init__(self):
        super().__init__("max_open_risk", GuardCategory.ACCOUNT, GuardSeverity.HIGH)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        limit = cfg.MAX_OPEN_RISK_PCT
        if ctx.open_risk_pct > limit:
            return self._block(
                f"Open risk {ctx.open_risk_pct:.2f}% > limit {limit}%",
                current_value=f"{ctx.open_risk_pct:.2f}%",
                threshold=f"{limit}%",
                action="reject",
            )
        return self._pass(
            current_value=f"{ctx.open_risk_pct:.2f}%",
            threshold=f"{limit}%",
        )


class MaxTradesPerDayGuard(BaseGuard):
    def __init__(self):
        super().__init__("max_trades_per_day", GuardCategory.ACCOUNT, GuardSeverity.HIGH)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        limit = cfg.SAFE_MODE_MAX_TRADES_PER_DAY if ctx.safe_mode_active else cfg.MAX_TRADES_PER_DAY
        if ctx.daily_trades_taken >= limit:
            return self._block(
                f"Trades today {ctx.daily_trades_taken} >= limit {limit}",
                current_value=str(ctx.daily_trades_taken),
                threshold=str(limit),
                action="reject",
                lockout_impact="DAILY",
            )
        return self._pass(
            current_value=str(ctx.daily_trades_taken),
            threshold=str(limit),
        )


class MaxConsecutiveLossesGuard(BaseGuard):
    def __init__(self):
        super().__init__("max_consecutive_losses", GuardCategory.ACCOUNT, GuardSeverity.HIGH)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        limit = cfg.MAX_CONSECUTIVE_LOSSES
        if ctx.daily_consecutive_losses >= limit:
            return self._block(
                f"Consecutive losses {ctx.daily_consecutive_losses} >= limit {limit}",
                current_value=str(ctx.daily_consecutive_losses),
                threshold=str(limit),
                action="reject + lockout",
                lockout_impact="DAILY",
            )
        return self._pass(
            current_value=str(ctx.daily_consecutive_losses),
            threshold=str(limit),
        )


class MaxSimultaneousPositionsGuard(BaseGuard):
    def __init__(self):
        super().__init__("max_simultaneous_positions", GuardCategory.ACCOUNT, GuardSeverity.HIGH)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        limit = cfg.MAX_SIMULTANEOUS_POSITIONS
        if ctx.open_positions_count >= limit:
            return self._block(
                f"Open positions {ctx.open_positions_count} >= limit {limit}",
                current_value=str(ctx.open_positions_count),
                threshold=str(limit),
                action="reject",
            )
        return self._pass(
            current_value=str(ctx.open_positions_count),
            threshold=str(limit),
        )


class PositionSizeCapGuard(BaseGuard):
    def __init__(self):
        super().__init__("position_size_cap", GuardCategory.ACCOUNT, GuardSeverity.MEDIUM)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        limit = cfg.MAX_POSITION_SIZE_LOT
        if ctx.computed_lot > limit:
            return self._block(
                f"Lot size {ctx.computed_lot:.4f} > cap {limit}",
                current_value=f"{ctx.computed_lot:.4f}",
                threshold=f"{limit}",
                action="reject",
            )
        return self._pass(
            current_value=f"{ctx.computed_lot:.4f}",
            threshold=f"{limit}",
        )


class MarginSafetyGuard(BaseGuard):
    def __init__(self):
        super().__init__("margin_safety", GuardCategory.ACCOUNT, GuardSeverity.CRITICAL)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        if ctx.equity <= 0 or ctx.balance <= 0:
            return self._block("Zero or negative equity/balance", action="reject")

        # Hard margin level check
        if ctx.margin_level > 0 and ctx.margin_level < cfg.HARD_MIN_MARGIN_LEVEL_PCT:
            return self._block(
                f"Margin level {ctx.margin_level:.1f}% < hard minimum {cfg.HARD_MIN_MARGIN_LEVEL_PCT}%",
                current_value=f"{ctx.margin_level:.1f}%",
                threshold=f"{cfg.HARD_MIN_MARGIN_LEVEL_PCT}%",
                action="reject",
                lockout_impact="KILL_SWITCH",
            )

        # Free margin safety
        free_margin_pct = (ctx.free_margin / ctx.equity * 100) if ctx.equity > 0 else 0
        if free_margin_pct < cfg.MIN_FREE_MARGIN_PCT / 2:
            return self._block(
                f"Free margin {free_margin_pct:.1f}% critically low",
                current_value=f"{free_margin_pct:.1f}%",
                threshold=f"{cfg.MIN_FREE_MARGIN_PCT}%",
                action="reject",
            )
        if free_margin_pct < cfg.MIN_FREE_MARGIN_PCT:
            return self._warn(
                f"Free margin {free_margin_pct:.1f}% < safety threshold {cfg.MIN_FREE_MARGIN_PCT}%",
                current_value=f"{free_margin_pct:.1f}%",
                threshold=f"{cfg.MIN_FREE_MARGIN_PCT}%",
                action="reduce_lot",
            )
        return self._pass(
            current_value=f"{free_margin_pct:.1f}%",
            threshold=f"{cfg.MIN_FREE_MARGIN_PCT}%",
        )


class EquityDrawdownGuard(BaseGuard):
    def __init__(self):
        super().__init__("equity_drawdown", GuardCategory.ACCOUNT, GuardSeverity.HIGH)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        limit = cfg.INTRADAY_DRAWDOWN_LIMIT_PCT
        if ctx.daily_loss_pct >= limit:
            return self._block(
                f"Intraday drawdown {ctx.daily_loss_pct:.2f}% >= limit {limit}%",
                current_value=f"{ctx.daily_loss_pct:.2f}%",
                threshold=f"{limit}%",
                action="reject + lockout",
                lockout_impact="DAILY",
            )
        return self._pass(
            current_value=f"{ctx.daily_loss_pct:.2f}%",
            threshold=f"{limit}%",
        )


class ProfitLockGuard(BaseGuard):
    def __init__(self):
        super().__init__("profit_lock", GuardCategory.ACCOUNT, GuardSeverity.MEDIUM)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        stop_r = cfg.STOP_TRADING_AFTER_PROFIT_R
        lock_r = cfg.PROFIT_LOCK_TRIGGER_R
        if ctx.daily_profit_r >= stop_r:
            return self._block(
                f"Daily profit {ctx.daily_profit_r:.1f}R >= stop-trading threshold {stop_r}R",
                current_value=f"{ctx.daily_profit_r:.1f}R",
                threshold=f"{stop_r}R",
                action="reject + daily lockout",
                lockout_impact="PROFIT_LOCK",
            )
        if ctx.daily_profit_r >= lock_r:
            return self._warn(
                f"Daily profit {ctx.daily_profit_r:.1f}R >= profit-lock trigger {lock_r}R — tighten stops",
                current_value=f"{ctx.daily_profit_r:.1f}R",
                threshold=f"{lock_r}R",
                action="reduce_lot",
                safe_mode_impact="activate_profit_lock",
            )
        return self._pass(
            current_value=f"{ctx.daily_profit_r:.1f}R",
            threshold=f"{lock_r}R / {stop_r}R",
        )


# ── Registry ──────────────────────────────────────────────────────────

def get_account_guards() -> list[BaseGuard]:
    """Return all account/portfolio guards in evaluation order."""
    return [
        DailyLossLimitGuard(),
        WeeklyLossLimitGuard(),
        MonthlyLossLimitGuard(),
        MaxRiskPerTradeGuard(),
        MaxOpenRiskGuard(),
        MaxTradesPerDayGuard(),
        MaxConsecutiveLossesGuard(),
        MaxSimultaneousPositionsGuard(),
        PositionSizeCapGuard(),
        MarginSafetyGuard(),
        EquityDrawdownGuard(),
        ProfitLockGuard(),
    ]
