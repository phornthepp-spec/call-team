"""
Strategy / AI decision guards (Category 3).

Guards: MinRR, Confidence, SignalConfirmation, Cooldown,
ReEntry, Overtrading, StrategyDrift, FeatureAvailability.
"""

from __future__ import annotations

import time

from app.core.config import get_settings
from app.core.enums import GuardCategory, GuardSeverity
from app.guards.base_guard import BaseGuard, EvaluationContext, GuardResult


class MinRRGuard(BaseGuard):
    def __init__(self):
        super().__init__("min_rr", GuardCategory.STRATEGY, GuardSeverity.HIGH)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        min_rr = cfg.SAFE_MODE_MIN_RR if ctx.safe_mode_active else cfg.MIN_RR
        if ctx.rr_ratio < min_rr:
            return self._block(
                f"RR ratio {ctx.rr_ratio:.2f} < minimum {min_rr}",
                current_value=f"{ctx.rr_ratio:.2f}",
                threshold=f"{min_rr}",
                action="reject",
            )
        return self._pass(current_value=f"{ctx.rr_ratio:.2f}", threshold=f"{min_rr}")


class ConfidenceGuard(BaseGuard):
    def __init__(self):
        super().__init__("confidence", GuardCategory.STRATEGY, GuardSeverity.HIGH)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        min_conf = cfg.SAFE_MODE_MIN_CONFIDENCE if ctx.safe_mode_active else cfg.MIN_AI_CONFIDENCE
        warn_conf = cfg.WARN_AI_CONFIDENCE

        if ctx.confidence < min_conf:
            return self._block(
                f"Confidence {ctx.confidence:.2f} < minimum {min_conf}",
                current_value=f"{ctx.confidence:.2f}",
                threshold=f"{min_conf}",
                action="reject",
            )
        if ctx.confidence < warn_conf and not ctx.safe_mode_active:
            return self._warn(
                f"Confidence {ctx.confidence:.2f} < warn threshold {warn_conf}",
                current_value=f"{ctx.confidence:.2f}",
                threshold=f"{warn_conf}",
                action="reduce_lot",
            )
        return self._pass(
            current_value=f"{ctx.confidence:.2f}",
            threshold=f"min={min_conf} / warn={warn_conf}",
        )


class SignalConfirmationGuard(BaseGuard):
    def __init__(self):
        super().__init__("signal_confirmation", GuardCategory.STRATEGY, GuardSeverity.MEDIUM)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        required = cfg.MIN_CONFIRMATIONS_REQUIRED
        if ctx.confirmation_count < required:
            return self._block(
                f"Confirmations {ctx.confirmation_count} < required {required}",
                current_value=str(ctx.confirmation_count),
                threshold=str(required),
                action="reject",
            )
        return self._pass(
            current_value=str(ctx.confirmation_count),
            threshold=str(required),
        )


class CooldownGuard(BaseGuard):
    def __init__(self):
        super().__init__("cooldown", GuardCategory.STRATEGY, GuardSeverity.MEDIUM)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        now = time.time()

        if ctx.last_trade_timestamp is not None:
            # Longer cooldown after a loss
            cooldown_min = (
                cfg.COOLDOWN_AFTER_LOSS_MINUTES
                if ctx.last_trade_was_loss
                else cfg.COOLDOWN_AFTER_TRADE_MINUTES
            )
            elapsed_min = (now - ctx.last_trade_timestamp) / 60.0
            if elapsed_min < cooldown_min:
                return self._block(
                    f"Cooldown: {elapsed_min:.1f}m since last trade "
                    f"(required {cooldown_min}m"
                    f"{' after loss' if ctx.last_trade_was_loss else ''})",
                    current_value=f"{elapsed_min:.1f}m",
                    threshold=f"{cooldown_min}m",
                    action="reject",
                )

        return self._pass()


class ReEntryGuard(BaseGuard):
    def __init__(self):
        super().__init__("re_entry", GuardCategory.STRATEGY, GuardSeverity.MEDIUM)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        now = time.time()

        if (
            ctx.last_trade_timestamp is not None
            and ctx.last_trade_was_loss
            and ctx.last_trade_direction == ctx.signal_side
        ):
            elapsed_min = (now - ctx.last_trade_timestamp) / 60.0
            block_min = cfg.REENTRY_BLOCK_SAME_DIRECTION_MINUTES
            if elapsed_min < block_min:
                return self._block(
                    f"Same-direction re-entry after stop-out blocked: "
                    f"{elapsed_min:.1f}m < {block_min}m",
                    current_value=f"{elapsed_min:.1f}m",
                    threshold=f"{block_min}m",
                    action="reject",
                )
        return self._pass()


class OvertradingGuard(BaseGuard):
    def __init__(self):
        super().__init__("overtrading", GuardCategory.STRATEGY, GuardSeverity.MEDIUM)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        if ctx.trades_this_hour >= cfg.MAX_TRADES_PER_HOUR:
            return self._block(
                f"Trades this hour {ctx.trades_this_hour} >= max {cfg.MAX_TRADES_PER_HOUR}",
                current_value=str(ctx.trades_this_hour),
                threshold=str(cfg.MAX_TRADES_PER_HOUR),
                action="reject",
            )
        return self._pass(
            current_value=str(ctx.trades_this_hour),
            threshold=str(cfg.MAX_TRADES_PER_HOUR),
        )


class StrategyDriftGuard(BaseGuard):
    def __init__(self):
        super().__init__("strategy_drift", GuardCategory.STRATEGY, GuardSeverity.HIGH)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        if ctx.recent_loss_streak >= cfg.STRATEGY_DRIFT_LOSS_STREAK_LIMIT:
            return self._block(
                f"Loss streak {ctx.recent_loss_streak} >= drift limit "
                f"{cfg.STRATEGY_DRIFT_LOSS_STREAK_LIMIT}",
                current_value=str(ctx.recent_loss_streak),
                threshold=str(cfg.STRATEGY_DRIFT_LOSS_STREAK_LIMIT),
                action="reject",
                safe_mode_impact="activate_safe_mode",
            )
        if ctx.recent_expectancy < cfg.STRATEGY_DRIFT_EXPECTANCY_THRESHOLD:
            return self._warn(
                f"Recent expectancy {ctx.recent_expectancy:.3f} below threshold "
                f"{cfg.STRATEGY_DRIFT_EXPECTANCY_THRESHOLD}",
                current_value=f"{ctx.recent_expectancy:.3f}",
                threshold=f"{cfg.STRATEGY_DRIFT_EXPECTANCY_THRESHOLD}",
                action="reduce_lot",
                safe_mode_impact="activate_safe_mode",
            )
        return self._pass(current_value=f"streak={ctx.recent_loss_streak}")


class FeatureAvailabilityGuard(BaseGuard):
    def __init__(self):
        super().__init__("feature_availability", GuardCategory.STRATEGY, GuardSeverity.HIGH)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        if not ctx.features_available:
            return self._block(
                "Required features unavailable or timed out",
                action="reject",
            )
        if ctx.feature_latency_ms > cfg.FEATURE_TIMEOUT_SECONDS * 1000:
            return self._block(
                f"Feature latency {ctx.feature_latency_ms}ms > timeout "
                f"{cfg.FEATURE_TIMEOUT_SECONDS * 1000}ms",
                current_value=f"{ctx.feature_latency_ms}ms",
                threshold=f"{cfg.FEATURE_TIMEOUT_SECONDS * 1000}ms",
                action="reject",
            )
        if ctx.model_latency_ms and ctx.model_latency_ms > cfg.FEATURE_TIMEOUT_SECONDS * 1000:
            return self._warn(
                f"Model latency {ctx.model_latency_ms}ms high",
                current_value=f"{ctx.model_latency_ms}ms",
                action="reduce_lot",
            )
        return self._pass()


# ── Registry ──────────────────────────────────────────────────────────

def get_strategy_guards() -> list[BaseGuard]:
    return [
        MinRRGuard(),
        ConfidenceGuard(),
        SignalConfirmationGuard(),
        CooldownGuard(),
        ReEntryGuard(),
        OvertradingGuard(),
        StrategyDriftGuard(),
        FeatureAvailabilityGuard(),
    ]
