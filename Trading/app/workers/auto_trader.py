"""
Auto-Trade Worker — background asyncio task that evaluates signals
and executes trades automatically.

Safety features:
- Does NOT auto-start on restart (in-memory state resets)
- Kill switch gate on every cycle
- Daily trade limit enforcement
- Full risk engine evaluation before every trade
- All trades logged and auditable
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import time
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from app.core.config import get_settings
from app.core.enums import (
    AuditEventType, OrderStatus, OrderType, PolicyMode,
    SignalSide, SignalStatus,
)
from app.db.session import SessionLocal
from app.engine.risk_engine import RiskEngine
from app.guards.base_guard import EvaluationContext
from app.models.account import AccountSnapshot
from app.models.order import Execution, Order, TradeSignal
from app.schemas.auto_trade import AutoTradeConfigSchema
from app.services.audit_service import AuditService
from app.services.market_data_service import MarketDataService
from app.services.mt5_service import MT5Service
from app.services.signal_generator import SignalGenerator
from app.services.system_state_service import SystemStateService

logger = logging.getLogger(__name__)


class AutoTrader:
    """Background auto-trade loop manager."""

    def __init__(
        self,
        mt5_service: MT5Service,
        system_state: SystemStateService,
        broker_profile,
    ):
        self._mt5 = mt5_service
        self._system_state = system_state
        self._broker_profile = broker_profile
        self._market_data = MarketDataService()
        self._signal_gen = SignalGenerator(mt5_service, self._market_data)
        self._risk_engine = RiskEngine()
        self._audit = AuditService()

        # Config (editable at runtime)
        cfg = get_settings()
        self.config = AutoTradeConfigSchema(
            evaluation_interval_seconds=cfg.AUTO_TRADE_INTERVAL_SECONDS,
            min_confidence_threshold=cfg.MIN_AI_CONFIDENCE,
            timeframe=cfg.PRIMARY_TIMEFRAME,
            max_auto_trades_per_day=cfg.MAX_TRADES_PER_DAY,
        )

        # State (in-memory, resets on restart = safety)
        self._enabled = False
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._started_at: Optional[float] = None
        self._cycle_count = 0
        self._signals_evaluated = 0
        self._trades_executed = 0
        self._trades_skipped = 0
        self._trades_rejected = 0
        self._last_evaluation_at: Optional[datetime] = None
        self._last_trade_at: Optional[datetime] = None
        self._last_signal_side: Optional[str] = None
        self._last_signal_confidence: Optional[float] = None
        self._last_error: Optional[str] = None
        self._daily_auto_trades = 0
        self._daily_date: Optional[str] = None

    @property
    def enabled(self) -> bool:
        return self._enabled

    @property
    def running(self) -> bool:
        return self._running and self._task is not None and not self._task.done()

    def get_status(self) -> dict:
        """Return current status as dict for API response."""
        return {
            "enabled": self._enabled,
            "running": self.running,
            "cycle_count": self._cycle_count,
            "signals_evaluated": self._signals_evaluated,
            "trades_executed": self._trades_executed,
            "trades_skipped": self._trades_skipped,
            "trades_rejected": self._trades_rejected,
            "last_evaluation_at": self._last_evaluation_at.isoformat() if self._last_evaluation_at else None,
            "last_trade_at": self._last_trade_at.isoformat() if self._last_trade_at else None,
            "last_signal_side": self._last_signal_side,
            "last_signal_confidence": self._last_signal_confidence,
            "last_error": self._last_error,
            "uptime_seconds": round(time.time() - self._started_at, 1) if self._started_at else None,
            "config": self.config.model_dump(),
        }

    def start(self) -> bool:
        """Start the auto-trade background loop."""
        if self.running:
            return False

        if self._system_state.kill_switch_active:
            self._last_error = "Cannot start: kill switch active"
            return False

        self._enabled = True
        self._running = True
        self._started_at = time.time()
        self._last_error = None
        self._task = asyncio.create_task(self._run_loop())
        logger.info("AUTO-TRADE: Started (interval=%ds)", self.config.evaluation_interval_seconds)
        return True

    async def stop(self) -> None:
        """Stop the auto-trade background loop."""
        self._enabled = False
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None
        logger.info("AUTO-TRADE: Stopped (cycles=%d trades=%d)", self._cycle_count, self._trades_executed)

    def update_config(self, **kwargs) -> None:
        """Update config fields."""
        data = self.config.model_dump()
        for k, v in kwargs.items():
            if v is not None and k in data:
                data[k] = v
        self.config = AutoTradeConfigSchema(**data)
        logger.info("AUTO-TRADE: Config updated: %s", self.config.model_dump())

    # ── Main Loop ──────────────────────────────────────────────────

    async def _run_loop(self) -> None:
        """Main auto-trade loop."""
        while self._enabled:
            try:
                await self._run_cycle()
            except asyncio.CancelledError:
                break
            except Exception as e:
                self._last_error = str(e)
                logger.exception("AUTO-TRADE: Cycle error: %s", e)

            # Wait for next cycle
            try:
                await asyncio.sleep(self.config.evaluation_interval_seconds)
            except asyncio.CancelledError:
                break

        self._running = False

    async def _run_cycle(self) -> None:
        """Execute one auto-trade cycle."""
        self._cycle_count += 1
        now = datetime.now(tz=timezone.utc)
        self._last_evaluation_at = now
        cfg = get_settings()

        # Reset daily counter at date boundary
        today = now.strftime("%Y-%m-%d")
        if self._daily_date != today:
            self._daily_date = today
            self._daily_auto_trades = 0

        # Pre-flight checks
        if self._system_state.kill_switch_active:
            logger.debug("AUTO-TRADE: Cycle %d skipped — kill switch active", self._cycle_count)
            self._trades_skipped += 1
            return

        if not self._mt5.connected:
            logger.debug("AUTO-TRADE: Cycle %d skipped — MT5 not connected", self._cycle_count)
            self._trades_skipped += 1
            return

        if self._daily_auto_trades >= self.config.max_auto_trades_per_day:
            logger.debug("AUTO-TRADE: Cycle %d skipped — daily limit reached (%d)", self._cycle_count, self._daily_auto_trades)
            self._trades_skipped += 1
            return

        # Evaluate signal (sync MT5 calls via thread)
        signal = await asyncio.to_thread(
            self._signal_gen.evaluate,
            symbol=cfg.PRIMARY_SYMBOL,
            timeframe=self.config.timeframe,
            min_confidence=self.config.min_confidence_threshold,
            min_rr=cfg.MIN_RR,
        )
        self._signals_evaluated += 1

        if signal is None:
            logger.debug("AUTO-TRADE: Cycle %d — no signal", self._cycle_count)
            return

        self._last_signal_side = signal.side
        self._last_signal_confidence = signal.confidence

        # Build EvaluationContext for risk engine
        account_info = await asyncio.to_thread(self._mt5.get_account_info)
        tick = await asyncio.to_thread(self._mt5.get_tick, cfg.PRIMARY_SYMBOL)
        bars = await asyncio.to_thread(self._mt5.get_bars, cfg.PRIMARY_SYMBOL, self.config.timeframe, 100)
        market_snapshot = self._market_data.get_market_snapshot(tick, bars)
        positions = await asyncio.to_thread(self._mt5.get_positions, cfg.PRIMARY_SYMBOL)

        ctx = EvaluationContext(
            balance=account_info["balance"],
            equity=account_info["equity"],
            margin=account_info["margin"],
            free_margin=account_info["free_margin"],
            margin_level=account_info["margin_level"],
            open_positions_count=len(positions),
            signal_side=signal.side,
            entry_price=signal.entry_price,
            stop_loss=signal.stop_loss,
            take_profit=signal.take_profit,
            rr_ratio=signal.rr_ratio,
            confidence=signal.confidence,
            confirmation_count=signal.confirmations,
            strategy_name=signal.strategy_name,
            regime_expectation=signal.regime,
            bid=tick["bid"],
            ask=tick["ask"],
            spread_points=tick["spread_points"],
            atr=market_snapshot.get("atr", 0),
            atr_baseline=market_snapshot.get("atr_baseline", 0),
            recent_candle_range=market_snapshot.get("recent_candle_range", 0),
            avg_candle_range=market_snapshot.get("avg_candle_range", 0),
            tick_time=tick.get("time"),
            current_session=market_snapshot.get("current_session", ""),
            market_regime=market_snapshot.get("market_regime", "UNKNOWN"),
            volatility_state=market_snapshot.get("volatility_state", "NORMAL"),
            is_rollover_window=market_snapshot.get("is_rollover_window", False),
            mt5_connected=self._mt5.connected,
            kill_switch_active=self._system_state.kill_switch_active,
            safe_mode_active=self._system_state.safe_mode_active,
        )

        # Run risk engine
        symbol_config = self._broker_profile.symbol_config
        risk_result = self._risk_engine.evaluate(
            ctx, symbol_config, PolicyMode(cfg.POLICY_MODE)
        )

        # Persist everything to DB
        async with SessionLocal() as db:
            try:
                # Save signal
                fp_raw = f"{signal.side}|{signal.entry_price}|{signal.stop_loss}|{signal.take_profit}|{self.config.timeframe}|{now.minute}"
                fingerprint = hashlib.sha256(fp_raw.encode()).hexdigest()[:16]

                db_signal = TradeSignal(
                    account_id=1,  # default account
                    symbol=cfg.PRIMARY_SYMBOL,
                    direction=SignalSide(signal.side),
                    entry_price=Decimal(str(signal.entry_price)),
                    stop_loss=Decimal(str(signal.stop_loss)),
                    take_profit=Decimal(str(signal.take_profit)),
                    risk_reward_ratio=Decimal(str(signal.rr_ratio)),
                    strategy_name=signal.strategy_name,
                    timeframe=self.config.timeframe,
                    confidence=signal.confidence,
                    confirmation_count=signal.confirmations,
                    regime_expectation=signal.regime,
                    signal_fingerprint=fingerprint,
                    feature_snapshot={
                        "atr": signal.atr,
                        "session": signal.session,
                        "regime": signal.regime,
                        "ema_crossover": True,
                    },
                )

                if risk_result.approved:
                    db_signal.status = SignalStatus.APPROVED
                    db_signal.approved_at = now
                else:
                    db_signal.status = SignalStatus.REJECTED

                db.add(db_signal)
                await db.flush()

                if risk_result.approved:
                    # Place order
                    comment = f"{cfg.COMMENT_PREFIX}|C{self._cycle_count}|{now.strftime('%H%M%S')}"
                    mt5_result = await asyncio.to_thread(
                        self._mt5.place_order,
                        symbol=cfg.PRIMARY_SYMBOL,
                        side=signal.side,
                        volume=risk_result.final_lot,
                        price=signal.entry_price,
                        sl=signal.stop_loss,
                        tp=signal.take_profit,
                        magic=cfg.AUTO_TRADE_MAGIC_NUMBER,
                        comment=comment,
                    )

                    order = Order(
                        account_id=1,
                        signal_id=db_signal.id,
                        symbol=cfg.PRIMARY_SYMBOL,
                        order_type=OrderType.MARKET,
                        direction=SignalSide(signal.side),
                        lot_size=Decimal(str(risk_result.final_lot)),
                        entry_price=Decimal(str(signal.entry_price)),
                        stop_loss=Decimal(str(signal.stop_loss)),
                        take_profit=Decimal(str(signal.take_profit)),
                        magic_number=cfg.AUTO_TRADE_MAGIC_NUMBER,
                        comment=comment,
                        status=OrderStatus.PENDING,
                    )

                    if mt5_result.get("success"):
                        order.mt5_ticket = mt5_result.get("ticket")
                        order.status = OrderStatus.FILLED
                        order.entry_price = Decimal(str(mt5_result.get("price", signal.entry_price)))
                        order.slippage_points = mt5_result.get("slippage", 0)
                        order.placed_at = now
                        order.filled_at = now

                        db_signal.status = SignalStatus.EXECUTED

                        execution = Execution(
                            order_id=0,  # will be set after flush
                            fill_price=order.entry_price,
                            fill_lot_size=order.lot_size,
                            commission=Decimal("0"),
                            swap=Decimal("0"),
                            profit=Decimal("0"),
                            slippage_points=order.slippage_points,
                            opened_at=now,
                        )

                        db.add(order)
                        await db.flush()
                        execution.order_id = order.id
                        db.add(execution)

                        self._trades_executed += 1
                        self._daily_auto_trades += 1
                        self._last_trade_at = now
                        self._last_error = None

                        logger.info(
                            "AUTO-TRADE: ORDER FILLED — %s %.4f lot @ %.2f ticket=%s cycle=%d",
                            signal.side, risk_result.final_lot, float(order.entry_price),
                            order.mt5_ticket, self._cycle_count,
                        )

                        await self._audit.log_event(
                            db, AuditEventType.ORDER_FILLED,
                            f"Auto-trade: {signal.side} {risk_result.final_lot} lot @ {order.entry_price}",
                            account_id=1,
                            details={
                                "cycle": self._cycle_count,
                                "confidence": signal.confidence,
                                "regime": signal.regime,
                                "auto_trade": True,
                            },
                        )
                    else:
                        order.status = OrderStatus.REJECTED
                        order.error_message = mt5_result.get("comment", "Unknown error")
                        db.add(order)
                        self._trades_rejected += 1
                        self._last_error = f"Order rejected: {order.error_message}"
                        logger.warning("AUTO-TRADE: Order rejected: %s", order.error_message)
                else:
                    self._trades_skipped += 1
                    logger.info(
                        "AUTO-TRADE: Signal REJECTED by risk engine — %s (conf=%.2f reason=%s)",
                        signal.side, signal.confidence, risk_result.decision_reason[:100],
                    )

                # Save account snapshot every cycle
                snapshot = AccountSnapshot(
                    account_id=1,
                    balance=Decimal(str(account_info["balance"])),
                    equity=Decimal(str(account_info["equity"])),
                    margin=Decimal(str(account_info["margin"])),
                    free_margin=Decimal(str(account_info["free_margin"])),
                    floating_pnl=Decimal(str(account_info.get("floating_pl", 0))),
                    open_positions=len(positions),
                )
                db.add(snapshot)

                await db.commit()
            except Exception as e:
                await db.rollback()
                self._last_error = f"DB error: {e}"
                logger.exception("AUTO-TRADE: DB error in cycle %d: %s", self._cycle_count, e)
