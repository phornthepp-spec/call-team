"""
Auto Trader — main trading loop that orchestrates the complete trading pipeline.

Cycle (every 60 seconds):
1. Pre-flight checks (kill switch, exchange, daily limits)
2. Fetch market data (OHLCV + ticker)
3. Manage existing positions (trailing stop, partial TP, SL check)
4. Evaluate signal (multi-confirmation strategy)
5. Risk engine evaluation (16 guards)
6. Position sizing
7. Place order (or skip)
8. Log everything
9. Print daily summary
10. Sleep → repeat
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Optional

from crypto_bot.config import Config, get_config
from crypto_bot.exchange_service import ExchangeService
from crypto_bot.guards.base_guard import EvaluationContext
from crypto_bot.market_data import MarketDataService, MarketSnapshot
from crypto_bot.order_manager import OrderManager
from crypto_bot.position_sizer import calculate_position_size
from crypto_bot.risk_engine import RiskEngine
from crypto_bot.signal_generator import SignalGenerator
from crypto_bot.trade_logger import TradeLogger, TradeRecord

logger = logging.getLogger(__name__)


class AutoTrader:
    """
    Main auto-trading orchestrator.

    Runs a continuous loop that:
    - Fetches market data
    - Manages open positions
    - Evaluates signals
    - Executes trades through the risk engine pipeline
    """

    def __init__(self, config: Optional[Config] = None):
        self._cfg = config or get_config()

        # Initialize services
        self._exchange = ExchangeService(self._cfg)
        self._market_data = MarketDataService(self._cfg)
        self._signal_gen = SignalGenerator(self._cfg)
        self._risk_engine = RiskEngine()
        self._order_manager = OrderManager(self._exchange, self._cfg)
        self._trade_logger = TradeLogger(self._cfg)

        # State
        self._running = False
        self._kill_switch = False
        self._cycle_count = 0
        self._started_at: Optional[float] = None

        # Trade history (for cooldowns)
        self._last_trade_timestamp: Optional[float] = None
        self._last_loss_timestamp: Optional[float] = None
        self._last_trade_direction: Optional[str] = None
        self._last_trade_was_loss = False
        self._daily_consecutive_losses = 0
        self._daily_date: Optional[str] = None

    @property
    def running(self) -> bool:
        return self._running

    def activate_kill_switch(self, reason: str = "Manual kill switch") -> None:
        """Activate kill switch — stops all trading and closes positions."""
        self._kill_switch = True
        logger.critical("KILL SWITCH ACTIVATED: %s", reason)

        # Close all open positions
        if self._order_manager.open_position_count > 0:
            actions = self._order_manager.close_all_positions("KILL_SWITCH")
            for action in actions:
                logger.warning("Kill switch: %s", action)

    def deactivate_kill_switch(self) -> None:
        """Deactivate kill switch."""
        self._kill_switch = False
        logger.info("Kill switch deactivated")

    async def start(self) -> None:
        """Start the auto-trading loop."""
        logger.info("=" * 60)
        logger.info("CRYPTO AUTO TRADER STARTING")
        logger.info("=" * 60)
        logger.info("Exchange: %s", self._cfg.exchange_id)
        logger.info("Symbol: %s", self._cfg.symbol)
        logger.info("Timeframe: %s", self._cfg.timeframe)
        logger.info("Policy: %s", self._cfg.policy_mode)
        logger.info("DRY RUN: %s", self._cfg.dry_run)
        logger.info("Interval: %ds", self._cfg.evaluation_interval_seconds)
        logger.info("=" * 60)

        # Connect to exchange
        if not self._exchange.connect():
            logger.error("Failed to connect to exchange — aborting start")
            return

        self._running = True
        self._started_at = time.time()

        try:
            await self._run_loop()
        except KeyboardInterrupt:
            logger.info("Interrupted by user")
        finally:
            await self.stop()

    async def stop(self) -> None:
        """Stop the trading loop gracefully."""
        self._running = False

        # Print final stats
        summary = self._trade_logger.get_daily_summary()
        logger.info("\n%s", summary)
        print(f"\n{summary}")

        stats = self._trade_logger.get_stats()
        logger.info("Final stats: %s", stats)

        self._exchange.disconnect()
        logger.info(
            "Auto-trader stopped (cycles=%d, uptime=%ds)",
            self._cycle_count,
            int(time.time() - self._started_at) if self._started_at else 0,
        )

    # ── Main Loop ─────────────────────────────────────────────────

    async def _run_loop(self) -> None:
        """Main auto-trade loop."""
        while self._running:
            try:
                await self._run_cycle()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception("Cycle error: %s", e)

            # Wait for next cycle
            try:
                await asyncio.sleep(self._cfg.evaluation_interval_seconds)
            except asyncio.CancelledError:
                break

    async def _run_cycle(self) -> None:
        """Execute one complete trading cycle."""
        self._cycle_count += 1
        now = datetime.now(tz=timezone.utc)

        # Reset daily counters at date boundary
        today = now.strftime("%Y-%m-%d")
        if self._daily_date != today:
            self._daily_date = today
            self._daily_consecutive_losses = 0
            logger.info("New trading day: %s — counters reset", today)

        # ── Pre-flight checks ─────────────────────────────────────
        if self._kill_switch:
            logger.debug("Cycle %d: Kill switch active — skip", self._cycle_count)
            return

        if not self._exchange.connected:
            logger.warning("Cycle %d: Exchange not connected — attempting reconnect", self._cycle_count)
            if not self._exchange.connect():
                return

        # ── Fetch market data ─────────────────────────────────────
        try:
            ohlcv = await asyncio.to_thread(
                self._exchange.fetch_ohlcv,
                self._cfg.symbol,
                self._cfg.timeframe,
                self._cfg.bars_lookback,
            )
            ticker = await asyncio.to_thread(
                self._exchange.fetch_ticker,
                self._cfg.symbol,
            )
        except Exception as e:
            logger.warning("Cycle %d: Failed to fetch market data: %s", self._cycle_count, e)
            return

        # ── Build market snapshot ─────────────────────────────────
        snapshot = self._market_data.build_snapshot(ohlcv, ticker)
        if snapshot is None:
            logger.debug("Cycle %d: Insufficient market data", self._cycle_count)
            return

        # ── Manage existing positions ─────────────────────────────
        if self._order_manager.open_position_count > 0:
            current_prices = {
                self._cfg.symbol: {
                    "bid": ticker.get("bid", 0),
                    "ask": ticker.get("ask", 0),
                    "last": ticker.get("last", 0),
                }
            }
            actions = self._order_manager.manage_positions(current_prices)
            for action in actions:
                logger.info("MANAGE: %s", action)
                # Track closed positions for PnL
                if "SL HIT" in action or "TP" in action:
                    self._handle_position_close(action)

        # ── Evaluate signal ───────────────────────────────────────
        signal = self._signal_gen.evaluate(snapshot)

        if signal is None:
            if self._cycle_count % 10 == 0:  # Log every 10th cycle to reduce noise
                logger.debug(
                    "Cycle %d: No signal (regime=%s vol=%s RSI=%.1f)",
                    self._cycle_count, snapshot.regime.value,
                    snapshot.volatility.value, snapshot.rsi,
                )
            return

        # ── Fetch balance ─────────────────────────────────────────
        try:
            balance = await asyncio.to_thread(self._exchange.fetch_balance)
        except Exception as e:
            logger.warning("Cycle %d: Failed to fetch balance: %s", self._cycle_count, e)
            return

        balance_usd = balance.get("free", {}).get("USDT", 0) or balance.get("total", {}).get("USDT", 0)

        # ── Build evaluation context for risk engine ──────────────
        daily_pnl_pct = self._trade_logger.get_daily_pnl_pct(balance_usd)
        daily_trades = self._trade_logger.get_daily_trade_count()

        ctx = EvaluationContext(
            # Account
            balance_usd=balance_usd,
            free_balance_usd=balance.get("free", {}).get("USDT", 0),
            open_positions_count=self._order_manager.open_position_count,
            daily_pnl_pct=daily_pnl_pct,
            daily_trades_taken=daily_trades,
            daily_consecutive_losses=self._daily_consecutive_losses,

            # Signal
            signal_side=signal.side,
            entry_price=signal.entry_price,
            stop_loss=signal.stop_loss,
            take_profit=signal.take_profit,
            rr_ratio=signal.rr_ratio,
            confidence=signal.confidence,
            confirmation_count=signal.confirmations,

            # Market
            bid=snapshot.bid,
            ask=snapshot.ask,
            spread_pct=snapshot.spread_pct,
            atr=snapshot.atr,
            atr_baseline=snapshot.atr_baseline,
            volume_ratio=snapshot.volume_ratio,
            regime=snapshot.regime.value,
            volatility=snapshot.volatility.value,

            # Cooldowns
            last_trade_timestamp=self._last_trade_timestamp,
            last_loss_timestamp=self._last_loss_timestamp,
            last_trade_direction=self._last_trade_direction,
            last_trade_was_loss=self._last_trade_was_loss,

            # System
            exchange_connected=self._exchange.connected,
            kill_switch_active=self._kill_switch,
        )

        # ── Run risk engine ───────────────────────────────────────
        risk_result = self._risk_engine.evaluate(ctx)

        if not risk_result.approved:
            # Log rejected signal
            guard_summary = "; ".join(
                f"{g.guard_name}:{g.status.value}"
                for g in risk_result.guard_results
                if not g.is_pass
            )
            self._trade_logger.log_trade(TradeRecord(
                timestamp=now.isoformat(),
                cycle=self._cycle_count,
                action="RISK_REJECTED",
                symbol=self._cfg.symbol,
                side=signal.side,
                entry_price=signal.entry_price,
                stop_loss=signal.stop_loss,
                take_profit=signal.take_profit,
                confidence=signal.confidence,
                confirmations=signal.confirmations,
                rr_ratio=signal.rr_ratio,
                regime=signal.regime,
                volatility=signal.volatility,
                risk_decision=risk_result.decision.value,
                risk_reason=risk_result.decision_reason[:300],
                guard_summary=guard_summary,
            ))
            logger.info(
                "Cycle %d: Signal REJECTED — %s conf=%.3f reason=%s",
                self._cycle_count, signal.side, signal.confidence,
                risk_result.decision_reason[:100],
            )
            return

        # ── Position sizing ───────────────────────────────────────
        pos_result = calculate_position_size(
            balance_usd=balance_usd,
            entry_price=signal.entry_price,
            stop_loss=signal.stop_loss,
            warn_count=risk_result.warn_count,
            reduction_factor=risk_result.lot_reduction_factor,
            config=self._cfg,
        )

        if not pos_result.is_valid:
            logger.warning(
                "Cycle %d: Position sizing failed: %s",
                self._cycle_count, pos_result.rejection_reason,
            )
            return

        # ── Place order ───────────────────────────────────────────
        position = self._order_manager.open_position(
            symbol=self._cfg.symbol,
            side=signal.side,
            amount=pos_result.amount,
            entry_price=signal.entry_price,
            stop_loss=signal.stop_loss,
            take_profit=signal.take_profit,
            tp1_price=signal.tp1_price,
            atr=signal.atr,
            confidence=signal.confidence,
            rr_ratio=signal.rr_ratio,
        )

        if position:
            # Update trade history
            self._last_trade_timestamp = time.time()
            self._last_trade_direction = signal.side

            # Log the trade
            self._trade_logger.log_trade(TradeRecord(
                timestamp=now.isoformat(),
                cycle=self._cycle_count,
                action="OPEN",
                symbol=self._cfg.symbol,
                side=signal.side,
                entry_price=position.entry_price,
                amount=position.amount,
                stop_loss=signal.stop_loss,
                take_profit=signal.take_profit,
                confidence=signal.confidence,
                confirmations=signal.confirmations,
                rr_ratio=signal.rr_ratio,
                regime=signal.regime,
                volatility=signal.volatility,
                risk_decision=risk_result.decision.value,
                details=signal.confirmation_details,
            ))

            # Print to console
            mode_label = "🧪 DRY RUN" if self._cfg.dry_run else "🔴 LIVE"
            print(
                f"\n{mode_label} | TRADE OPENED | {signal.side} {position.amount:.8f} "
                f"{self._cfg.symbol} @ {position.entry_price:.2f}\n"
                f"  SL={signal.stop_loss:.2f} TP1={signal.tp1_price:.2f} TP2={signal.take_profit:.2f}\n"
                f"  Confidence={signal.confidence:.3f} Confirmations={signal.confirmations}\n"
                f"  Risk=${pos_result.risk_usd:.2f} ({pos_result.risk_pct:.2f}%)\n"
            )
        else:
            logger.error("Cycle %d: Order placement failed", self._cycle_count)

        # ── Print periodic summary ────────────────────────────────
        if self._cycle_count % 60 == 0:  # Every ~60 minutes
            summary = self._trade_logger.get_daily_summary()
            print(f"\n{summary}")

    # ── Helpers ───────────────────────────────────────────────────

    def _handle_position_close(self, action: str) -> None:
        """Update trade history after a position closes."""
        is_loss = "SL HIT" in action

        if is_loss:
            self._last_loss_timestamp = time.time()
            self._last_trade_was_loss = True
            self._daily_consecutive_losses += 1
        else:
            self._last_trade_was_loss = False
            self._daily_consecutive_losses = 0

        # Log close
        # Find the relevant position from the action string to get details
        for pos in self._order_manager._positions.values():
            if not pos.is_open and pos.id in action:
                self._trade_logger.log_trade(TradeRecord(
                    timestamp=datetime.now(tz=timezone.utc).isoformat(),
                    cycle=self._cycle_count,
                    action="CLOSE",
                    symbol=pos.symbol,
                    side=pos.side,
                    entry_price=pos.entry_price,
                    exit_price=pos.stop_loss if is_loss else pos.take_profit,
                    amount=pos.amount,
                    stop_loss=pos.stop_loss,
                    take_profit=pos.take_profit,
                    pnl_usd=pos.realized_pnl,
                    close_reason=pos.close_reason or "",
                    confidence=pos.confidence,
                    rr_ratio=pos.rr_ratio,
                ))
                break

        # Auto-activate kill switch on heavy losses
        if self._daily_consecutive_losses >= self._cfg.max_consecutive_losses * 2:
            self.activate_kill_switch(
                f"Auto-kill: {self._daily_consecutive_losses} consecutive losses"
            )
