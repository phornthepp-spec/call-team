"""
Signal Generator — Multi-strategy signal engine.

Evaluates 5 confirmation signals:
1. EMA Crossover (EMA9/EMA21)
2. RSI (not overbought/oversold)
3. MACD (crossover direction)
4. Volume (surge detection)
5. Trend alignment (EMA50/EMA200)

Requires minimum 3/5 confirmations to generate a signal.
Computes confidence score, SL/TP using ATR.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from crypto_bot.config import Config, get_config
from crypto_bot.market_data import MarketRegime, MarketSnapshot, VolatilityState

logger = logging.getLogger(__name__)


@dataclass
class TradeSignal:
    """Output of signal evaluation."""
    side: str               # "BUY" or "SELL"
    entry_price: float
    stop_loss: float
    take_profit: float      # TP2 (full target)
    tp1_price: float        # TP1 (partial take-profit)
    rr_ratio: float
    confidence: float       # 0.0 – 1.0
    confirmations: int
    confirmation_details: dict
    regime: str
    volatility: str
    atr: float
    strategy_name: str = "multi_confirmation"


class SignalGenerator:
    """
    Multi-confirmation signal generator.

    Designed to be DECISIVE — generates signals when enough confirmations
    align, but with quality filtering to avoid false signals.
    """

    def __init__(self, config: Optional[Config] = None):
        self._cfg = config or get_config()

    def evaluate(self, snapshot: MarketSnapshot) -> Optional[TradeSignal]:
        """
        Run the full signal evaluation pipeline.

        Returns a TradeSignal if a valid signal is found, else None.
        """
        if snapshot is None:
            return None

        # ── Step 1: Detect potential direction ────────────────────
        buy_confirms, sell_confirms, details = self._evaluate_confirmations(snapshot)

        # Determine side based on which has more confirmations
        if buy_confirms >= self._cfg.min_confirmations and buy_confirms > sell_confirms:
            side = "BUY"
            confirmations = buy_confirms
        elif sell_confirms >= self._cfg.min_confirmations and sell_confirms > buy_confirms:
            side = "SELL"
            confirmations = sell_confirms
        else:
            logger.debug(
                "Signal skip: insufficient confirmations (buy=%d sell=%d need=%d)",
                buy_confirms, sell_confirms, self._cfg.min_confirmations,
            )
            return None

        # ── Step 2: Regime alignment check ────────────────────────
        if side == "BUY" and snapshot.regime == MarketRegime.TRENDING_DOWN:
            logger.debug("Signal skip: BUY against TRENDING_DOWN regime")
            return None
        if side == "SELL" and snapshot.regime == MarketRegime.TRENDING_UP:
            logger.debug("Signal skip: SELL against TRENDING_UP regime")
            return None

        # ── Step 3: Block extreme volatility ──────────────────────
        if snapshot.volatility == VolatilityState.EXTREME:
            logger.debug("Signal skip: EXTREME volatility (ATR spike)")
            return None

        # ── Step 4: Compute SL/TP using ATR ───────────────────────
        if snapshot.atr <= 0:
            logger.debug("Signal skip: ATR=0")
            return None

        entry = snapshot.ask if side == "BUY" else snapshot.bid
        sl_distance = self._cfg.sl_atr_multiplier * snapshot.atr

        if side == "BUY":
            stop_loss = round(entry - sl_distance, 8)
            tp1_price = round(entry + sl_distance * self._cfg.tp1_rr, 8)
            take_profit = round(entry + sl_distance * self._cfg.tp2_rr, 8)
        else:
            stop_loss = round(entry + sl_distance, 8)
            tp1_price = round(entry - sl_distance * self._cfg.tp1_rr, 8)
            take_profit = round(entry - sl_distance * self._cfg.tp2_rr, 8)

        rr_ratio = round(self._cfg.tp2_rr, 2)

        # ── Step 5: Compute confidence score ──────────────────────
        confidence = self._compute_confidence(side, snapshot, confirmations, details)

        # ── Step 6: Confidence gate ───────────────────────────────
        if confidence < self._cfg.min_confidence:
            logger.info(
                "Signal skip: confidence=%.3f < min=%.3f (side=%s confirms=%d)",
                confidence, self._cfg.min_confidence, side, confirmations,
            )
            return None

        # ── Step 7: R:R gate ──────────────────────────────────────
        if rr_ratio < self._cfg.min_rr_ratio:
            logger.info("Signal skip: RR=%.2f < min=%.2f", rr_ratio, self._cfg.min_rr_ratio)
            return None

        signal = TradeSignal(
            side=side,
            entry_price=entry,
            stop_loss=stop_loss,
            take_profit=take_profit,
            tp1_price=tp1_price,
            rr_ratio=rr_ratio,
            confidence=confidence,
            confirmations=confirmations,
            confirmation_details=details,
            regime=snapshot.regime.value,
            volatility=snapshot.volatility.value,
            atr=snapshot.atr,
        )

        logger.info(
            "SIGNAL: %s @ %.2f | SL=%.2f TP1=%.2f TP2=%.2f | RR=%.2f conf=%.3f "
            "confirms=%d | regime=%s vol=%s ATR=%.2f",
            side, entry, stop_loss, tp1_price, take_profit,
            rr_ratio, confidence, confirmations,
            snapshot.regime.value, snapshot.volatility.value, snapshot.atr,
        )

        return signal

    # ── Confirmation Evaluators ───────────────────────────────────

    def _evaluate_confirmations(self, snap: MarketSnapshot) -> tuple:
        """
        Evaluate all 5 confirmation signals.

        Returns: (buy_count, sell_count, details_dict)
        """
        buy = 0
        sell = 0
        details = {}

        # 1. EMA Crossover (EMA fast/slow)
        ema_cross = self._check_ema_crossover(snap)
        details["ema_crossover"] = ema_cross
        if ema_cross == "BUY":
            buy += 1
        elif ema_cross == "SELL":
            sell += 1

        # 2. RSI
        rsi_signal = self._check_rsi(snap)
        details["rsi"] = rsi_signal
        if rsi_signal == "BUY":
            buy += 1
        elif rsi_signal == "SELL":
            sell += 1

        # 3. MACD
        macd_signal = self._check_macd(snap)
        details["macd"] = macd_signal
        if macd_signal == "BUY":
            buy += 1
        elif macd_signal == "SELL":
            sell += 1

        # 4. Volume surge
        volume_signal = self._check_volume(snap)
        details["volume"] = volume_signal
        if volume_signal == "BUY":
            buy += 1
        elif volume_signal == "SELL":
            sell += 1

        # 5. Trend alignment (EMA50/EMA200)
        trend_signal = self._check_trend(snap)
        details["trend"] = trend_signal
        if trend_signal == "BUY":
            buy += 1
        elif trend_signal == "SELL":
            sell += 1

        return buy, sell, details

    def _check_ema_crossover(self, snap: MarketSnapshot) -> str:
        """
        EMA fast (9) vs EMA slow (21) crossover detection.

        Checks current vs previous bar values for actual crossover event.
        """
        # Bullish: prev_fast <= prev_slow AND curr_fast > curr_slow
        if snap.prev_ema_fast <= snap.prev_ema_slow and snap.ema_fast > snap.ema_slow:
            return "BUY"
        # Bearish: prev_fast >= prev_slow AND curr_fast < curr_slow
        if snap.prev_ema_fast >= snap.prev_ema_slow and snap.ema_fast < snap.ema_slow:
            return "SELL"
        # No crossover, but check current position for trend confirmation
        if snap.ema_fast > snap.ema_slow:
            gap = (snap.ema_fast - snap.ema_slow) / snap.ema_slow
            if gap > 0.001:  # Strong gap = still bullish
                return "BUY"
        elif snap.ema_fast < snap.ema_slow:
            gap = (snap.ema_slow - snap.ema_fast) / snap.ema_slow
            if gap > 0.001:
                return "SELL"
        return "NEUTRAL"

    @staticmethod
    def _check_rsi(snap: MarketSnapshot) -> str:
        """
        RSI signal — bullish when recovering from oversold, not overbought.

        BUY:  30 < RSI < 65 (room to go up, not overbought)
        SELL: 35 < RSI < 70 (room to go down, not oversold)
        """
        if 30 < snap.rsi < 65:
            return "BUY"
        elif 35 < snap.rsi < 70:
            # Only SELL-compatible if RSI is relatively high (above 50)
            if snap.rsi > 50:
                return "SELL"
        return "NEUTRAL"

    @staticmethod
    def _check_macd(snap: MarketSnapshot) -> str:
        """
        MACD crossover detection.

        BUY:  MACD line crosses above signal line
        SELL: MACD line crosses below signal line
        """
        # Crossover
        if snap.prev_macd_line <= snap.prev_macd_signal and snap.macd_line > snap.macd_signal:
            return "BUY"
        if snap.prev_macd_line >= snap.prev_macd_signal and snap.macd_line < snap.macd_signal:
            return "SELL"

        # Strong momentum with positive histogram
        if snap.macd_histogram > 0 and snap.macd_line > snap.macd_signal:
            return "BUY"
        if snap.macd_histogram < 0 and snap.macd_line < snap.macd_signal:
            return "SELL"

        return "NEUTRAL"

    def _check_volume(self, snap: MarketSnapshot) -> str:
        """
        Volume surge confirmation — confirms that price movement has conviction.

        Requires volume > volume_surge_multiplier × average volume.
        Returns the dominant side based on EMA position (volume doesn't have direction).
        """
        if snap.volume_ratio >= self._cfg.volume_surge_multiplier:
            # Volume surge detected — use EMA position for direction
            if snap.ema_fast > snap.ema_slow:
                return "BUY"
            elif snap.ema_fast < snap.ema_slow:
                return "SELL"
        return "NEUTRAL"

    @staticmethod
    def _check_trend(snap: MarketSnapshot) -> str:
        """
        Macro trend alignment: Price vs EMA50 vs EMA200.

        BUY:  price > EMA50 > EMA200
        SELL: price < EMA50 < EMA200
        """
        if snap.last_price > snap.ema_trend > snap.ema_macro:
            return "BUY"
        elif snap.last_price < snap.ema_trend < snap.ema_macro:
            return "SELL"
        return "NEUTRAL"

    # ── Confidence Scoring ────────────────────────────────────────

    def _compute_confidence(
        self,
        side: str,
        snap: MarketSnapshot,
        confirmations: int,
        details: dict,
    ) -> float:
        """
        Compute weighted confidence score from 0.0 to 1.0.

        Uses a base score plus weighted bonuses for each confirmation.
        """
        score = 0.0

        # ── Weighted confirmation scores ──────────────────────────
        weights = {
            "ema_crossover": 0.25,
            "rsi": 0.20,
            "macd": 0.25,
            "volume": 0.15,
            "trend": 0.15,
        }

        for indicator, weight in weights.items():
            if details.get(indicator) == side:
                score += weight

        # ── Bonus: Regime alignment ───────────────────────────────
        if side == "BUY" and snap.regime == MarketRegime.TRENDING_UP:
            score += 0.08
        elif side == "SELL" and snap.regime == MarketRegime.TRENDING_DOWN:
            score += 0.08
        elif snap.regime == MarketRegime.RANGING:
            score += 0.02

        # ── Bonus: Volatility ─────────────────────────────────────
        if snap.volatility == VolatilityState.NORMAL:
            score += 0.05
        elif snap.volatility == VolatilityState.LOW:
            score += 0.02
        elif snap.volatility == VolatilityState.ELEVATED:
            score -= 0.03  # Penalty for high volatility

        # ── Bonus: EMA gap strength ───────────────────────────────
        ema_gap_pct = abs(snap.ema_fast - snap.ema_slow) / snap.ema_slow if snap.ema_slow > 0 else 0
        if ema_gap_pct > 0.002:
            score += 0.05
        elif ema_gap_pct > 0.001:
            score += 0.02

        # ── Bonus: MACD histogram strength ────────────────────────
        if abs(snap.macd_histogram) > abs(snap.macd_signal) * 0.5:
            score += 0.03

        # Clamp to [0, 1]
        return round(min(max(score, 0.0), 1.0), 4)
