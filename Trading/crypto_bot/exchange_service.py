"""
Exchange Service — ccxt wrapper with retry, rate limiting, and DRY RUN mode.

Supports Binance by default but easily extensible to other exchanges.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

import ccxt

from crypto_bot.config import Config, get_config

logger = logging.getLogger(__name__)

# Rate limiting: Binance allows 1200 requests/minute ≈ 20/sec.
# We cap at 10/sec to leave headroom.
_MIN_REQUEST_INTERVAL = 0.1  # 100ms between requests


class ExchangeService:
    """
    ccxt wrapper with:
    - Automatic retry on transient errors (3 attempts, exponential backoff)
    - Rate limiting (respects exchange limits)
    - DRY RUN mode (simulates orders without sending to exchange)
    """

    def __init__(self, config: Optional[Config] = None):
        self._cfg = config or get_config()
        self._exchange: Optional[ccxt.Exchange] = None
        self._last_request_time: float = 0.0
        self._connected = False
        self._dry_run_order_id = 100000

        # DRY RUN simulated balance
        self._sim_balance: Dict[str, float] = {"USDT": 10000.0, "BTC": 0.0}
        self._sim_orders: List[Dict[str, Any]] = []

    @property
    def connected(self) -> bool:
        return self._connected

    @property
    def dry_run(self) -> bool:
        return self._cfg.dry_run

    def connect(self) -> bool:
        """Initialize the exchange connection."""
        try:
            exchange_class = getattr(ccxt, self._cfg.exchange_id)
            self._exchange = exchange_class({
                "apiKey": self._cfg.api_key if not self._cfg.dry_run else "",
                "secret": self._cfg.api_secret if not self._cfg.dry_run else "",
                "sandbox": self._cfg.dry_run,
                "enableRateLimit": True,
                "options": {
                    "defaultType": "spot",
                    "adjustForTimeDifference": True,
                },
            })

            # Test connection by loading markets
            self._exchange.load_markets()
            self._connected = True

            logger.info(
                "Exchange connected: %s (dry_run=%s, markets=%d)",
                self._cfg.exchange_id,
                self._cfg.dry_run,
                len(self._exchange.markets),
            )
            return True

        except Exception as e:
            logger.error("Exchange connection failed: %s", e)
            self._connected = False
            return False

    def disconnect(self) -> None:
        """Clean up exchange connection."""
        self._exchange = None
        self._connected = False
        logger.info("Exchange disconnected")

    # ── Market Data ───────────────────────────────────────────────

    def fetch_ohlcv(
        self,
        symbol: Optional[str] = None,
        timeframe: Optional[str] = None,
        limit: int = 300,
    ) -> List[List]:
        """
        Fetch OHLCV candle data.

        Returns list of [timestamp, open, high, low, close, volume].
        """
        symbol = symbol or self._cfg.symbol
        timeframe = timeframe or self._cfg.timeframe
        return self._retry(
            lambda: self._exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
        )

    def fetch_ticker(self, symbol: Optional[str] = None) -> Dict[str, Any]:
        """Fetch current ticker (bid, ask, last, volume, etc.)."""
        symbol = symbol or self._cfg.symbol
        return self._retry(lambda: self._exchange.fetch_ticker(symbol))

    def fetch_order_book(self, symbol: Optional[str] = None, limit: int = 20) -> Dict[str, Any]:
        """Fetch order book."""
        symbol = symbol or self._cfg.symbol
        return self._retry(lambda: self._exchange.fetch_order_book(symbol, limit))

    # ── Account ───────────────────────────────────────────────────

    def fetch_balance(self) -> Dict[str, Any]:
        """Fetch account balance."""
        if self._cfg.dry_run:
            return self._sim_get_balance()

        raw = self._retry(lambda: self._exchange.fetch_balance())
        return {
            "total": raw.get("total", {}),
            "free": raw.get("free", {}),
            "used": raw.get("used", {}),
        }

    def fetch_open_orders(self, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        """Fetch open orders."""
        symbol = symbol or self._cfg.symbol
        if self._cfg.dry_run:
            return [o for o in self._sim_orders if o["status"] == "open"]

        return self._retry(lambda: self._exchange.fetch_open_orders(symbol))

    # ── Order Management ──────────────────────────────────────────

    def create_market_order(
        self,
        symbol: str,
        side: str,
        amount: float,
    ) -> Dict[str, Any]:
        """
        Place a market order.

        Args:
            symbol: Trading pair (e.g. 'BTC/USDT')
            side: 'buy' or 'sell'
            amount: Quantity of base currency

        Returns:
            Order result dict with id, price, amount, status, etc.
        """
        if self._cfg.dry_run:
            return self._sim_create_order(symbol, "market", side, amount)

        return self._retry(
            lambda: self._exchange.create_order(symbol, "market", side, amount)
        )

    def create_limit_order(
        self,
        symbol: str,
        side: str,
        amount: float,
        price: float,
    ) -> Dict[str, Any]:
        """Place a limit order."""
        if self._cfg.dry_run:
            return self._sim_create_order(symbol, "limit", side, amount, price)

        return self._retry(
            lambda: self._exchange.create_order(symbol, "limit", side, amount, price)
        )

    def create_stop_loss_order(
        self,
        symbol: str,
        side: str,
        amount: float,
        stop_price: float,
    ) -> Dict[str, Any]:
        """Place a stop-loss order."""
        if self._cfg.dry_run:
            return self._sim_create_order(symbol, "stop_loss", side, amount, stop_price)

        params = {"stopPrice": stop_price}
        return self._retry(
            lambda: self._exchange.create_order(
                symbol, "stop_market", side, amount, None, params
            )
        )

    def create_take_profit_order(
        self,
        symbol: str,
        side: str,
        amount: float,
        tp_price: float,
    ) -> Dict[str, Any]:
        """Place a take-profit order."""
        if self._cfg.dry_run:
            return self._sim_create_order(symbol, "take_profit", side, amount, tp_price)

        params = {"stopPrice": tp_price}
        return self._retry(
            lambda: self._exchange.create_order(
                symbol, "take_profit_market", side, amount, None, params
            )
        )

    def cancel_order(self, order_id: str, symbol: Optional[str] = None) -> Dict[str, Any]:
        """Cancel an order by ID."""
        symbol = symbol or self._cfg.symbol
        if self._cfg.dry_run:
            return self._sim_cancel_order(order_id)

        return self._retry(lambda: self._exchange.cancel_order(order_id, symbol))

    def cancel_all_orders(self, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        """Cancel all open orders for a symbol."""
        symbol = symbol or self._cfg.symbol
        if self._cfg.dry_run:
            cancelled = [o for o in self._sim_orders if o["status"] == "open"]
            for o in cancelled:
                o["status"] = "canceled"
            return cancelled

        return self._retry(lambda: self._exchange.cancel_all_orders(symbol))

    # ── Market Info ───────────────────────────────────────────────

    def get_market_info(self, symbol: Optional[str] = None) -> Dict[str, Any]:
        """Get market constraints (min order, precision, etc.)."""
        symbol = symbol or self._cfg.symbol
        if not self._exchange or symbol not in self._exchange.markets:
            return {}
        market = self._exchange.markets[symbol]
        return {
            "min_amount": market.get("limits", {}).get("amount", {}).get("min", 0),
            "min_cost": market.get("limits", {}).get("cost", {}).get("min", 0),
            "amount_precision": market.get("precision", {}).get("amount", 8),
            "price_precision": market.get("precision", {}).get("price", 2),
            "base": market.get("base", ""),
            "quote": market.get("quote", ""),
        }

    def amount_to_precision(self, amount: float, symbol: Optional[str] = None) -> float:
        """Round amount to exchange precision."""
        symbol = symbol or self._cfg.symbol
        if not self._exchange:
            return amount
        return float(self._exchange.amount_to_precision(symbol, amount))

    def price_to_precision(self, price: float, symbol: Optional[str] = None) -> float:
        """Round price to exchange precision."""
        symbol = symbol or self._cfg.symbol
        if not self._exchange:
            return price
        return float(self._exchange.price_to_precision(symbol, price))

    # ── Retry Logic ───────────────────────────────────────────────

    def _retry(self, fn, max_retries: int = 3) -> Any:
        """
        Execute fn with retry on transient errors.

        Uses exponential backoff: 1s, 2s, 4s.
        """
        last_error = None
        for attempt in range(max_retries):
            self._rate_limit()
            try:
                return fn()
            except (
                ccxt.NetworkError,
                ccxt.ExchangeNotAvailable,
                ccxt.RequestTimeout,
                ccxt.DDoSProtection,
            ) as e:
                last_error = e
                wait = 2 ** attempt
                logger.warning(
                    "Exchange request failed (attempt %d/%d), retrying in %ds: %s",
                    attempt + 1, max_retries, wait, e,
                )
                time.sleep(wait)
            except ccxt.ExchangeError as e:
                # Non-transient — don't retry
                logger.error("Exchange error (no retry): %s", e)
                raise
            except Exception as e:
                logger.error("Unexpected exchange error: %s", e)
                raise

        raise last_error or RuntimeError("Max retries exceeded")

    def _rate_limit(self) -> None:
        """Enforce minimum interval between requests."""
        now = time.monotonic()
        elapsed = now - self._last_request_time
        if elapsed < _MIN_REQUEST_INTERVAL:
            time.sleep(_MIN_REQUEST_INTERVAL - elapsed)
        self._last_request_time = time.monotonic()

    # ── DRY RUN Simulation ────────────────────────────────────────

    def _sim_get_balance(self) -> Dict[str, Any]:
        return {
            "total": dict(self._sim_balance),
            "free": dict(self._sim_balance),
            "used": {k: 0.0 for k in self._sim_balance},
        }

    def _sim_create_order(
        self,
        symbol: str,
        order_type: str,
        side: str,
        amount: float,
        price: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Simulate order placement in DRY RUN mode."""
        self._dry_run_order_id += 1
        order_id = f"DRY-{self._dry_run_order_id}"

        # Get last price for market orders
        if price is None:
            try:
                ticker = self.fetch_ticker(symbol)
                price = ticker.get("last", 0)
            except Exception:
                price = 0

        # Simulate balance changes for market orders
        if order_type == "market":
            base, quote = symbol.split("/")
            if side == "buy":
                cost = amount * price
                if self._sim_balance.get(quote, 0) >= cost:
                    self._sim_balance[quote] = self._sim_balance.get(quote, 0) - cost
                    self._sim_balance[base] = self._sim_balance.get(base, 0) + amount
            elif side == "sell":
                if self._sim_balance.get(base, 0) >= amount:
                    self._sim_balance[base] = self._sim_balance.get(base, 0) - amount
                    self._sim_balance[quote] = self._sim_balance.get(quote, 0) + amount * price

        order = {
            "id": order_id,
            "symbol": symbol,
            "type": order_type,
            "side": side,
            "amount": amount,
            "price": price,
            "cost": amount * price if price else 0,
            "status": "closed" if order_type == "market" else "open",
            "timestamp": int(time.time() * 1000),
            "dry_run": True,
        }

        self._sim_orders.append(order)
        logger.info(
            "DRY RUN: %s %s %.8f %s @ %.2f (id=%s)",
            order_type.upper(), side.upper(), amount, symbol, price or 0, order_id,
        )
        return order

    def _sim_cancel_order(self, order_id: str) -> Dict[str, Any]:
        for order in self._sim_orders:
            if order["id"] == order_id and order["status"] == "open":
                order["status"] = "canceled"
                logger.info("DRY RUN: Cancelled order %s", order_id)
                return order
        return {"id": order_id, "status": "not_found"}
