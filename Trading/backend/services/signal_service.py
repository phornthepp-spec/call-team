"""
Signal Engine for XAUUSD Trading System.

Implements a trend-breakout strategy using EMA crossovers and ATR-based
volatility filtering. Generates BUY/SELL signals with calculated entry,
stop-loss, take-profit levels, and a confidence score.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Default indicator parameters
# ---------------------------------------------------------------------------
EMA_FAST_PERIOD: int = 20
EMA_SLOW_PERIOD: int = 50
ATR_PERIOD: int = 14
SL_ATR_MULTIPLIER: float = 1.2
DEFAULT_RR_TARGET: float = 2.0  # risk-reward ratio


def _ema(series: pd.Series, period: int) -> pd.Series:
    """Calculate Exponential Moving Average."""
    return series.ewm(span=period, adjust=False).mean()


def _atr(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int,
) -> pd.Series:
    """
    Calculate the Average True Range.

    True Range = max(H-L, |H-Cprev|, |L-Cprev|)
    """
    prev_close = close.shift(1)
    tr1 = high - low
    tr2 = (high - prev_close).abs()
    tr3 = (low - prev_close).abs()
    true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return true_range.ewm(span=period, adjust=False).mean()


def _trend_strength(ema_fast: float, ema_slow: float, atr: float) -> float:
    """
    Measure the strength of the current trend as a normalised score [0, 1].

    The wider the EMA gap relative to ATR, the stronger the trend.
    """
    if atr <= 0:
        return 0.0
    gap = abs(ema_fast - ema_slow)
    # Normalise: a gap of 2x ATR maps to ~0.86 via tanh
    strength = float(np.tanh(gap / (atr * 2)))
    return round(min(max(strength, 0.0), 1.0), 4)


def evaluate_xauusd_signal(
    bars_df: pd.DataFrame,
    timeframe: str,
    rr_target: float = DEFAULT_RR_TARGET,
    sl_multiplier: float = SL_ATR_MULTIPLIER,
) -> Optional[Dict[str, Any]]:
    """
    Evaluate the latest bar data and return a trading signal if conditions
    are met.

    Strategy (Trend Breakout):
        - **BUY** when EMA(20) > EMA(50) (trend_up) AND the latest close
          breaks above the highest high of the previous 20 bars (breakout_high).
        - **SELL** when EMA(20) < EMA(50) (trend_down) AND the latest close
          breaks below the lowest low of the previous 20 bars (breakout_low).

    Args:
        bars_df: DataFrame with columns ``open, high, low, close, volume``
                 (must contain at least ``EMA_SLOW_PERIOD + ATR_PERIOD`` rows).
        timeframe: Timeframe string (e.g. ``"M15"``, ``"H1"``), used for
                   informational tagging only.
        rr_target: Desired risk-to-reward ratio for the take-profit
                   calculation.
        sl_multiplier: Multiplier applied to ATR to determine stop-loss
                       distance.

    Returns:
        A signal dict with the following keys, or ``None`` if no valid signal:

        - ``side`` (str): ``"BUY"`` or ``"SELL"``
        - ``entry`` (float): Suggested entry price (latest close)
        - ``sl`` (float): Stop-loss price
        - ``tp`` (float): Take-profit price
        - ``risk_distance`` (float): Distance from entry to SL
        - ``reward_distance`` (float): Distance from entry to TP
        - ``rr_ratio`` (float): Reward / Risk ratio
        - ``atr`` (float): Current ATR value
        - ``ema_fast`` (float): Current EMA(20) value
        - ``ema_slow`` (float): Current EMA(50) value
        - ``confidence_score`` (float): 0.0 -- 1.0 trend strength score
        - ``timeframe`` (str): Source timeframe
        - ``strategy`` (str): Name of the strategy that fired
    """
    required_cols = {"open", "high", "low", "close", "volume"}
    if not required_cols.issubset(bars_df.columns):
        logger.error(
            "bars_df missing required columns. Got %s, need %s.",
            list(bars_df.columns),
            required_cols,
        )
        return None

    min_rows = EMA_SLOW_PERIOD + ATR_PERIOD + 1
    if len(bars_df) < min_rows:
        logger.warning(
            "Not enough bars (%d) to compute indicators (need >= %d).",
            len(bars_df),
            min_rows,
        )
        return None

    df = bars_df.copy()

    # ------------------------------------------------------------------
    # Compute indicators
    # ------------------------------------------------------------------
    df["ema_fast"] = _ema(df["close"], EMA_FAST_PERIOD)
    df["ema_slow"] = _ema(df["close"], EMA_SLOW_PERIOD)
    df["atr"] = _atr(df["high"], df["low"], df["close"], ATR_PERIOD)

    # Rolling breakout levels (previous 20 bars, excluding current)
    df["breakout_high"] = df["high"].shift(1).rolling(window=EMA_FAST_PERIOD).max()
    df["breakout_low"] = df["low"].shift(1).rolling(window=EMA_FAST_PERIOD).min()

    # Use the latest completed bar
    latest = df.iloc[-1]
    ema_fast_val: float = float(latest["ema_fast"])
    ema_slow_val: float = float(latest["ema_slow"])
    atr_val: float = float(latest["atr"])
    close_val: float = float(latest["close"])
    breakout_hi: float = float(latest["breakout_high"])
    breakout_lo: float = float(latest["breakout_low"])

    if np.isnan(atr_val) or atr_val <= 0:
        logger.debug("ATR is invalid (%.4f) - no signal.", atr_val)
        return None

    # ------------------------------------------------------------------
    # Trend + breakout logic
    # ------------------------------------------------------------------
    trend_up = ema_fast_val > ema_slow_val
    trend_down = ema_fast_val < ema_slow_val
    breakout_high = close_val > breakout_hi
    breakout_low = close_val < breakout_lo

    side: Optional[str] = None
    if trend_up and breakout_high:
        side = "BUY"
    elif trend_down and breakout_low:
        side = "SELL"

    if side is None:
        logger.debug(
            "No signal: trend_up=%s breakout_high=%s | "
            "trend_down=%s breakout_low=%s",
            trend_up,
            breakout_high,
            trend_down,
            breakout_low,
        )
        return None

    # ------------------------------------------------------------------
    # Entry / SL / TP calculation
    # ------------------------------------------------------------------
    entry = close_val
    risk_distance = round(sl_multiplier * atr_val, 2)
    reward_distance = round(rr_target * risk_distance, 2)

    if side == "BUY":
        sl = round(entry - risk_distance, 2)
        tp = round(entry + reward_distance, 2)
    else:
        sl = round(entry + risk_distance, 2)
        tp = round(entry - reward_distance, 2)

    rr_ratio = round(reward_distance / risk_distance, 2) if risk_distance > 0 else 0.0

    # ------------------------------------------------------------------
    # Confidence score
    # ------------------------------------------------------------------
    confidence = _trend_strength(ema_fast_val, ema_slow_val, atr_val)

    signal: Dict[str, Any] = {
        "side": side,
        "entry": round(entry, 2),
        "sl": sl,
        "tp": tp,
        "risk_distance": risk_distance,
        "reward_distance": reward_distance,
        "rr_ratio": rr_ratio,
        "atr": round(atr_val, 2),
        "ema_fast": round(ema_fast_val, 2),
        "ema_slow": round(ema_slow_val, 2),
        "confidence_score": confidence,
        "timeframe": timeframe,
        "strategy": "trend_breakout",
    }

    logger.info(
        "Signal generated: %s %s @ %.2f | SL=%.2f TP=%.2f | "
        "RR=%.2f | Confidence=%.4f",
        side,
        timeframe,
        entry,
        sl,
        tp,
        rr_ratio,
        confidence,
    )
    return signal
