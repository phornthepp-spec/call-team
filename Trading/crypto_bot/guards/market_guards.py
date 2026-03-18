"""
Market Guards — protect against adverse market conditions.

Guards:
- spread: Excessive bid-ask spread
- volatility: ATR spike detection
- volume: Low volume warning
- price_stale: Stale price feed
"""

from __future__ import annotations

import time
from typing import List

from crypto_bot.config import get_config
from crypto_bot.guards.base_guard import BaseGuard, EvaluationContext, GuardResult


class SpreadGuard(BaseGuard):
    """Blocks or warns when spread is too wide."""

    def __init__(self):
        super().__init__("spread", "MARKET", "MEDIUM")

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_config()
        if ctx.spread_pct >= cfg.max_spread_pct:
            return self._block(
                f"Spread {ctx.spread_pct:.4f}% >= max {cfg.max_spread_pct}%",
                current_value=f"{ctx.spread_pct:.4f}%",
                threshold=f"{cfg.max_spread_pct}%",
            )
        if ctx.spread_pct >= cfg.warn_spread_pct:
            return self._warn(
                f"Spread {ctx.spread_pct:.4f}% >= warn {cfg.warn_spread_pct}%",
                current_value=f"{ctx.spread_pct:.4f}%",
            )
        return self._pass(f"Spread: {ctx.spread_pct:.4f}%")


class VolatilityGuard(BaseGuard):
    """Blocks when ATR spikes beyond normal range."""

    def __init__(self):
        super().__init__("volatility", "MARKET", "HIGH")

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_config()
        if ctx.atr_baseline <= 0:
            return self._pass("ATR baseline unavailable — skip check")

        ratio = ctx.atr / ctx.atr_baseline
        if ratio >= cfg.max_atr_spike_multiplier:
            return self._block(
                f"ATR spike: {ratio:.2f}x baseline >= max {cfg.max_atr_spike_multiplier}x",
                current_value=f"{ratio:.2f}x",
                threshold=f"{cfg.max_atr_spike_multiplier}x",
            )
        if ratio >= cfg.max_atr_spike_multiplier * 0.7:
            return self._warn(
                f"ATR elevated: {ratio:.2f}x baseline (warn threshold)",
                current_value=f"{ratio:.2f}x",
            )
        return self._pass(f"ATR ratio: {ratio:.2f}x")


class VolumeGuard(BaseGuard):
    """Warns when volume is unusually low."""

    def __init__(self):
        super().__init__("volume", "MARKET", "LOW")

    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        cfg = get_config()
        if ctx.volume_ratio < cfg.min_volume_ratio:
            return self._warn(
                f"Volume ratio {ctx.volume_ratio:.2f}x < min {cfg.min_volume_ratio}x — low liquidity",
                current_value=f"{ctx.volume_ratio:.2f}x",
                threshold=f"{cfg.min_volume_ratio}x",
            )
        return self._pass(f"Volume ratio: {ctx.volume_ratio:.2f}x")


def get_market_guards() -> List[BaseGuard]:
    """Return all market guards in evaluation order."""
    return [
        SpreadGuard(),
        VolatilityGuard(),
        VolumeGuard(),
    ]
