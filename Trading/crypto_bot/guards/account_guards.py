"""
Account Guards — protect the trading account from excessive risk.

Guards:
- kill_switch: Hard stop for all trading
- balance_check: Minimum balance requirement
- daily_loss_limit: Stop trading when daily loss exceeds threshold
- max_open_positions: Limit concurrent positions
- max_daily_trades: Limit total trades per day
- consecutive_losses: Cooldown after losing streak
"""

from __future__ import annotations

from typing import List

from crypto_bot.config import get_config
from crypto_bot.guards.base_guard import BaseGuard, EvaluationContext, GuardResult


class KillSwitchGuard(BaseGuard):
    """Hard stop — blocks everything when kill switch is active."""

    def __init__(self):
        super().__init__("kill_switch", "SYSTEM", "CRITICAL")

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        if ctx.kill_switch_active:
            return self._block("Kill switch is ACTIVE — all trading halted")
        return self._pass("Kill switch inactive")


class ExchangeConnectionGuard(BaseGuard):
    """Ensures exchange is connected."""

    def __init__(self):
        super().__init__("exchange_connection", "SYSTEM", "CRITICAL")

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        if not ctx.exchange_connected:
            return self._block("Exchange not connected")
        return self._pass("Exchange connected")


class BalanceCheckGuard(BaseGuard):
    """Ensures minimum balance is maintained."""

    def __init__(self):
        super().__init__("balance_check", "ACCOUNT", "HIGH")

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_config()
        if ctx.balance_usd < cfg.min_balance_usd:
            return self._block(
                f"Balance ${ctx.balance_usd:.2f} below minimum ${cfg.min_balance_usd:.2f}",
                current_value=f"${ctx.balance_usd:.2f}",
                threshold=f"${cfg.min_balance_usd:.2f}",
            )
        # Warn if balance is getting low (below 2x minimum)
        if ctx.balance_usd < cfg.min_balance_usd * 2:
            return self._warn(
                f"Balance ${ctx.balance_usd:.2f} approaching minimum (${cfg.min_balance_usd:.2f})",
                current_value=f"${ctx.balance_usd:.2f}",
            )
        return self._pass(f"Balance OK: ${ctx.balance_usd:.2f}")


class DailyLossLimitGuard(BaseGuard):
    """Blocks trading when daily loss exceeds limit."""

    def __init__(self):
        super().__init__("daily_loss_limit", "ACCOUNT", "CRITICAL")

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_config()
        # daily_pnl_pct is negative when losing
        if ctx.daily_pnl_pct <= -cfg.daily_loss_limit_pct:
            return self._block(
                f"Daily loss {ctx.daily_pnl_pct:.2f}% exceeds limit -{cfg.daily_loss_limit_pct:.2f}%",
                current_value=f"{ctx.daily_pnl_pct:.2f}%",
                threshold=f"-{cfg.daily_loss_limit_pct:.2f}%",
            )
        # Warn at 70% of daily limit
        warn_threshold = -cfg.daily_loss_limit_pct * 0.7
        if ctx.daily_pnl_pct <= warn_threshold:
            return self._warn(
                f"Daily loss {ctx.daily_pnl_pct:.2f}% nearing limit (70% of -{cfg.daily_loss_limit_pct:.2f}%)",
                current_value=f"{ctx.daily_pnl_pct:.2f}%",
            )
        return self._pass(f"Daily PnL: {ctx.daily_pnl_pct:+.2f}%")


class MaxOpenPositionsGuard(BaseGuard):
    """Limits the number of concurrent open positions."""

    def __init__(self):
        super().__init__("max_open_positions", "ACCOUNT", "HIGH")

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_config()
        if ctx.open_positions_count >= cfg.max_open_positions:
            return self._block(
                f"Open positions {ctx.open_positions_count} >= max {cfg.max_open_positions}",
                current_value=str(ctx.open_positions_count),
                threshold=str(cfg.max_open_positions),
            )
        # Warn if close to limit
        if ctx.open_positions_count >= cfg.max_open_positions - 1:
            return self._warn(
                f"Open positions {ctx.open_positions_count} nearing max {cfg.max_open_positions}",
            )
        return self._pass(f"Open positions: {ctx.open_positions_count}")


class MaxDailyTradesGuard(BaseGuard):
    """Limits total trades per day."""

    def __init__(self):
        super().__init__("max_daily_trades", "ACCOUNT", "MEDIUM")

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_config()
        if ctx.daily_trades_taken >= cfg.max_trades_per_day:
            return self._block(
                f"Daily trades {ctx.daily_trades_taken} >= max {cfg.max_trades_per_day}",
                current_value=str(ctx.daily_trades_taken),
                threshold=str(cfg.max_trades_per_day),
            )
        return self._pass(f"Daily trades: {ctx.daily_trades_taken}")


class ConsecutiveLossesGuard(BaseGuard):
    """Blocks trading after too many consecutive losses."""

    def __init__(self):
        super().__init__("consecutive_losses", "ACCOUNT", "HIGH")

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_config()
        if ctx.daily_consecutive_losses >= cfg.max_consecutive_losses:
            return self._block(
                f"Consecutive losses {ctx.daily_consecutive_losses} >= max {cfg.max_consecutive_losses} — "
                f"cooldown required",
                current_value=str(ctx.daily_consecutive_losses),
                threshold=str(cfg.max_consecutive_losses),
                action="cooldown",
            )
        if ctx.daily_consecutive_losses >= cfg.max_consecutive_losses - 1:
            return self._warn(
                f"Consecutive losses {ctx.daily_consecutive_losses} — one more triggers cooldown",
            )
        return self._pass(f"Consecutive losses: {ctx.daily_consecutive_losses}")


def get_account_guards() -> List[BaseGuard]:
    """Return all account guards in evaluation order."""
    return [
        KillSwitchGuard(),
        ExchangeConnectionGuard(),
        BalanceCheckGuard(),
        DailyLossLimitGuard(),
        MaxOpenPositionsGuard(),
        MaxDailyTradesGuard(),
        ConsecutiveLossesGuard(),
    ]
