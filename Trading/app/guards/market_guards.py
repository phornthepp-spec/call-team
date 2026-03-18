"""
Market / Execution risk guards (Category 2).

Guards: MaxSpread, MaxSlippage, Volatility, Session, News,
MarketRegime, PriceIntegrity, Liquidity, OrderRetry.
"""

from __future__ import annotations

import time

from app.core.config import get_settings
from app.core.enums import GuardCategory, GuardSeverity
from app.guards.base_guard import BaseGuard, EvaluationContext, GuardResult


class MaxSpreadGuard(BaseGuard):
    def __init__(self):
        super().__init__("max_spread", GuardCategory.MARKET, GuardSeverity.HIGH)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        spread = ctx.spread_points
        if spread > cfg.MAX_SPREAD_POINTS:
            return self._block(
                f"Spread {spread:.1f} > max {cfg.MAX_SPREAD_POINTS}",
                current_value=f"{spread:.1f}",
                threshold=f"{cfg.MAX_SPREAD_POINTS}",
                action="reject",
            )
        if spread > cfg.WARN_SPREAD_POINTS:
            return self._warn(
                f"Spread {spread:.1f} > warn threshold {cfg.WARN_SPREAD_POINTS}",
                current_value=f"{spread:.1f}",
                threshold=f"{cfg.WARN_SPREAD_POINTS}",
                action="reduce_lot",
            )
        # Zero spread anomaly
        if spread <= 0:
            return self._block(
                f"Zero/negative spread anomaly ({spread})",
                current_value=f"{spread}",
                action="reject",
            )
        return self._pass(
            current_value=f"{spread:.1f}",
            threshold=f"warn={cfg.WARN_SPREAD_POINTS} / max={cfg.MAX_SPREAD_POINTS}",
        )


class MaxSlippageGuard(BaseGuard):
    def __init__(self):
        super().__init__("max_slippage", GuardCategory.MARKET, GuardSeverity.HIGH)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        slip = ctx.recent_slippage_avg
        if slip > cfg.MAX_SLIPPAGE_POINTS:
            return self._block(
                f"Recent avg slippage {slip:.1f} > max {cfg.MAX_SLIPPAGE_POINTS}",
                current_value=f"{slip:.1f}",
                threshold=f"{cfg.MAX_SLIPPAGE_POINTS}",
                action="reject",
                safe_mode_impact="activate_safe_mode",
            )
        if slip > cfg.WARN_SLIPPAGE_POINTS:
            return self._warn(
                f"Recent avg slippage {slip:.1f} > warn {cfg.WARN_SLIPPAGE_POINTS}",
                current_value=f"{slip:.1f}",
                threshold=f"{cfg.WARN_SLIPPAGE_POINTS}",
                action="reduce_lot",
            )
        return self._pass(current_value=f"{slip:.1f}")


class VolatilityGuard(BaseGuard):
    def __init__(self):
        super().__init__("volatility", GuardCategory.MARKET, GuardSeverity.HIGH)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        if ctx.atr_baseline <= 0:
            return self._pass(reason="No ATR baseline available")

        atr_ratio = ctx.atr / ctx.atr_baseline if ctx.atr_baseline > 0 else 1.0
        if atr_ratio > cfg.ATR_VOLATILITY_MULTIPLIER_MAX:
            return self._block(
                f"ATR spike: {atr_ratio:.2f}x baseline (max {cfg.ATR_VOLATILITY_MULTIPLIER_MAX}x)",
                current_value=f"{atr_ratio:.2f}x",
                threshold=f"{cfg.ATR_VOLATILITY_MULTIPLIER_MAX}x",
                action="reject",
                safe_mode_impact="activate_safe_mode",
            )

        # Candle range spike
        if ctx.avg_candle_range > 0:
            range_ratio = ctx.recent_candle_range / ctx.avg_candle_range
            if range_ratio > cfg.CANDLE_RANGE_SPIKE_MULTIPLIER:
                return self._warn(
                    f"Candle range spike: {range_ratio:.2f}x avg",
                    current_value=f"{range_ratio:.2f}x",
                    threshold=f"{cfg.CANDLE_RANGE_SPIKE_MULTIPLIER}x",
                    action="reduce_lot",
                )

        return self._pass(current_value=f"ATR ratio {atr_ratio:.2f}x")


class SessionGuard(BaseGuard):
    def __init__(self):
        super().__init__("session", GuardCategory.MARKET, GuardSeverity.HIGH)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        allowed = cfg.ALLOWED_SESSIONS
        current = ctx.current_session

        # Rollover window
        if ctx.is_rollover_window and cfg.BLOCK_ROLLOVER_WINDOW:
            return self._block(
                "Inside rollover window — thin liquidity",
                current_value=current,
                action="reject",
            )

        if current not in allowed and current != "":
            return self._block(
                f"Session '{current}' not in allowed list {allowed}",
                current_value=current,
                threshold=str(allowed),
                action="reject",
            )
        return self._pass(current_value=current)


class NewsGuard(BaseGuard):
    def __init__(self):
        super().__init__("news", GuardCategory.MARKET, GuardSeverity.HIGH)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        if not ctx.news_upcoming:
            return self._pass(reason="No high-impact news nearby")

        minutes = ctx.news_minutes_away
        if minutes is None:
            return self._pass(reason="News timing unknown — pass with caution")

        if minutes >= 0 and minutes <= cfg.NEWS_BLOCK_BEFORE_MINUTES:
            return self._block(
                f"High-impact news in {minutes} minutes (block before={cfg.NEWS_BLOCK_BEFORE_MINUTES}m)",
                current_value=f"{minutes}m before",
                threshold=f"{cfg.NEWS_BLOCK_BEFORE_MINUTES}m",
                action="reject",
            )
        if minutes < 0 and abs(minutes) <= cfg.NEWS_BLOCK_AFTER_MINUTES:
            return self._block(
                f"High-impact news {abs(minutes)} minutes ago (block after={cfg.NEWS_BLOCK_AFTER_MINUTES}m)",
                current_value=f"{abs(minutes)}m after",
                threshold=f"{cfg.NEWS_BLOCK_AFTER_MINUTES}m",
                action="reject",
            )
        return self._pass(
            current_value=f"{minutes}m away" if minutes else "no news",
        )


class MarketRegimeGuard(BaseGuard):
    def __init__(self):
        super().__init__("market_regime", GuardCategory.MARKET, GuardSeverity.MEDIUM)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        if ctx.market_regime == "UNKNOWN":
            return self._warn(
                "Market regime classifier unavailable",
                action="reduce_lot",
            )
        if ctx.regime_expectation and ctx.regime_expectation != ctx.market_regime:
            return self._block(
                f"Regime mismatch: strategy expects {ctx.regime_expectation}, "
                f"actual is {ctx.market_regime}",
                current_value=ctx.market_regime,
                threshold=ctx.regime_expectation,
                action="reject",
            )
        return self._pass(current_value=ctx.market_regime)


class PriceIntegrityGuard(BaseGuard):
    def __init__(self):
        super().__init__("price_integrity", GuardCategory.MARKET, GuardSeverity.CRITICAL)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()

        # Stale price feed
        if ctx.tick_time is not None:
            age = time.time() - ctx.tick_time
            if age > cfg.PRICE_FEED_FRESH_SECONDS:
                return self._block(
                    f"Stale price feed: {age:.1f}s old (max {cfg.PRICE_FEED_FRESH_SECONDS}s)",
                    current_value=f"{age:.1f}s",
                    threshold=f"{cfg.PRICE_FEED_FRESH_SECONDS}s",
                    action="reject",
                )

        # Anomalous price
        if ctx.bid <= 0 or ctx.ask <= 0:
            return self._block(
                f"Anomalous price: bid={ctx.bid}, ask={ctx.ask}",
                action="reject",
            )

        # Ask < bid (should never happen)
        if ctx.ask < ctx.bid:
            return self._block(
                f"Price inversion: ask {ctx.ask} < bid {ctx.bid}",
                action="reject",
            )

        return self._pass(current_value=f"bid={ctx.bid:.2f} ask={ctx.ask:.2f}")


class LiquidityGuard(BaseGuard):
    def __init__(self):
        super().__init__("liquidity", GuardCategory.MARKET, GuardSeverity.MEDIUM)

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        # Proxy: if spread is extremely wide and it's off-hours, treat as low liquidity
        cfg = get_settings()
        if ctx.spread_points > cfg.WARN_SPREAD_POINTS and ctx.current_session == "OffHours":
            return self._warn(
                "Low liquidity detected (wide spread + off-hours)",
                action="reduce_lot",
            )
        if ctx.is_rollover_window:
            return self._warn("Rollover window — liquidity may be thin", action="reduce_lot")
        return self._pass()


class OrderRetryGuard(BaseGuard):
    def __init__(self):
        super().__init__("order_retry", GuardCategory.MARKET, GuardSeverity.MEDIUM)
        self._retry_count = 0

    def set_retry_count(self, count: int):
        self._retry_count = count

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_settings()
        if self._retry_count > cfg.MAX_ORDER_RETRIES:
            return self._block(
                f"Order retry count {self._retry_count} > max {cfg.MAX_ORDER_RETRIES}",
                current_value=str(self._retry_count),
                threshold=str(cfg.MAX_ORDER_RETRIES),
                action="reject",
            )
        return self._pass(current_value=str(self._retry_count))


# ── Registry ──────────────────────────────────────────────────────────

def get_market_guards() -> list[BaseGuard]:
    return [
        MaxSpreadGuard(),
        MaxSlippageGuard(),
        VolatilityGuard(),
        SessionGuard(),
        NewsGuard(),
        MarketRegimeGuard(),
        PriceIntegrityGuard(),
        LiquidityGuard(),
        OrderRetryGuard(),
    ]
