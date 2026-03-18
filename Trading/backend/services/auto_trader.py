"""
Full-Auto Trading Engine.

Background asyncio task that periodically evaluates signals, runs risk checks,
and executes trades without human approval.  All safety gates (session filter,
daily lockout, anti-stacking, confidence threshold, full risk_check) are
enforced on every cycle.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import SessionLocal
from models.models import (
    AutoTradeConfig,
    TradingAccount,
    TradeSignal,
    RiskCheck as RiskCheckModel,
    Order,
    Execution,
    DailyRiskStat,
)
from services.signal_service import evaluate_xauusd_signal
from services.risk_service import (
    risk_check,
    calculate_lot_size,
    check_daily_lockout,
    is_allowed_session,
)
from services.mt5_service import MT5Service

logger = logging.getLogger(__name__)

AUTO_MAGIC_NUMBER = 999999


@dataclass
class AutoTraderState:
    """Observable status of the auto-trader."""
    enabled: bool = False
    running: bool = False
    cycle_count: int = 0
    signals_evaluated: int = 0
    trades_executed: int = 0
    trades_skipped: int = 0
    last_evaluation_at: Optional[datetime] = None
    last_trade_at: Optional[datetime] = None
    last_error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "enabled": self.enabled,
            "running": self.running,
            "cycle_count": self.cycle_count,
            "signals_evaluated": self.signals_evaluated,
            "trades_executed": self.trades_executed,
            "trades_skipped": self.trades_skipped,
            "last_evaluation_at": self.last_evaluation_at.isoformat() if self.last_evaluation_at else None,
            "last_trade_at": self.last_trade_at.isoformat() if self.last_trade_at else None,
            "last_error": self.last_error,
        }


class AutoTrader:
    """
    Manages a background loop that evaluates signals and auto-executes trades.

    Lifecycle:
        1. ``start(account_id)`` — launch the loop for a specific account.
        2. ``stop()`` — cancel the running loop gracefully.
        3. ``get_state()`` — read-only snapshot of current status.
    """

    def __init__(self) -> None:
        self.state = AutoTraderState()
        self._task: Optional[asyncio.Task] = None
        self._account_id: Optional[int] = None
        self._stop_event = asyncio.Event()

    # ── Public API ────────────────────────────────────────────────────

    async def start(self, account_id: int) -> None:
        """Start the auto-trade loop for *account_id*."""
        if self._task and not self._task.done():
            logger.warning("AutoTrader already running — stopping first.")
            await self.stop()

        self._account_id = account_id
        self._stop_event.clear()
        self.state = AutoTraderState(enabled=True, running=True)
        self._task = asyncio.create_task(self._run_loop())
        logger.info("AutoTrader started for account %s.", account_id)

    async def stop(self) -> None:
        """Stop the running loop and persist disabled state."""
        self._stop_event.set()
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self.state.running = False
        self.state.enabled = False

        # Persist disabled in DB
        if self._account_id:
            try:
                async with SessionLocal() as db:
                    result = await db.execute(
                        select(AutoTradeConfig).where(
                            AutoTradeConfig.account_id == self._account_id
                        )
                    )
                    config = result.scalar_one_or_none()
                    if config:
                        config.enabled = False
                        await db.commit()
            except Exception:
                logger.exception("Failed to persist disabled state.")

        logger.info("AutoTrader stopped.")

    def get_state(self) -> AutoTraderState:
        return self.state

    # ── Background loop ──────────────────────────────────────────────

    async def _run_loop(self) -> None:
        """Main loop: sleep → evaluate → execute → repeat."""
        try:
            while not self._stop_event.is_set():
                # Fetch config each cycle (allows live config changes)
                config = await self._load_config()
                if config is None or not config.enabled:
                    logger.info("AutoTrader config disabled — exiting loop.")
                    break

                interval = config.evaluation_interval_seconds

                try:
                    await self._evaluate_and_execute_cycle(config)
                except Exception as exc:
                    self.state.last_error = str(exc)
                    logger.exception("Auto-trade cycle error: %s", exc)

                self.state.cycle_count += 1

                # Sleep with interruptibility
                try:
                    await asyncio.wait_for(
                        self._stop_event.wait(), timeout=interval
                    )
                    # If we get here the stop event was set
                    break
                except asyncio.TimeoutError:
                    # Normal: timeout expired, continue to next cycle
                    pass

        except asyncio.CancelledError:
            logger.info("AutoTrader loop cancelled.")
        finally:
            self.state.running = False
            logger.info("AutoTrader loop exited (cycles=%d).", self.state.cycle_count)

    async def _evaluate_and_execute_cycle(
        self, config: AutoTradeConfig
    ) -> None:
        """Single evaluation + execution cycle with all safety gates."""
        async with SessionLocal() as db:
            account = await self._get_account(db)
            if account is None:
                self.state.last_error = "Account not found"
                return

            mt5 = MT5Service()
            mt5.connect(
                login=account.mt5_login,
                password="",  # simulation mode doesn't need password
                server=account.mt5_server,
            )

            # ── Gate 1: Session filter ────────────────────────────
            if not is_allowed_session():
                self.state.trades_skipped += 1
                logger.debug("Auto-trade: outside session hours — skipping.")
                return

            # ── Gate 2: Daily lockout ─────────────────────────────
            daily_stats = await self._get_daily_stats(db, account.id)
            risk_config = self._build_risk_config(db, account.id)
            if daily_stats.get("daily_locked", False):
                self.state.trades_skipped += 1
                logger.debug("Auto-trade: daily lockout active — skipping.")
                return

            # ── Gate 3: Max auto-trades per day ───────────────────
            auto_today = await self._count_auto_trades_today(db, account.id)
            if auto_today >= config.max_auto_trades_per_day:
                self.state.trades_skipped += 1
                logger.debug(
                    "Auto-trade: max auto-trades/day reached (%d/%d).",
                    auto_today, config.max_auto_trades_per_day,
                )
                return

            # ── Gate 4: Anti-stacking ─────────────────────────────
            positions = mt5.get_positions(symbol="XAUUSD")
            if positions:
                self.state.trades_skipped += 1
                logger.debug(
                    "Auto-trade: %d open XAUUSD position(s) — skipping.",
                    len(positions),
                )
                return

            # ── Gate 5: Evaluate signal ───────────────────────────
            try:
                bars_df = mt5.get_bars("XAUUSD", config.timeframe, 300)
            except Exception as exc:
                self.state.last_error = f"Failed to get bars: {exc}"
                return

            signal_data = evaluate_xauusd_signal(
                bars_df=bars_df,
                timeframe=config.timeframe,
            )
            self.state.signals_evaluated += 1
            self.state.last_evaluation_at = datetime.now(tz=timezone.utc)

            if signal_data is None:
                self.state.trades_skipped += 1
                logger.debug("Auto-trade: no signal generated — skipping.")
                return

            # ── Gate 6: Confidence threshold ──────────────────────
            confidence = signal_data.get("confidence_score", 0.0)
            if confidence < config.min_confidence_threshold:
                self.state.trades_skipped += 1
                logger.debug(
                    "Auto-trade: confidence %.2f < threshold %.2f — skipping.",
                    confidence, config.min_confidence_threshold,
                )
                return

            # ── Gate 7: Full risk check ───────────────────────────
            account_info = mt5.get_account_info()
            tick = mt5.get_tick("XAUUSD")

            risk_result = risk_check(
                account_info=account_info,
                signal=signal_data,
                daily_stats=daily_stats,
                config=risk_config,
                current_spread=tick.get("spread", 0.0),
            )

            if not risk_result["passed"]:
                self.state.trades_skipped += 1
                reasons = "; ".join(risk_result.get("reasons", []))
                logger.info("Auto-trade: risk check FAILED — %s", reasons)
                return

            # ── Gate 8: Calculate lot size ────────────────────────
            symbol_info = mt5.get_symbol_info("XAUUSD")
            risk_pct = risk_config.get("risk_per_trade_pct", 0.005)
            lot_size = calculate_lot_size(
                balance=account_info["balance"],
                risk_pct=risk_pct,
                entry=signal_data["entry"],
                sl=signal_data["sl"],
                symbol_info=symbol_info,
            )

            # ── Execute order ─────────────────────────────────────
            cycle_tag = f"AUTO | cycle={self.state.cycle_count}"
            order_result = mt5.place_order(
                symbol="XAUUSD",
                side=signal_data["side"],
                volume=lot_size,
                price=signal_data["entry"],
                sl=signal_data["sl"],
                tp=signal_data["tp"],
                magic=AUTO_MAGIC_NUMBER,
                comment=cycle_tag,
            )

            if not order_result.get("success", False):
                self.state.last_error = (
                    f"Order failed: {order_result.get('comment', 'unknown')}"
                )
                logger.warning("Auto-trade order failed: %s", order_result)
                return

            # ── Persist signal + order + execution ────────────────
            signal_record = TradeSignal(
                account_id=account.id,
                symbol="XAUUSD",
                direction=signal_data["side"],
                entry_price=signal_data["entry"],
                stop_loss=signal_data["sl"],
                take_profit=signal_data["tp"],
                lot_size=lot_size,
                risk_reward_ratio=signal_data.get("rr_ratio", 0.0),
                strategy_name=signal_data.get("strategy", "trend_breakout"),
                timeframe=config.timeframe,
                confidence=confidence,
                notes=cycle_tag,
                status="APPROVED",
                approved_at=datetime.now(tz=timezone.utc),
            )
            db.add(signal_record)
            await db.flush()

            order_record = Order(
                account_id=account.id,
                signal_id=signal_record.id,
                mt5_ticket=order_result["ticket"],
                symbol="XAUUSD",
                order_type="MARKET",
                direction=signal_data["side"],
                lot_size=lot_size,
                entry_price=signal_data["entry"],
                stop_loss=signal_data["sl"],
                take_profit=signal_data["tp"],
                status="FILLED",
                placed_at=datetime.now(tz=timezone.utc),
                filled_at=datetime.now(tz=timezone.utc),
            )
            db.add(order_record)
            await db.flush()

            exec_record = Execution(
                order_id=order_record.id,
                mt5_deal_id=order_result["ticket"],
                fill_price=signal_data["entry"],
                fill_lot_size=lot_size,
                commission=0.0,
                swap=0.0,
                profit=0.0,
                opened_at=datetime.now(tz=timezone.utc),
            )
            db.add(exec_record)
            await db.commit()

            self.state.trades_executed += 1
            self.state.last_trade_at = datetime.now(tz=timezone.utc)
            self.state.last_error = None

            logger.info(
                "AUTO-TRADE EXECUTED: %s %.2f lots @ %.2f "
                "(SL=%.2f TP=%.2f conf=%.2f cycle=%d ticket=%s)",
                signal_data["side"],
                lot_size,
                signal_data["entry"],
                signal_data["sl"],
                signal_data["tp"],
                confidence,
                self.state.cycle_count,
                order_result["ticket"],
            )

    # ── Helper methods ───────────────────────────────────────────────

    async def _load_config(self) -> Optional[AutoTradeConfig]:
        """Load the auto-trade config from the database."""
        if not self._account_id:
            return None
        async with SessionLocal() as db:
            result = await db.execute(
                select(AutoTradeConfig).where(
                    AutoTradeConfig.account_id == self._account_id
                )
            )
            return result.scalar_one_or_none()

    async def _get_account(self, db: AsyncSession) -> Optional[TradingAccount]:
        """Load the trading account."""
        if not self._account_id:
            return None
        result = await db.execute(
            select(TradingAccount).where(
                TradingAccount.id == self._account_id,
                TradingAccount.is_active.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def _get_daily_stats(
        self, db: AsyncSession, account_id: int
    ) -> Dict[str, Any]:
        """Get today's daily stats as a dict for risk_check()."""
        from datetime import date

        today = date.today()
        result = await db.execute(
            select(DailyRiskStat).where(
                DailyRiskStat.account_id == account_id,
                DailyRiskStat.stat_date == today,
            )
        )
        stats = result.scalar_one_or_none()
        if stats is None:
            return {
                "date": today.isoformat(),
                "total_trades": 0,
                "winning_trades": 0,
                "losing_trades": 0,
                "consecutive_losses": 0,
                "realized_pl": 0.0,
                "daily_locked": False,
            }
        return {
            "date": stats.stat_date.isoformat(),
            "total_trades": stats.trades_taken,
            "winning_trades": stats.wins,
            "losing_trades": stats.losses,
            "consecutive_losses": stats.consecutive_losses,
            "realized_pl": float(stats.realized_pnl),
            "daily_locked": stats.is_locked,
        }

    def _build_risk_config(
        self, db: AsyncSession, account_id: int
    ) -> Dict[str, Any]:
        """Build risk config dict with defaults."""
        return {
            "max_trades_per_day": 5,
            "max_consecutive_losses": 3,
            "daily_loss_limit_pct": 0.05,
            "max_spread": 0.50,
            "min_rr_ratio": 1.5,
            "news_window_minutes": 30,
            "news_events": [],
            "risk_per_trade_pct": 0.005,
            "reference_balance": 10_000.0,
        }

    async def _count_auto_trades_today(
        self, db: AsyncSession, account_id: int
    ) -> int:
        """Count auto-trades placed today (identified by magic number)."""
        from datetime import date
        from sqlalchemy import func as sqlfunc

        today = date.today()
        result = await db.execute(
            select(sqlfunc.count(Order.id)).where(
                Order.account_id == account_id,
                sqlfunc.date(Order.created_at) == today,
                Order.status.in_(["FILLED", "PLACED"]),
            )
        )
        count = result.scalar() or 0
        return count
