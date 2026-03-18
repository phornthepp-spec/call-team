"""
Strategy Guards — validate signal quality and enforce cooldowns.

Guards:
- confidence: Minimum confidence threshold
- rr_ratio: Minimum risk-reward ratio
- confirmations: Minimum confirmation count
- cooldown_after_trade: Enforce pause between trades
- cooldown_after_loss: Enforce longer pause after a loss
- same_direction: Prevent rapid same-direction re-entry
"""

from __future__ import annotations

import time
from typing import List

from crypto_bot.config import get_config
from crypto_bot.guards.base_guard import BaseGuard, EvaluationContext, GuardResult


class ConfidenceGuard(BaseGuard):
    """Blocks signals below minimum confidence."""

    def __init__(self):
        super().__init__("confidence", "STRATEGY", "MEDIUM")

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_config()
        if ctx.confidence < cfg.min_confidence:
            return self._block(
                f"Confidence {ctx.confidence:.3f} < min {cfg.min_confidence}",
                current_value=f"{ctx.confidence:.3f}",
                threshold=str(cfg.min_confidence),
            )
        # Warn if borderline
        if ctx.confidence < cfg.min_confidence * 1.15:
            return self._warn(
                f"Confidence {ctx.confidence:.3f} marginally above min {cfg.min_confidence}",
            )
        return self._pass(f"Confidence: {ctx.confidence:.3f}")


class RRRatioGuard(BaseGuard):
    """Blocks signals with insufficient risk-reward ratio."""

    def __init__(self):
        super().__init__("rr_ratio", "STRATEGY", "HIGH")

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_config()
        if ctx.rr_ratio < cfg.min_rr_ratio:
            return self._block(
                f"R:R ratio {ctx.rr_ratio:.2f} < min {cfg.min_rr_ratio}",
                current_value=f"{ctx.rr_ratio:.2f}",
                threshold=str(cfg.min_rr_ratio),
            )
        return self._pass(f"R:R ratio: {ctx.rr_ratio:.2f}")


class ConfirmationCountGuard(BaseGuard):
    """Warns when confirmation count is below optimal."""

    def __init__(self):
        super().__init__("confirmation_count", "STRATEGY", "LOW")

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_config()
        if ctx.confirmation_count < cfg.min_confirmations:
            return self._block(
                f"Confirmations {ctx.confirmation_count} < min {cfg.min_confirmations}",
                current_value=str(ctx.confirmation_count),
                threshold=str(cfg.min_confirmations),
            )
        if ctx.confirmation_count == cfg.min_confirmations:
            return self._warn(
                f"Confirmations {ctx.confirmation_count} at minimum threshold",
            )
        return self._pass(f"Confirmations: {ctx.confirmation_count}")


class CooldownAfterTradeGuard(BaseGuard):
    """Enforces pause between trades to avoid overtrading."""

    def __init__(self):
        super().__init__("cooldown_after_trade", "STRATEGY", "MEDIUM")

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_config()
        if ctx.last_trade_timestamp is None:
            return self._pass("No previous trade")

        elapsed = time.time() - ctx.last_trade_timestamp
        if elapsed < cfg.cooldown_after_trade_seconds:
            remaining = int(cfg.cooldown_after_trade_seconds - elapsed)
            return self._block(
                f"Cooldown active: {remaining}s remaining (min {cfg.cooldown_after_trade_seconds}s between trades)",
                current_value=f"{int(elapsed)}s",
                threshold=f"{cfg.cooldown_after_trade_seconds}s",
            )
        return self._pass(f"Last trade {int(elapsed)}s ago")


class CooldownAfterLossGuard(BaseGuard):
    """Enforces longer pause after a losing trade."""

    def __init__(self):
        super().__init__("cooldown_after_loss", "STRATEGY", "HIGH")

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_config()
        if ctx.last_loss_timestamp is None:
            return self._pass("No recent loss")

        elapsed = time.time() - ctx.last_loss_timestamp

        # Use longer cooldown after consecutive losses
        cooldown = cfg.cooldown_after_loss_seconds
        if ctx.daily_consecutive_losses >= cfg.max_consecutive_losses:
            cooldown = cfg.cooldown_after_consecutive_loss_seconds

        if elapsed < cooldown:
            remaining = int(cooldown - elapsed)
            return self._block(
                f"Loss cooldown active: {remaining}s remaining "
                f"(consecutive_losses={ctx.daily_consecutive_losses})",
                current_value=f"{int(elapsed)}s",
                threshold=f"{cooldown}s",
            )
        return self._pass(f"Last loss {int(elapsed)}s ago")


class SameDirectionGuard(BaseGuard):
    """Prevents rapid re-entry in the same direction."""

    def __init__(self):
        super().__init__("same_direction", "STRATEGY", "LOW")

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_config()
        if ctx.last_trade_direction is None or ctx.last_trade_timestamp is None:
            return self._pass("No previous trade direction")

        if ctx.signal_side == ctx.last_trade_direction:
            elapsed = time.time() - ctx.last_trade_timestamp
            if elapsed < cfg.cooldown_same_direction_seconds:
                remaining = int(cfg.cooldown_same_direction_seconds - elapsed)
                return self._warn(
                    f"Same direction ({ctx.signal_side}) re-entry: {remaining}s remaining",
                    current_value=f"{int(elapsed)}s",
                    threshold=f"{cfg.cooldown_same_direction_seconds}s",
                )
        return self._pass("Direction OK")


def get_strategy_guards() -> list[BaseGuard]:
    """Return all strategy guards in evaluation order."""
    return [
        ConfidenceGuard(),
        RRRatioGuard(),
        ConfirmationCountGuard(),
        CooldownAfterTradeGuard(),
        CooldownAfterLossGuard(),
        SameDirectionGuard(),
    ]
