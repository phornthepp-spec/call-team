"""
MetaTrader 5 integration service.

Handles connection lifecycle, market data, order management, and position
queries. Falls back to simulation mode on non-Windows or when MT5 is
unavailable.
"""

from __future__ import annotations

import logging
import random
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from app.brokers.base import BaseBrokerProfile
from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Try importing MT5
try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except ImportError:
    mt5 = None  # type: ignore
    MT5_AVAILABLE = False
    logger.info("MetaTrader5 package not available — simulation mode enabled.")

TIMEFRAME_MAP = {
    "M1": 1, "M5": 5, "M15": 15, "M30": 30,
    "H1": 60, "H4": 240, "D1": 1440, "W1": 10080, "MN1": 43200,
}


class MT5Service:
    """
    Unified MT5 interface with simulation fallback and broker profile awareness.
    """

    def __init__(self, broker_profile: Optional[BaseBrokerProfile] = None):
        self._connected = False
        self._simulation = not MT5_AVAILABLE or get_settings().MT5_SIMULATION_MODE
        self._broker = broker_profile
        self._last_heartbeat: Optional[float] = None

        # Simulation state
        self._sim_base_price = 3000.0
        self._sim_positions: List[Dict[str, Any]] = []
        self._sim_ticket_counter = 100_000
        self._sim_balance = 10_000.0

    @property
    def connected(self) -> bool:
        return self._connected

    @property
    def simulation_mode(self) -> bool:
        return self._simulation

    @property
    def last_heartbeat(self) -> Optional[float]:
        return self._last_heartbeat

    # ── Connection ────────────────────────────────────────────────

    def connect(
        self,
        login: int,
        password: str,
        server: str,
        terminal_path: Optional[str] = None,
    ) -> bool:
        """Initialize MT5 and log in. Tries server candidates from broker profile."""
        if self._simulation:
            self._connected = True
            self._last_heartbeat = time.time()
            logger.info("MT5 SIM: connected (login=%s, server=%s)", login, server)
            return True

        servers_to_try = [server]
        if self._broker:
            servers_to_try = self._broker.mt5_server_candidates

        for srv in servers_to_try:
            init_kwargs: Dict[str, Any] = {
                "login": login, "password": password, "server": srv,
            }
            if terminal_path:
                init_kwargs["path"] = terminal_path

            if mt5.initialize(**init_kwargs):
                self._connected = True
                self._last_heartbeat = time.time()
                logger.info("MT5 connected: login=%s server=%s", login, srv)

                # Symbol select for primary symbol
                if self._broker:
                    self._ensure_symbol_visible(self._broker.symbol_config.broker_symbol)
                return True

            error = mt5.last_error()
            logger.warning("MT5 init failed for %s: %s", srv, error)

        logger.error("MT5 connection failed for all server candidates: %s", servers_to_try)
        return False

    def disconnect(self) -> None:
        if not self._simulation and self._connected:
            mt5.shutdown()
        self._connected = False
        logger.info("MT5 disconnected.")

    def ping(self) -> bool:
        """Check if MT5 is still responsive."""
        if self._simulation:
            self._last_heartbeat = time.time()
            return True
        try:
            info = mt5.terminal_info()
            alive = info is not None
            if alive:
                self._last_heartbeat = time.time()
            return alive
        except Exception:
            return False

    # ── Symbol management ─────────────────────────────────────────

    def _ensure_symbol_visible(self, symbol: str) -> bool:
        """Make sure the symbol is visible in Market Watch."""
        if self._simulation:
            return True
        selected = mt5.symbol_select(symbol, True)
        if not selected:
            logger.warning("Failed to select symbol %s in Market Watch", symbol)
        return selected

    def resolve_symbol(self, canonical: str = "XAUUSD") -> str:
        """Resolve canonical symbol to broker symbol using alias list."""
        if not self._broker:
            return canonical
        if self._simulation:
            return canonical

        # Get all available symbols
        symbols = mt5.symbols_get()
        if symbols is None:
            return canonical
        available = [s.name for s in symbols]
        resolved = self._broker.resolve_symbol(canonical, available)
        return resolved or canonical

    def get_symbol_info(self, symbol: str = "XAUUSD") -> Dict[str, Any]:
        """Get symbol specification (merged with broker overrides)."""
        self._ensure_connected()

        if self._simulation:
            cfg = self._broker.symbol_config if self._broker else None
            return {
                "volume_min": cfg.volume_min if cfg else 0.01,
                "volume_max": cfg.volume_max if cfg else 100.0,
                "volume_step": cfg.volume_step if cfg else 0.01,
                "point": cfg.point if cfg else 0.01,
                "digits": cfg.digits if cfg else 2,
                "trade_contract_size": cfg.contract_size if cfg else 100.0,
                "stop_level": cfg.stop_level if cfg else 0,
                "freeze_level": cfg.freeze_level if cfg else 0,
                "filling_mode": 0,
                "execution_mode": 0,
                "visible": True,
                "spread": random.choice([15, 20, 25]),
            }

        info = mt5.symbol_info(symbol)
        if info is None:
            raise RuntimeError(f"Failed to get symbol info for {symbol}: {mt5.last_error()}")
        return {
            "volume_min": info.volume_min,
            "volume_max": info.volume_max,
            "volume_step": info.volume_step,
            "point": info.point,
            "digits": info.digits,
            "trade_contract_size": info.trade_contract_size,
            "stop_level": info.trade_stops_level,
            "freeze_level": info.trade_freeze_level,
            "filling_mode": info.filling_mode,
            "execution_mode": info.execution_mode,
            "visible": info.visible,
            "spread": info.spread,
        }

    # ── Account info ──────────────────────────────────────────────

    def get_account_info(self) -> Dict[str, float]:
        self._ensure_connected()
        if self._simulation:
            floating = sum(p.get("floating_pl", 0.0) for p in self._sim_positions)
            eq = self._sim_balance + floating
            margin = sum(p.get("margin", 0.0) for p in self._sim_positions)
            fm = eq - margin
            ml = (eq / margin * 100) if margin > 0 else 0
            return {
                "balance": round(self._sim_balance, 2),
                "equity": round(eq, 2),
                "margin": round(margin, 2),
                "free_margin": round(fm, 2),
                "margin_level": round(ml, 2),
                "floating_pl": round(floating, 2),
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

    # ── Market data ───────────────────────────────────────────────

    def get_tick(self, symbol: str = "XAUUSD") -> Dict[str, Any]:
        self._ensure_connected()
        if self._simulation:
            noise = random.gauss(0, 0.5)
            bid = round(self._sim_base_price + noise, 2)
            spread_pts = random.choice([15, 20, 25])
            ask = round(bid + spread_pts * 0.01, 2)
            return {
                "bid": bid, "ask": ask,
                "spread": round(ask - bid, 2),
                "spread_points": spread_pts,
                "time": time.time(),
            }

        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            raise RuntimeError(f"Failed to get tick: {mt5.last_error()}")
        point = 0.01  # XAUUSD
        return {
            "bid": tick.bid, "ask": tick.ask,
            "spread": round(tick.ask - tick.bid, 5),
            "spread_points": round((tick.ask - tick.bid) / point, 1),
            "time": tick.time,
        }

    def get_bars(self, symbol: str, timeframe: str, count: int = 300) -> pd.DataFrame:
        self._ensure_connected()
        if self._simulation:
            return self._generate_sim_bars(count, timeframe)

        tf_const = self._resolve_tf(timeframe)
        rates = mt5.copy_rates_from_pos(symbol, tf_const, 0, count)
        if rates is None or len(rates) == 0:
            raise RuntimeError(f"Failed to get bars: {mt5.last_error()}")
        df = pd.DataFrame(rates)
        df["time"] = pd.to_datetime(df["time"], unit="s")
        df.rename(columns={"tick_volume": "volume"}, inplace=True)
        return df[["time", "open", "high", "low", "close", "volume"]]

    # ── Order management ──────────────────────────────────────────

    def place_order(
        self, symbol: str, side: str, volume: float, price: float,
        sl: float, tp: float, magic: int = 999999,
        comment: str = "", deviation: int = 20,
    ) -> Dict[str, Any]:
        self._ensure_connected()

        if self._simulation:
            self._sim_ticket_counter += 1
            ticket = self._sim_ticket_counter
            margin_req = volume * 100 * price * 0.01
            self._sim_positions.append({
                "ticket": ticket, "symbol": symbol, "side": side.upper(),
                "volume": volume, "price_open": price, "sl": sl, "tp": tp,
                "magic": magic, "comment": comment,
                "time_open": datetime.now(tz=timezone.utc),
                "floating_pl": 0.0, "margin": round(margin_req, 2),
            })
            return {
                "success": True, "ticket": ticket, "retcode": 10009,
                "price": price, "comment": "SIM filled",
                "slippage": 0.0,
            }

        order_type = mt5.ORDER_TYPE_BUY if side.upper() == "BUY" else mt5.ORDER_TYPE_SELL
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
            "deviation": deviation,
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        result = mt5.order_send(request)
        if result is None:
            raise RuntimeError(f"Order send returned None: {mt5.last_error()}")

        actual_price = result.price if hasattr(result, 'price') else price
        slippage = abs(actual_price - price) / 0.01 if price > 0 else 0

        return {
            "success": result.retcode == mt5.TRADE_RETCODE_DONE,
            "ticket": result.order,
            "retcode": result.retcode,
            "price": actual_price,
            "comment": result.comment,
            "slippage": round(slippage, 1),
        }

    def close_position(self, ticket: int) -> Dict[str, Any]:
        self._ensure_connected()
        if self._simulation:
            for i, p in enumerate(self._sim_positions):
                if p["ticket"] == ticket:
                    closed = self._sim_positions.pop(i)
                    self._sim_balance += closed.get("floating_pl", 0.0)
                    return {"success": True, "retcode": 10009, "comment": "SIM closed"}
            return {"success": False, "retcode": -1, "comment": "Ticket not found"}

        positions = mt5.positions_get(ticket=ticket)
        if not positions:
            return {"success": False, "retcode": -1, "comment": "Position not found"}
        pos = positions[0]
        close_type = mt5.ORDER_TYPE_SELL if pos.type == 0 else mt5.ORDER_TYPE_BUY
        tick = mt5.symbol_info_tick(pos.symbol)
        close_price = tick.bid if close_type == mt5.ORDER_TYPE_SELL else tick.ask
        request = {
            "action": mt5.TRADE_ACTION_DEAL, "symbol": pos.symbol,
            "volume": pos.volume, "type": close_type,
            "position": ticket, "price": close_price,
            "magic": pos.magic, "comment": "Close",
            "type_time": mt5.ORDER_TIME_GTC, "type_filling": mt5.ORDER_FILLING_IOC,
        }
        result = mt5.order_send(request)
        if result is None:
            raise RuntimeError(f"Close returned None: {mt5.last_error()}")
        return {
            "success": result.retcode == mt5.TRADE_RETCODE_DONE,
            "retcode": result.retcode, "comment": result.comment,
            "price": close_price,
        }

    def get_positions(self, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        self._ensure_connected()
        if self._simulation:
            positions = self._sim_positions
            if symbol:
                positions = [p for p in positions if p["symbol"] == symbol]
            return positions

        raw = mt5.positions_get(symbol=symbol) if symbol else mt5.positions_get()
        if raw is None:
            return []
        return [
            {
                "ticket": p.ticket, "symbol": p.symbol,
                "side": "BUY" if p.type == 0 else "SELL",
                "volume": p.volume, "price_open": p.price_open,
                "sl": p.sl, "tp": p.tp,
                "floating_pl": p.profit,
                "time_open": datetime.fromtimestamp(p.time, tz=timezone.utc),
                "magic": p.magic, "comment": p.comment,
                "current_price": p.price_current,
            }
            for p in raw
        ]

    # ── Internals ─────────────────────────────────────────────────

    def _ensure_connected(self) -> None:
        if not self._connected:
            raise RuntimeError("MT5 not connected. Call connect() first.")

    @staticmethod
    def _resolve_tf(tf: str) -> int:
        mapping = {
            "M1": mt5.TIMEFRAME_M1, "M5": mt5.TIMEFRAME_M5,
            "M15": mt5.TIMEFRAME_M15, "M30": mt5.TIMEFRAME_M30,
            "H1": mt5.TIMEFRAME_H1, "H4": mt5.TIMEFRAME_H4,
            "D1": mt5.TIMEFRAME_D1, "W1": mt5.TIMEFRAME_W1,
            "MN1": mt5.TIMEFRAME_MN1,
        }
        const = mapping.get(tf.upper())
        if const is None:
            raise ValueError(f"Unknown timeframe: {tf}")
        return const

    def _generate_sim_bars(self, count: int, timeframe: str) -> pd.DataFrame:
        minutes_per_bar = TIMEFRAME_MAP.get(timeframe.upper(), 60)
        now = datetime.now(tz=timezone.utc)
        timestamps = [now - timedelta(minutes=minutes_per_bar * (count - 1 - i)) for i in range(count)]
        price = self._sim_base_price
        rows = []
        for ts in timestamps:
            drift = -0.001 * (price - self._sim_base_price)
            ret = drift + np.random.normal(0, 0.0015)
            price *= 1 + ret
            o = round(price, 2)
            vol = abs(np.random.normal(0, 0.003))
            h = round(o * (1 + vol), 2)
            l = round(o * (1 - vol), 2)
            c = round(l + (h - l) * np.random.uniform(0.2, 0.8), 2)
            rows.append({"time": ts, "open": o, "high": h, "low": l, "close": c,
                         "volume": int(np.random.lognormal(7, 1))})
        self._sim_base_price = rows[-1]["close"]
        return pd.DataFrame(rows)
