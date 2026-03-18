"""
MT5 Integration Service for XAUUSD Trading System.

Provides a unified interface to MetaTrader 5 for retrieving market data,
managing orders, and querying account information. Falls back to a realistic
simulation mode when the MT5 terminal is unavailable (e.g. on macOS/Linux).
"""

from __future__ import annotations

import logging
import random
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Try to import the real MetaTrader5 package (Windows only)
# ---------------------------------------------------------------------------
try:
    import MetaTrader5 as mt5

    MT5_AVAILABLE = True
except ImportError:
    mt5 = None  # type: ignore[assignment]
    MT5_AVAILABLE = False
    logger.info("MetaTrader5 package not found - simulation mode will be used.")

# ---------------------------------------------------------------------------
# Timeframe mapping used by the simulation layer
# ---------------------------------------------------------------------------
TIMEFRAME_MAP: Dict[str, int] = {
    "M1": 1,
    "M5": 5,
    "M15": 15,
    "M30": 30,
    "H1": 60,
    "H4": 240,
    "D1": 1440,
    "W1": 10080,
    "MN1": 43200,
}


class MT5Service:
    """Wrapper around the MetaTrader 5 Python API with simulation fallback."""

    def __init__(self) -> None:
        self._connected: bool = False
        self._simulation: bool = not MT5_AVAILABLE
        self._sim_base_price: float = 3000.0  # realistic XAUUSD mid-price
        self._sim_positions: List[Dict[str, Any]] = []
        self._sim_ticket_counter: int = 100_000
        self._sim_balance: float = 10_000.0
        self._sim_equity: float = 10_000.0

    # ------------------------------------------------------------------
    # Connection
    # ------------------------------------------------------------------

    def connect(
        self,
        login: int,
        password: str,
        server: str,
        terminal_path: Optional[str] = None,
    ) -> bool:
        """
        Initialise and log in to the MT5 terminal.

        Args:
            login: MT5 account number.
            password: Account password.
            server: Broker server name.
            terminal_path: Optional path to the MT5 terminal executable.

        Returns:
            True if connected (or simulation mode activated) successfully.
        """
        if self._simulation:
            logger.info(
                "MT5 not available - entering simulation mode "
                "(login=%s, server=%s).",
                login,
                server,
            )
            self._connected = True
            return True

        init_kwargs: Dict[str, Any] = {
            "login": login,
            "password": password,
            "server": server,
        }
        if terminal_path:
            init_kwargs["path"] = terminal_path

        if not mt5.initialize(**init_kwargs):
            error = mt5.last_error()
            logger.error("MT5 initialisation failed: %s", error)
            return False

        self._connected = True
        logger.info("Connected to MT5 (login=%s, server=%s).", login, server)
        return True

    def disconnect(self) -> None:
        """Shut down the MT5 connection."""
        if not self._simulation and self._connected:
            mt5.shutdown()
        self._connected = False
        logger.info("MT5 disconnected.")

    # ------------------------------------------------------------------
    # Account info
    # ------------------------------------------------------------------

    def get_account_info(self) -> Dict[str, float]:
        """
        Retrieve current account metrics.

        Returns:
            Dict with keys: balance, equity, margin, free_margin,
            margin_level, floating_pl.
        """
        self._ensure_connected()

        if self._simulation:
            floating_pl = sum(
                p.get("floating_pl", 0.0) for p in self._sim_positions
            )
            equity = self._sim_balance + floating_pl
            margin = sum(p.get("margin", 0.0) for p in self._sim_positions)
            free_margin = equity - margin
            margin_level = (equity / margin * 100.0) if margin > 0 else 0.0
            return {
                "balance": round(self._sim_balance, 2),
                "equity": round(equity, 2),
                "margin": round(margin, 2),
                "free_margin": round(free_margin, 2),
                "margin_level": round(margin_level, 2),
                "floating_pl": round(floating_pl, 2),
            }

        info = mt5.account_info()
        if info is None:
            raise RuntimeError(f"Failed to get account info: {mt5.last_error()}")
        return {
            "balance": info.balance,
            "equity": info.equity,
            "margin": info.margin,
            "free_margin": info.margin_free,
            "margin_level": info.margin_level,
            "floating_pl": info.profit,
        }

    # ------------------------------------------------------------------
    # Market data
    # ------------------------------------------------------------------

    def get_tick(self, symbol: str = "XAUUSD") -> Dict[str, float]:
        """
        Get the latest tick for *symbol*.

        Returns:
            Dict with keys: bid, ask, spread.
        """
        self._ensure_connected()

        if self._simulation:
            noise = random.gauss(0, 0.50)
            bid = round(self._sim_base_price + noise, 2)
            spread_points = random.choice([15, 20, 25, 30])
            ask = round(bid + spread_points * 0.01, 2)
            return {
                "bid": bid,
                "ask": ask,
                "spread": round(ask - bid, 2),
            }

        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            raise RuntimeError(
                f"Failed to get tick for {symbol}: {mt5.last_error()}"
            )
        return {
            "bid": tick.bid,
            "ask": tick.ask,
            "spread": round(tick.ask - tick.bid, 2),
        }

    def get_bars(
        self,
        symbol: str,
        timeframe: str,
        count: int = 300,
    ) -> pd.DataFrame:
        """
        Fetch OHLCV bars for *symbol* on the given *timeframe*.

        Args:
            symbol: Instrument symbol (e.g. ``"XAUUSD"``).
            timeframe: One of ``M1, M5, M15, M30, H1, H4, D1, W1, MN1``.
            count: Number of bars to retrieve.

        Returns:
            DataFrame with columns: time, open, high, low, close, volume.
        """
        self._ensure_connected()

        if self._simulation:
            return self._generate_simulated_bars(symbol, timeframe, count)

        tf_const = self._resolve_timeframe(timeframe)
        rates = mt5.copy_rates_from_pos(symbol, tf_const, 0, count)
        if rates is None or len(rates) == 0:
            raise RuntimeError(
                f"Failed to get bars for {symbol}/{timeframe}: {mt5.last_error()}"
            )
        df = pd.DataFrame(rates)
        df["time"] = pd.to_datetime(df["time"], unit="s")
        df = df[["time", "open", "high", "low", "close", "tick_volume"]]
        df.rename(columns={"tick_volume": "volume"}, inplace=True)
        return df

    def get_symbol_info(self, symbol: str = "XAUUSD") -> Dict[str, float]:
        """
        Retrieve trading specification for *symbol*.

        Returns:
            Dict with keys: volume_min, volume_max, volume_step, point,
            trade_contract_size.
        """
        self._ensure_connected()

        if self._simulation:
            return {
                "volume_min": 0.01,
                "volume_max": 100.0,
                "volume_step": 0.01,
                "point": 0.01,
                "trade_contract_size": 100.0,  # 1 lot = 100 oz
            }

        info = mt5.symbol_info(symbol)
        if info is None:
            raise RuntimeError(
                f"Failed to get symbol info for {symbol}: {mt5.last_error()}"
            )
        return {
            "volume_min": info.volume_min,
            "volume_max": info.volume_max,
            "volume_step": info.volume_step,
            "point": info.point,
            "trade_contract_size": info.trade_contract_size,
        }

    # ------------------------------------------------------------------
    # Order management
    # ------------------------------------------------------------------

    def place_order(
        self,
        symbol: str,
        side: str,
        volume: float,
        price: float,
        sl: float,
        tp: float,
        magic: int = 123456,
        comment: str = "",
    ) -> Dict[str, Any]:
        """
        Send a market order.

        Args:
            symbol: Instrument symbol.
            side: ``"BUY"`` or ``"SELL"``.
            volume: Lot size.
            price: Desired execution price.
            sl: Stop-loss price.
            tp: Take-profit price.
            magic: Expert Advisor magic number.
            comment: Order comment.

        Returns:
            Dict with keys: success, ticket, retcode, comment.
        """
        self._ensure_connected()

        if self._simulation:
            self._sim_ticket_counter += 1
            ticket = self._sim_ticket_counter
            margin_required = volume * 100.0 * price * 0.01  # ~1% margin
            self._sim_positions.append(
                {
                    "ticket": ticket,
                    "symbol": symbol,
                    "side": side.upper(),
                    "volume": volume,
                    "price_open": price,
                    "sl": sl,
                    "tp": tp,
                    "magic": magic,
                    "comment": comment,
                    "time_open": datetime.now(tz=timezone.utc),
                    "floating_pl": 0.0,
                    "margin": round(margin_required, 2),
                }
            )
            logger.info(
                "SIM order placed: ticket=%s %s %s %.2f lots @ %.2f "
                "SL=%.2f TP=%.2f",
                ticket, side, symbol, volume, price, sl, tp,
            )
            return {
                "success": True,
                "ticket": ticket,
                "retcode": 10009,
                "comment": "Simulated order filled",
            }

        order_type = (
            mt5.ORDER_TYPE_BUY if side.upper() == "BUY" else mt5.ORDER_TYPE_SELL
        )
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": volume,
            "type": order_type,
            "price": price,
            "sl": sl,
            "tp": tp,
            "magic": magic,
            "comment": comment,
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        result = mt5.order_send(request)
        if result is None:
            raise RuntimeError(f"Order send returned None: {mt5.last_error()}")
        return {
            "success": result.retcode == mt5.TRADE_RETCODE_DONE,
            "ticket": result.order,
            "retcode": result.retcode,
            "comment": result.comment,
        }

    def close_position(self, ticket: int) -> Dict[str, Any]:
        """
        Close an open position by its *ticket* number.

        Returns:
            Dict with keys: success, retcode, comment.
        """
        self._ensure_connected()

        if self._simulation:
            for i, pos in enumerate(self._sim_positions):
                if pos["ticket"] == ticket:
                    closed = self._sim_positions.pop(i)
                    self._sim_balance += closed.get("floating_pl", 0.0)
                    logger.info("SIM position %s closed.", ticket)
                    return {
                        "success": True,
                        "retcode": 10009,
                        "comment": "Simulated position closed",
                    }
            return {
                "success": False,
                "retcode": -1,
                "comment": f"Ticket {ticket} not found in simulation",
            }

        position = None
        positions = mt5.positions_get(ticket=ticket)
        if positions and len(positions) > 0:
            position = positions[0]
        if position is None:
            return {
                "success": False,
                "retcode": -1,
                "comment": f"Position {ticket} not found",
            }

        close_type = (
            mt5.ORDER_TYPE_SELL
            if position.type == mt5.ORDER_TYPE_BUY
            else mt5.ORDER_TYPE_BUY
        )
        tick = mt5.symbol_info_tick(position.symbol)
        close_price = tick.bid if close_type == mt5.ORDER_TYPE_SELL else tick.ask

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": position.symbol,
            "volume": position.volume,
            "type": close_type,
            "position": ticket,
            "price": close_price,
            "magic": position.magic,
            "comment": "Close position",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        result = mt5.order_send(request)
        if result is None:
            raise RuntimeError(f"Close order returned None: {mt5.last_error()}")
        return {
            "success": result.retcode == mt5.TRADE_RETCODE_DONE,
            "retcode": result.retcode,
            "comment": result.comment,
        }

    # ------------------------------------------------------------------
    # Position / history queries
    # ------------------------------------------------------------------

    def get_positions(self, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List open positions, optionally filtered by *symbol*.

        Returns:
            List of position dicts with keys: ticket, symbol, side, volume,
            price_open, sl, tp, floating_pl, time_open, magic, comment.
        """
        self._ensure_connected()

        if self._simulation:
            positions = self._sim_positions
            if symbol:
                positions = [p for p in positions if p["symbol"] == symbol]
            return [self._format_sim_position(p) for p in positions]

        if symbol:
            raw = mt5.positions_get(symbol=symbol)
        else:
            raw = mt5.positions_get()

        if raw is None:
            return []

        return [
            {
                "ticket": p.ticket,
                "symbol": p.symbol,
                "side": "BUY" if p.type == 0 else "SELL",
                "volume": p.volume,
                "price_open": p.price_open,
                "sl": p.sl,
                "tp": p.tp,
                "floating_pl": p.profit,
                "time_open": datetime.fromtimestamp(p.time, tz=timezone.utc),
                "magic": p.magic,
                "comment": p.comment,
            }
            for p in raw
        ]

    def get_history(
        self,
        from_date: datetime,
        to_date: datetime,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve closed deals between *from_date* and *to_date*.

        Returns:
            List of deal dicts with keys: ticket, symbol, side, volume,
            price, profit, commission, swap, time, comment.
        """
        self._ensure_connected()

        if self._simulation:
            logger.info("SIM history requested - returning empty list.")
            return []

        deals = mt5.history_deals_get(from_date, to_date)
        if deals is None:
            return []

        return [
            {
                "ticket": d.ticket,
                "symbol": d.symbol,
                "side": "BUY" if d.type == 0 else "SELL",
                "volume": d.volume,
                "price": d.price,
                "profit": d.profit,
                "commission": d.commission,
                "swap": d.swap,
                "time": datetime.fromtimestamp(d.time, tz=timezone.utc),
                "comment": d.comment,
            }
            for d in deals
        ]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _ensure_connected(self) -> None:
        if not self._connected:
            raise RuntimeError(
                "MT5 service is not connected. Call connect() first."
            )

    @staticmethod
    def _resolve_timeframe(tf_str: str) -> int:
        """Convert a string timeframe to the MT5 constant."""
        mapping = {
            "M1": mt5.TIMEFRAME_M1,
            "M5": mt5.TIMEFRAME_M5,
            "M15": mt5.TIMEFRAME_M15,
            "M30": mt5.TIMEFRAME_M30,
            "H1": mt5.TIMEFRAME_H1,
            "H4": mt5.TIMEFRAME_H4,
            "D1": mt5.TIMEFRAME_D1,
            "W1": mt5.TIMEFRAME_W1,
            "MN1": mt5.TIMEFRAME_MN1,
        }
        const = mapping.get(tf_str.upper())
        if const is None:
            raise ValueError(
                f"Unknown timeframe '{tf_str}'. "
                f"Valid values: {list(mapping.keys())}"
            )
        return const

    def _generate_simulated_bars(
        self,
        symbol: str,
        timeframe: str,
        count: int,
    ) -> pd.DataFrame:
        """
        Generate realistic simulated OHLCV bars for XAUUSD around $3000.

        Uses a geometric random walk with mean-reversion to keep the price
        in a plausible range.
        """
        minutes_per_bar = TIMEFRAME_MAP.get(timeframe.upper(), 60)
        now = datetime.now(tz=timezone.utc)
        timestamps = [
            now - timedelta(minutes=minutes_per_bar * (count - 1 - i))
            for i in range(count)
        ]

        np.random.seed(None)  # fresh randomness each call
        price = self._sim_base_price
        rows = []
        for ts in timestamps:
            # Mean-reverting random walk
            drift = -0.001 * (price - self._sim_base_price)
            ret = drift + np.random.normal(0, 0.0015)
            price *= 1 + ret

            open_price = round(price, 2)
            intra_vol = abs(np.random.normal(0, 0.003))
            high = round(open_price * (1 + intra_vol), 2)
            low = round(open_price * (1 - intra_vol), 2)
            close = round(
                low + (high - low) * np.random.uniform(0.2, 0.8), 2
            )
            volume = int(np.random.lognormal(mean=7, sigma=1))
            rows.append(
                {
                    "time": ts,
                    "open": open_price,
                    "high": high,
                    "low": low,
                    "close": close,
                    "volume": volume,
                }
            )

        # Update sim base price to the last close for continuity
        self._sim_base_price = rows[-1]["close"]

        return pd.DataFrame(rows)

    @staticmethod
    def _format_sim_position(pos: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "ticket": pos["ticket"],
            "symbol": pos["symbol"],
            "side": pos["side"],
            "volume": pos["volume"],
            "price_open": pos["price_open"],
            "sl": pos["sl"],
            "tp": pos["tp"],
            "floating_pl": pos.get("floating_pl", 0.0),
            "time_open": pos.get("time_open"),
            "magic": pos.get("magic", 0),
            "comment": pos.get("comment", ""),
        }
