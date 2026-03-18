"""
Signal Generator — EMA Crossover + ATR + Session Filter + Regime Alignment.

Evaluates M15 bar data to detect EMA(20)/EMA(50) crossovers, filters by
trading session and market regime, then computes SL/TP using ATR and
produces a confidence score.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

from app.core.config import get_settings
from app.core.enums import MarketRegime, MarketSession, VolatilityState
from app.services.market_data_service import MarketDataService
from app.services.mt5_service import MT5Service

logger = logging.getLogger(__name__)

ALLOWED_SESSIONS = {
    MarketSession.LONDON,
    MarketSession.LONDON_NY_OVERLAP,
}


@dataclass
class TradeSignalResult:
    """Output of signal evaluation."""
    side: str               # BUY / SELL
    entry_price: float
    stop_loss: float
    take_profit: float
    rr_ratio: float
    confidence: float
    confirmations: int
    regime: str
    session: str
    atr: float
    strategy_name: str = "ema_crossover"
    timeframe: str = "M15"


class SignalGenerator:
    """EMA Crossover signal generator with ATR-based SL/TP."""

    def __init__(
        self,
        mt5_service: MT5Service,
        market_data_service: Optional[MarketDataService] = None,
    ):
        self._mt5 = mt5_service
        self._mds = market_data_service or MarketDataService()

    def evaluate(
        self,
        symbol: str = "XAUUSD",
        timeframe: str = "M15",
        min_confidence: float = 0.70,
        min_rr: float = 1.8,
    ) -> Optional[TradeSignalResult]:
        """
        Run full signal evaluation pipeline.

        Returns a TradeSignalResult if a valid signal is found, else None.
        This is a synchronous method (MT5 calls are sync).
        """
        cfg = get_settings()

        # 1. Session filter
        session = self._mds.get_current_session()
        if session not in ALLOWED_SESSIONS:
            logger.debug("Signal skip: session=%s not in allowed sessions", session.value)
            return None

        # 2. Get bars
        try:
            bars = self._mt5.get_bars(symbol, timeframe, count=300)
        except Exception as e:
            logger.warning("Signal skip: failed to get bars: %s", e)
            return None

        if bars is None or len(bars) < 60:
            logger.debug("Signal skip: insufficient bars (%s)", len(bars) if bars is not None else 0)
            return None

        # 3. Compute EMAs
        close = bars["close"].astype(float)
        ema20 = close.ewm(span=20, adjust=False).mean()
        ema50 = close.ewm(span=50, adjust=False).mean()

        # 4. Detect crossover (current bar vs previous bar)
        curr_fast = float(ema20.iloc[-1])
        curr_slow = float(ema50.iloc[-1])
        prev_fast = float(ema20.iloc[-2])
        prev_slow = float(ema50.iloc[-2])

        bullish_cross = prev_fast <= prev_slow and curr_fast > curr_slow
        bearish_cross = prev_fast >= prev_slow and curr_fast < curr_slow

        if not bullish_cross and not bearish_cross:
            logger.debug("Signal skip: no EMA crossover detected")
            return None

        side = "BUY" if bullish_cross else "SELL"

        # 5. Market regime check
        regime = self._mds.classify_regime(bars)
        if side == "BUY" and regime not in (MarketRegime.TRENDING_UP, MarketRegime.RANGING):
            logger.debug("Signal skip: BUY but regime=%s", regime.value)
            return None
        if side == "SELL" and regime not in (MarketRegime.TRENDING_DOWN, MarketRegime.RANGING):
            logger.debug("Signal skip: SELL but regime=%s", regime.value)
            return None

        # 6. Get tick for entry price
        try:
            tick = self._mt5.get_tick(symbol)
        except Exception as e:
            logger.warning("Signal skip: failed to get tick: %s", e)
            return None

        entry = tick["ask"] if side == "BUY" else tick["bid"]

        # 7. Compute ATR for SL/TP
        atr = self._mds.compute_atr(bars, period=14)
        if atr <= 0:
            logger.debug("Signal skip: ATR=0")
            return None

        atr_baseline = self._mds.compute_atr(bars.iloc[:-14], period=14)
        volatility = self._mds.classify_volatility(atr, atr_baseline)

        # Block on extreme volatility
        if volatility == VolatilityState.EXTREME:
            logger.debug("Signal skip: EXTREME volatility")
            return None

        sl_distance = 1.5 * atr
        tp_distance = sl_distance * min_rr

        if side == "BUY":
            stop_loss = round(entry - sl_distance, 2)
            take_profit = round(entry + tp_distance, 2)
        else:
            stop_loss = round(entry + sl_distance, 2)
            take_profit = round(entry - tp_distance, 2)

        rr_ratio = round(tp_distance / sl_distance, 2) if sl_distance > 0 else 0

        # 8. Confidence scoring
        confidence = 0.50  # base

        # Regime alignment bonus
        if (side == "BUY" and regime == MarketRegime.TRENDING_UP) or \
           (side == "SELL" and regime == MarketRegime.TRENDING_DOWN):
            confidence += 0.15
        elif regime == MarketRegime.RANGING:
            confidence += 0.05

        # Session bonus
        if session == MarketSession.LONDON_NY_OVERLAP:
            confidence += 0.10
        elif session == MarketSession.LONDON:
            confidence += 0.05

        # Volatility bonus (normal is best)
        if volatility == VolatilityState.NORMAL:
            confidence += 0.10
        elif volatility == VolatilityState.ELEVATED:
            confidence += 0.03

        # EMA strength bonus (gap between EMAs)
        ema_gap_pct = abs(curr_fast - curr_slow) / curr_slow if curr_slow > 0 else 0
        if ema_gap_pct > 0.001:
            confidence += 0.10
        elif ema_gap_pct > 0.0005:
            confidence += 0.05

        # ATR stability bonus
        if atr_baseline > 0:
            atr_ratio = atr / atr_baseline
            if 0.8 <= atr_ratio <= 1.3:
                confidence += 0.05

        confidence = round(min(confidence, 1.0), 4)

        # 9. Confidence gate
        if confidence < min_confidence:
            logger.info(
                "Signal skip: confidence=%.2f < min=%.2f (side=%s regime=%s session=%s)",
                confidence, min_confidence, side, regime.value, session.value,
            )
            return None

        # 10. Count confirmations
        confirmations = 0
        if (side == "BUY" and regime == MarketRegime.TRENDING_UP) or \
           (side == "SELL" and regime == MarketRegime.TRENDING_DOWN):
            confirmations += 1
        if session in ALLOWED_SESSIONS:
            confirmations += 1
        if volatility in (VolatilityState.NORMAL, VolatilityState.ELEVATED):
            confirmations += 1
        if ema_gap_pct > 0.0005:
            confirmations += 1

        logger.info(
            "SIGNAL: %s %s @ %.2f SL=%.2f TP=%.2f RR=%.2f conf=%.2f confirms=%d regime=%s session=%s ATR=%.2f",
            side, symbol, entry, stop_loss, take_profit, rr_ratio,
            confidence, confirmations, regime.value, session.value, atr,
        )

        return TradeSignalResult(
            side=side,
            entry_price=entry,
            stop_loss=stop_loss,
            take_profit=take_profit,
            rr_ratio=rr_ratio,
            confidence=confidence,
            confirmations=confirmations,
            regime=regime.value,
            session=session.value,
            atr=atr,
            timeframe=timeframe,
        )
