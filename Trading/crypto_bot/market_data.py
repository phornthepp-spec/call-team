"""
Market Data — Technical indicator computation and regime classification.

Computes EMA, RSI, MACD, ATR, Bollinger Bands, and Volume analysis
from raw OHLCV data. Classifies market regime and volatility state.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional

import numpy as np
import pandas as pd

from crypto_bot.config import Config, get_config

logger = logging.getLogger(__name__)


class MarketRegime(Enum):
    TRENDING_UP = "TRENDING_UP"
    TRENDING_DOWN = "TRENDING_DOWN"
    RANGING = "RANGING"
    UNKNOWN = "UNKNOWN"


class VolatilityState(Enum):
    LOW = "LOW"
    NORMAL = "NORMAL"
    ELEVATED = "ELEVATED"
    EXTREME = "EXTREME"


@dataclass
class MarketSnapshot:
    """Complete market analysis at a point in time."""
    # Price
    last_price: float = 0.0
    bid: float = 0.0
    ask: float = 0.0
    spread_pct: float = 0.0

    # EMAs
    ema_fast: float = 0.0       # EMA 9
    ema_slow: float = 0.0       # EMA 21
    ema_trend: float = 0.0      # EMA 50
    ema_macro: float = 0.0      # EMA 200
    prev_ema_fast: float = 0.0
    prev_ema_slow: float = 0.0

    # RSI
    rsi: float = 50.0

    # MACD
    macd_line: float = 0.0
    macd_signal: float = 0.0
    macd_histogram: float = 0.0
    prev_macd_line: float = 0.0
    prev_macd_signal: float = 0.0

    # ATR
    atr: float = 0.0
    atr_baseline: float = 0.0   # ATR average of earlier period

    # Bollinger Bands
    bb_upper: float = 0.0
    bb_middle: float = 0.0
    bb_lower: float = 0.0

    # Volume
    volume: float = 0.0
    volume_ma: float = 0.0
    volume_ratio: float = 0.0   # current vol / avg vol

    # Classification
    regime: MarketRegime = MarketRegime.UNKNOWN
    volatility: VolatilityState = VolatilityState.NORMAL

    # Raw
    timestamp: int = 0


class MarketDataService:
    """Computes technical indicators from OHLCV data."""

    def __init__(self, config: Optional[Config] = None):
        self._cfg = config or get_config()

    def build_snapshot(
        self,
        ohlcv: List[List],
        ticker: dict,
    ) -> Optional[MarketSnapshot]:
        """
        Build a complete MarketSnapshot from OHLCV candles and ticker.

        Args:
            ohlcv: List of [timestamp, open, high, low, close, volume]
            ticker: Ticker dict with bid, ask, last, etc.

        Returns:
            MarketSnapshot or None if insufficient data.
        """
        if not ohlcv or len(ohlcv) < 60:
            logger.warning("Insufficient OHLCV data: %d bars", len(ohlcv) if ohlcv else 0)
            return None

        df = pd.DataFrame(
            ohlcv, columns=["timestamp", "open", "high", "low", "close", "volume"]
        )
        df = df.astype({
            "open": float, "high": float, "low": float,
            "close": float, "volume": float,
        })

        snap = MarketSnapshot()

        # ── Price ─────────────────────────────────────────────────
        snap.last_price = ticker.get("last", float(df["close"].iloc[-1]))
        snap.bid = ticker.get("bid", snap.last_price)
        snap.ask = ticker.get("ask", snap.last_price)
        snap.spread_pct = (
            ((snap.ask - snap.bid) / snap.bid * 100) if snap.bid > 0 else 0
        )
        snap.timestamp = int(df["timestamp"].iloc[-1])

        # ── EMAs ──────────────────────────────────────────────────
        close = df["close"]
        ema_fast = close.ewm(span=self._cfg.ema_fast, adjust=False).mean()
        ema_slow = close.ewm(span=self._cfg.ema_slow, adjust=False).mean()
        ema_trend = close.ewm(span=self._cfg.ema_trend, adjust=False).mean()

        snap.ema_fast = float(ema_fast.iloc[-1])
        snap.ema_slow = float(ema_slow.iloc[-1])
        snap.ema_trend = float(ema_trend.iloc[-1])
        snap.prev_ema_fast = float(ema_fast.iloc[-2])
        snap.prev_ema_slow = float(ema_slow.iloc[-2])

        # EMA 200 — only if enough data
        if len(df) >= self._cfg.ema_macro:
            ema_macro = close.ewm(span=self._cfg.ema_macro, adjust=False).mean()
            snap.ema_macro = float(ema_macro.iloc[-1])
        else:
            snap.ema_macro = snap.ema_trend  # fallback

        # ── RSI ───────────────────────────────────────────────────
        snap.rsi = self._compute_rsi(close, self._cfg.rsi_period)

        # ── MACD ──────────────────────────────────────────────────
        ema_macd_fast = close.ewm(span=self._cfg.macd_fast, adjust=False).mean()
        ema_macd_slow = close.ewm(span=self._cfg.macd_slow, adjust=False).mean()
        macd_line = ema_macd_fast - ema_macd_slow
        macd_signal = macd_line.ewm(span=self._cfg.macd_signal, adjust=False).mean()

        snap.macd_line = float(macd_line.iloc[-1])
        snap.macd_signal = float(macd_signal.iloc[-1])
        snap.macd_histogram = snap.macd_line - snap.macd_signal
        snap.prev_macd_line = float(macd_line.iloc[-2])
        snap.prev_macd_signal = float(macd_signal.iloc[-2])

        # ── ATR ───────────────────────────────────────────────────
        snap.atr = self._compute_atr(df, self._cfg.atr_period)
        # Baseline ATR from earlier data (for comparison)
        if len(df) > self._cfg.atr_period * 3:
            baseline_df = df.iloc[:-self._cfg.atr_period]
            snap.atr_baseline = self._compute_atr(baseline_df, self._cfg.atr_period)
        else:
            snap.atr_baseline = snap.atr

        # ── Bollinger Bands ───────────────────────────────────────
        bb_ma = close.rolling(self._cfg.bb_period).mean()
        bb_std = close.rolling(self._cfg.bb_period).std()
        snap.bb_middle = float(bb_ma.iloc[-1])
        snap.bb_upper = float(bb_ma.iloc[-1] + self._cfg.bb_std * bb_std.iloc[-1])
        snap.bb_lower = float(bb_ma.iloc[-1] - self._cfg.bb_std * bb_std.iloc[-1])

        # ── Volume ────────────────────────────────────────────────
        vol = df["volume"]
        snap.volume = float(vol.iloc[-1])
        vol_ma = vol.rolling(self._cfg.volume_ma_period).mean()
        snap.volume_ma = float(vol_ma.iloc[-1]) if not pd.isna(vol_ma.iloc[-1]) else 1.0
        snap.volume_ratio = (
            snap.volume / snap.volume_ma if snap.volume_ma > 0 else 0
        )

        # ── Regime Classification ─────────────────────────────────
        snap.regime = self._classify_regime(snap)

        # ── Volatility Classification ─────────────────────────────
        snap.volatility = self._classify_volatility(snap.atr, snap.atr_baseline)

        return snap

    # ── Technical Indicators ──────────────────────────────────────

    @staticmethod
    def _compute_rsi(close: pd.Series, period: int = 14) -> float:
        """Compute RSI (Relative Strength Index)."""
        delta = close.diff()
        gain = delta.where(delta > 0, 0.0)
        loss = (-delta).where(delta < 0, 0.0)

        avg_gain = gain.ewm(span=period, adjust=False).mean()
        avg_loss = loss.ewm(span=period, adjust=False).mean()

        rs = avg_gain / avg_loss.replace(0, np.inf)
        rsi = 100 - (100 / (1 + rs))

        val = float(rsi.iloc[-1])
        return val if not np.isnan(val) else 50.0

    @staticmethod
    def _compute_atr(df: pd.DataFrame, period: int = 14) -> float:
        """Compute ATR (Average True Range)."""
        high = df["high"]
        low = df["low"]
        close = df["close"]

        tr1 = high - low
        tr2 = (high - close.shift(1)).abs()
        tr3 = (low - close.shift(1)).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

        atr = tr.ewm(span=period, adjust=False).mean()
        val = float(atr.iloc[-1])
        return val if not np.isnan(val) else 0.0

    def _classify_regime(self, snap: MarketSnapshot) -> MarketRegime:
        """
        Classify market regime based on EMA alignment.

        TRENDING_UP:   price > EMA50 > EMA200 and EMA fast > EMA slow
        TRENDING_DOWN: price < EMA50 < EMA200 and EMA fast < EMA slow
        RANGING:       otherwise
        """
        price = snap.last_price

        if (
            price > snap.ema_trend > snap.ema_macro
            and snap.ema_fast > snap.ema_slow
        ):
            return MarketRegime.TRENDING_UP
        elif (
            price < snap.ema_trend < snap.ema_macro
            and snap.ema_fast < snap.ema_slow
        ):
            return MarketRegime.TRENDING_DOWN
        else:
            return MarketRegime.RANGING

    @staticmethod
    def _classify_volatility(atr: float, atr_baseline: float) -> VolatilityState:
        """Classify volatility based on ATR ratio to baseline."""
        if atr_baseline <= 0:
            return VolatilityState.NORMAL

        ratio = atr / atr_baseline
        if ratio < 0.6:
            return VolatilityState.LOW
        elif ratio <= 1.3:
            return VolatilityState.NORMAL
        elif ratio <= 2.0:
            return VolatilityState.ELEVATED
        else:
            return VolatilityState.EXTREME
