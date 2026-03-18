"""
Market data service — aggregates tick, bar, session, volatility,
and regime data into a single snapshot for the risk engine.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd

from app.core.enums import MarketRegime, MarketSession, VolatilityState

logger = logging.getLogger(__name__)

# UTC+7 (Bangkok) — session boundaries
UTC_PLUS_7 = timezone(timedelta(hours=7))

SESSION_SCHEDULE = {
    MarketSession.ASIAN:            (1, 0, 8, 0),    # 01:00-08:00 UTC+7
    MarketSession.LONDON:           (14, 0, 20, 0),   # 14:00-20:00 UTC+7
    MarketSession.NEW_YORK:         (19, 0, 4, 0),    # 19:00-04:00+1 UTC+7
    MarketSession.LONDON_NY_OVERLAP:(19, 0, 23, 0),   # 19:00-23:00 UTC+7
    MarketSession.ROLLOVER:         (3, 50, 4, 20),    # ~03:50-04:20 UTC+7 (server rollover)
}


class MarketDataService:
    """Aggregates market state for risk evaluation."""

    def get_market_snapshot(
        self,
        tick: Dict[str, Any],
        bars_df: Optional[pd.DataFrame],
        atr_period: int = 14,
    ) -> Dict[str, Any]:
        """Build a complete market snapshot from tick + bar data."""
        snapshot: Dict[str, Any] = {
            "bid": tick.get("bid", 0),
            "ask": tick.get("ask", 0),
            "spread": tick.get("spread", 0),
            "spread_points": tick.get("spread_points", 0),
            "tick_time": tick.get("time"),
            "current_session": self.get_current_session().value,
            "is_rollover_window": self.is_rollover_window(),
            "market_regime": MarketRegime.UNKNOWN.value,
            "volatility_state": VolatilityState.NORMAL.value,
            "atr": 0.0,
            "atr_baseline": 0.0,
            "recent_candle_range": 0.0,
            "avg_candle_range": 0.0,
        }

        if bars_df is not None and len(bars_df) > atr_period + 5:
            atr = self.compute_atr(bars_df, atr_period)
            atr_baseline = self.compute_atr(bars_df.iloc[:-atr_period], atr_period)

            snapshot["atr"] = round(atr, 5)
            snapshot["atr_baseline"] = round(atr_baseline, 5) if atr_baseline else atr
            snapshot["recent_candle_range"] = round(
                float(bars_df.iloc[-1]["high"] - bars_df.iloc[-1]["low"]), 5
            )
            snapshot["avg_candle_range"] = round(
                float((bars_df["high"] - bars_df["low"]).tail(20).mean()), 5
            )
            snapshot["market_regime"] = self.classify_regime(bars_df).value
            snapshot["volatility_state"] = self.classify_volatility(
                atr, atr_baseline
            ).value

        return snapshot

    @staticmethod
    def compute_atr(df: pd.DataFrame, period: int = 14) -> float:
        """Compute ATR from OHLC data."""
        if len(df) < period + 1:
            return 0.0
        prev_close = df["close"].shift(1)
        tr = pd.concat([
            df["high"] - df["low"],
            (df["high"] - prev_close).abs(),
            (df["low"] - prev_close).abs(),
        ], axis=1).max(axis=1)
        return float(tr.ewm(span=period, adjust=False).mean().iloc[-1])

    @staticmethod
    def classify_regime(df: pd.DataFrame, ema_fast: int = 20, ema_slow: int = 50) -> MarketRegime:
        """Simple regime classification using EMA crossover + volatility."""
        if len(df) < ema_slow + 5:
            return MarketRegime.UNKNOWN

        close = df["close"]
        ema_f = close.ewm(span=ema_fast, adjust=False).mean()
        ema_s = close.ewm(span=ema_slow, adjust=False).mean()

        latest_f = float(ema_f.iloc[-1])
        latest_s = float(ema_s.iloc[-1])

        # Trend strength
        if latest_f > latest_s * 1.001:
            return MarketRegime.TRENDING_UP
        elif latest_f < latest_s * 0.999:
            return MarketRegime.TRENDING_DOWN
        else:
            return MarketRegime.RANGING

    @staticmethod
    def classify_volatility(current_atr: float, baseline_atr: float) -> VolatilityState:
        if baseline_atr <= 0:
            return VolatilityState.NORMAL
        ratio = current_atr / baseline_atr
        if ratio > 2.5:
            return VolatilityState.EXTREME
        elif ratio > 1.5:
            return VolatilityState.ELEVATED
        elif ratio < 0.5:
            return VolatilityState.LOW
        return VolatilityState.NORMAL

    @staticmethod
    def get_current_session() -> MarketSession:
        """Determine the current trading session in UTC+7."""
        now = datetime.now(tz=UTC_PLUS_7)
        h, m = now.hour, now.minute
        t = h * 60 + m

        # Check rollover first
        if 3 * 60 + 50 <= t <= 4 * 60 + 20:
            return MarketSession.ROLLOVER

        # London/NY overlap
        if 19 * 60 <= t <= 23 * 60:
            return MarketSession.LONDON_NY_OVERLAP

        # London
        if 14 * 60 <= t <= 23 * 60:
            return MarketSession.LONDON

        # Asian
        if 1 * 60 <= t <= 8 * 60:
            return MarketSession.ASIAN

        return MarketSession.OFF_HOURS

    @staticmethod
    def is_rollover_window() -> bool:
        now = datetime.now(tz=UTC_PLUS_7)
        t = now.hour * 60 + now.minute
        return 3 * 60 + 50 <= t <= 4 * 60 + 20
