"""
Order Manager — handles order placement, tracking, trailing stops, and partial TP.

Manages the complete lifecycle of a trade:
1. Place entry order (market)
2. Place SL/TP orders
3. Monitor and manage open positions
4. Trailing stop adjustment
5. Partial take-profit execution
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from crypto_bot.config import Config, get_config
from crypto_bot.exchange_service import ExchangeService

logger = logging.getLogger(__name__)


@dataclass
class ManagedPosition:
    """An actively managed open position."""
    id: str                     # Unique position ID
    symbol: str
    side: str                   # "BUY" or "SELL"
    entry_price: float
    amount: float               # Total amount
    remaining_amount: float     # Amount after partial TPs
    stop_loss: float
    take_profit: float          # TP2 (final target)
    tp1_price: float            # TP1 (partial)
    tp1_close_pct: float        # Fraction to close at TP1 (e.g. 0.5)
    atr: float                  # ATR at entry (for trailing stop)
    confidence: float
    rr_ratio: float

    # State
    is_open: bool = True
    tp1_hit: bool = False       # Has TP1 been triggered?
    trailing_active: bool = False
    highest_price: float = 0.0  # Highest since entry (for BUY trailing)
    lowest_price: float = 999999999.0  # Lowest since entry (for SELL trailing)
    entry_time: float = 0.0
    last_check_time: float = 0.0

    # Order IDs
    entry_order_id: Optional[str] = None
    sl_order_id: Optional[str] = None
    tp_order_id: Optional[str] = None

    # Results
    realized_pnl: float = 0.0
    close_reason: Optional[str] = None


class OrderManager:
    """
    Manages order placement, position tracking, trailing stops,
    and partial take-profit execution.
    """

    def __init__(
        self,
        exchange: ExchangeService,
        config: Optional[Config] = None,
    ):
        self._exchange = exchange
        self._cfg = config or get_config()
        self._positions: Dict[str, ManagedPosition] = {}
        self._position_counter = 0

    @property
    def open_positions(self) -> List[ManagedPosition]:
        return [p for p in self._positions.values() if p.is_open]

    @property
    def open_position_count(self) -> int:
        return len(self.open_positions)

    def get_position(self, position_id: str) -> Optional[ManagedPosition]:
        return self._positions.get(position_id)

    # ── Order Placement ───────────────────────────────────────────

    def open_position(
        self,
        symbol: str,
        side: str,
        amount: float,
        entry_price: float,
        stop_loss: float,
        take_profit: float,
        tp1_price: float,
        atr: float,
        confidence: float,
        rr_ratio: float,
    ) -> Optional[ManagedPosition]:
        """
        Open a new position with market order + SL/TP.

        Returns ManagedPosition if successful, None otherwise.
        """
        # Precision
        amount = self._exchange.amount_to_precision(amount, symbol)
        entry_price = self._exchange.price_to_precision(entry_price, symbol)
        stop_loss = self._exchange.price_to_precision(stop_loss, symbol)
        take_profit = self._exchange.price_to_precision(take_profit, symbol)
        tp1_price = self._exchange.price_to_precision(tp1_price, symbol)

        if amount <= 0:
            logger.error("Cannot open position: amount=0 after precision rounding")
            return None

        try:
            # 1. Place market entry order
            order_side = "buy" if side == "BUY" else "sell"
            entry_order = self._exchange.create_market_order(
                symbol, order_side, amount
            )

            if not entry_order or entry_order.get("status") not in ("closed", "filled", None):
                logger.error("Entry order failed: %s", entry_order)
                return None

            # Use actual fill price if available
            actual_price = entry_order.get("average") or entry_order.get("price") or entry_price

            # 2. Create managed position
            self._position_counter += 1
            pos_id = f"POS-{self._position_counter}-{int(time.time())}"

            pos = ManagedPosition(
                id=pos_id,
                symbol=symbol,
                side=side,
                entry_price=actual_price,
                amount=amount,
                remaining_amount=amount,
                stop_loss=stop_loss,
                take_profit=take_profit,
                tp1_price=tp1_price,
                tp1_close_pct=self._cfg.tp1_close_pct,
                atr=atr,
                confidence=confidence,
                rr_ratio=rr_ratio,
                entry_time=time.time(),
                last_check_time=time.time(),
                highest_price=actual_price,
                lowest_price=actual_price,
                entry_order_id=entry_order.get("id"),
            )

            # 3. Place stop-loss order
            sl_side = "sell" if side == "BUY" else "buy"
            try:
                sl_order = self._exchange.create_stop_loss_order(
                    symbol, sl_side, amount, stop_loss
                )
                pos.sl_order_id = sl_order.get("id")
            except Exception as e:
                logger.warning("SL order failed (will use manual SL): %s", e)

            # 4. Place take-profit order (TP2 — full target)
            try:
                tp_order = self._exchange.create_take_profit_order(
                    symbol, sl_side, amount, take_profit
                )
                pos.tp_order_id = tp_order.get("id")
            except Exception as e:
                logger.warning("TP order failed (will use manual TP): %s", e)

            self._positions[pos_id] = pos

            logger.info(
                "POSITION OPENED: %s | %s %.8f %s @ %.2f | SL=%.2f TP1=%.2f TP2=%.2f | conf=%.3f RR=%.2f",
                pos_id, side, amount, symbol, actual_price,
                stop_loss, tp1_price, take_profit, confidence, rr_ratio,
            )

            return pos

        except Exception as e:
            logger.error("Failed to open position: %s", e)
            return None

    # ── Position Management ───────────────────────────────────────

    def manage_positions(self, current_prices: Dict[str, Dict]) -> List[str]:
        """
        Check and manage all open positions.

        Handles:
        - Manual SL/TP checking (when exchange orders weren't placed)
        - Trailing stop adjustment
        - Partial TP at TP1

        Args:
            current_prices: {symbol: {"bid": ..., "ask": ..., "last": ...}}

        Returns:
            List of action descriptions for logging.
        """
        actions = []

        for pos in self.open_positions:
            if pos.symbol not in current_prices:
                continue

            prices = current_prices[pos.symbol]
            current_price = prices.get("last", 0)
            if current_price <= 0:
                continue

            # Update tracking prices
            if pos.side == "BUY":
                pos.highest_price = max(pos.highest_price, current_price)
            else:
                pos.lowest_price = min(pos.lowest_price, current_price)

            # Check SL hit (manual check as backup)
            sl_action = self._check_stop_loss(pos, current_price)
            if sl_action:
                actions.append(sl_action)
                continue

            # Check TP1 (partial take-profit)
            tp1_action = self._check_tp1(pos, current_price)
            if tp1_action:
                actions.append(tp1_action)

            # Check TP2 (full take-profit)
            tp2_action = self._check_tp2(pos, current_price)
            if tp2_action:
                actions.append(tp2_action)
                continue

            # Trailing stop adjustment
            trail_action = self._check_trailing_stop(pos, current_price)
            if trail_action:
                actions.append(trail_action)

            pos.last_check_time = time.time()

        return actions

    def _check_stop_loss(self, pos: ManagedPosition, price: float) -> Optional[str]:
        """Check if stop loss has been hit."""
        hit = False
        if pos.side == "BUY" and price <= pos.stop_loss:
            hit = True
        elif pos.side == "SELL" and price >= pos.stop_loss:
            hit = True

        if hit:
            pnl = self._calculate_pnl(pos, price, pos.remaining_amount)
            self._close_position(pos, price, "STOP_LOSS")
            return f"SL HIT {pos.id}: {pos.side} @ {price:.2f} PnL=${pnl:.2f}"

        return None

    def _check_tp1(self, pos: ManagedPosition, price: float) -> Optional[str]:
        """Check and execute partial TP at TP1."""
        if pos.tp1_hit:
            return None

        hit = False
        if pos.side == "BUY" and price >= pos.tp1_price:
            hit = True
        elif pos.side == "SELL" and price <= pos.tp1_price:
            hit = True

        if hit:
            # Close partial position at TP1
            close_amount = pos.amount * pos.tp1_close_pct
            close_amount = self._exchange.amount_to_precision(close_amount, pos.symbol)

            if close_amount > 0:
                try:
                    close_side = "sell" if pos.side == "BUY" else "buy"
                    self._exchange.create_market_order(
                        pos.symbol, close_side, close_amount
                    )
                    pnl = self._calculate_pnl(pos, price, close_amount)
                    pos.remaining_amount -= close_amount
                    pos.tp1_hit = True
                    pos.realized_pnl += pnl

                    # Cancel old SL/TP orders and replace with new amounts
                    self._update_sl_tp_orders(pos)

                    # Activate trailing stop after TP1
                    pos.trailing_active = True

                    logger.info(
                        "TP1 HIT %s: Closed %.8f @ %.2f PnL=$%.2f | Remaining=%.8f",
                        pos.id, close_amount, price, pnl, pos.remaining_amount,
                    )
                    return f"TP1 HIT {pos.id}: Partial close ${pnl:.2f}"
                except Exception as e:
                    logger.error("TP1 execution failed: %s", e)

        return None

    def _check_tp2(self, pos: ManagedPosition, price: float) -> Optional[str]:
        """Check if full TP has been hit."""
        hit = False
        if pos.side == "BUY" and price >= pos.take_profit:
            hit = True
        elif pos.side == "SELL" and price <= pos.take_profit:
            hit = True

        if hit:
            pnl = self._calculate_pnl(pos, price, pos.remaining_amount)
            self._close_position(pos, price, "TAKE_PROFIT")
            return f"TP2 HIT {pos.id}: Full close PnL=${pnl:.2f}"

        return None

    def _check_trailing_stop(self, pos: ManagedPosition, price: float) -> Optional[str]:
        """Adjust trailing stop if conditions are met."""
        if not self._cfg.trailing_stop_enabled:
            return None

        # Activate trailing after reaching activation R:R
        sl_distance = abs(pos.entry_price - pos.stop_loss)
        if pos.side == "BUY":
            current_r = (price - pos.entry_price) / sl_distance if sl_distance > 0 else 0
        else:
            current_r = (pos.entry_price - price) / sl_distance if sl_distance > 0 else 0

        if current_r < self._cfg.trailing_stop_activation_rr:
            return None

        pos.trailing_active = True

        # Calculate new trailing stop
        trail_distance = pos.atr * self._cfg.trailing_stop_trail_atr_multiplier

        if pos.side == "BUY":
            new_sl = pos.highest_price - trail_distance
            if new_sl > pos.stop_loss:
                old_sl = pos.stop_loss
                pos.stop_loss = round(new_sl, 8)
                self._update_sl_tp_orders(pos)
                return f"TRAIL {pos.id}: SL {old_sl:.2f} → {pos.stop_loss:.2f} (R={current_r:.2f})"
        else:
            new_sl = pos.lowest_price + trail_distance
            if new_sl < pos.stop_loss:
                old_sl = pos.stop_loss
                pos.stop_loss = round(new_sl, 8)
                self._update_sl_tp_orders(pos)
                return f"TRAIL {pos.id}: SL {old_sl:.2f} → {pos.stop_loss:.2f} (R={current_r:.2f})"

        return None

    # ── Helpers ────────────────────────────────────────────────────

    def _close_position(self, pos: ManagedPosition, price: float, reason: str) -> None:
        """Close a position entirely."""
        pnl = self._calculate_pnl(pos, price, pos.remaining_amount)
        pos.realized_pnl += pnl

        # Close remaining amount
        if pos.remaining_amount > 0:
            try:
                close_side = "sell" if pos.side == "BUY" else "buy"
                close_amount = self._exchange.amount_to_precision(
                    pos.remaining_amount, pos.symbol
                )
                if close_amount > 0:
                    self._exchange.create_market_order(
                        pos.symbol, close_side, close_amount
                    )
            except Exception as e:
                logger.error("Failed to close position %s: %s", pos.id, e)

        # Cancel remaining SL/TP orders
        self._cancel_position_orders(pos)

        pos.is_open = False
        pos.remaining_amount = 0
        pos.close_reason = reason

        logger.info(
            "POSITION CLOSED: %s | reason=%s | PnL=$%.2f | duration=%ds",
            pos.id, reason, pos.realized_pnl,
            int(time.time() - pos.entry_time),
        )

    def _cancel_position_orders(self, pos: ManagedPosition) -> None:
        """Cancel all pending orders for a position."""
        for order_id in (pos.sl_order_id, pos.tp_order_id):
            if order_id:
                try:
                    self._exchange.cancel_order(order_id, pos.symbol)
                except Exception as e:
                    logger.debug("Cancel order %s: %s", order_id, e)

    def _update_sl_tp_orders(self, pos: ManagedPosition) -> None:
        """Cancel and re-place SL/TP orders with updated amounts/prices."""
        self._cancel_position_orders(pos)

        if pos.remaining_amount <= 0:
            return

        sl_side = "sell" if pos.side == "BUY" else "buy"
        amount = self._exchange.amount_to_precision(pos.remaining_amount, pos.symbol)

        # Re-place SL
        try:
            sl_order = self._exchange.create_stop_loss_order(
                pos.symbol, sl_side, amount, pos.stop_loss
            )
            pos.sl_order_id = sl_order.get("id")
        except Exception as e:
            logger.warning("SL re-place failed: %s", e)
            pos.sl_order_id = None

        # Re-place TP
        try:
            tp_order = self._exchange.create_take_profit_order(
                pos.symbol, sl_side, amount, pos.take_profit
            )
            pos.tp_order_id = tp_order.get("id")
        except Exception as e:
            logger.warning("TP re-place failed: %s", e)
            pos.tp_order_id = None

    @staticmethod
    def _calculate_pnl(pos: ManagedPosition, exit_price: float, amount: float) -> float:
        """Calculate PnL for closing an amount at exit_price."""
        if pos.side == "BUY":
            return (exit_price - pos.entry_price) * amount
        else:
            return (pos.entry_price - exit_price) * amount

    # ── Emergency ─────────────────────────────────────────────────

    def close_all_positions(self, reason: str = "EMERGENCY_CLOSE") -> List[str]:
        """Close all open positions immediately. Used by kill switch."""
        actions = []
        for pos in self.open_positions:
            try:
                # Get current price for PnL tracking
                ticker = self._exchange.fetch_ticker(pos.symbol)
                price = ticker.get("last", pos.entry_price)
                self._close_position(pos, price, reason)
                actions.append(f"Closed {pos.id} ({reason})")
            except Exception as e:
                logger.error("Emergency close failed for %s: %s", pos.id, e)
                actions.append(f"FAILED to close {pos.id}: {e}")
        return actions
