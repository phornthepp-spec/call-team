"""
Trade Logger — JSON-based trade logging and performance statistics.

Logs every trade decision (approved and rejected) to a JSON-lines file.
Computes running performance statistics.
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from crypto_bot.config import Config, get_config

logger = logging.getLogger(__name__)


@dataclass
class TradeRecord:
    """A single trade log entry."""
    timestamp: str
    cycle: int
    action: str               # "OPEN", "CLOSE", "SIGNAL_REJECTED", "RISK_REJECTED"
    symbol: str
    side: str
    entry_price: float = 0.0
    exit_price: float = 0.0
    amount: float = 0.0
    stop_loss: float = 0.0
    take_profit: float = 0.0
    confidence: float = 0.0
    confirmations: int = 0
    rr_ratio: float = 0.0
    pnl_usd: float = 0.0
    close_reason: str = ""
    regime: str = ""
    volatility: str = ""
    risk_decision: str = ""
    risk_reason: str = ""
    guard_summary: str = ""
    dry_run: bool = True
    details: Dict[str, Any] = field(default_factory=dict)


class TradeLogger:
    """
    Manages trade logging and performance tracking.

    - Writes JSON-lines to logs/trades.jsonl (append-only)
    - Computes running statistics (win rate, PnL, etc.)
    """

    def __init__(self, config: Optional[Config] = None):
        self._cfg = config or get_config()
        self._log_dir = self._cfg.log_dir_path
        self._trades_file = self._log_dir / "trades.jsonl"
        self._stats_file = self._log_dir / "stats.json"

        # In-memory performance tracking
        self._total_trades = 0
        self._winning_trades = 0
        self._losing_trades = 0
        self._total_pnl = 0.0
        self._max_drawdown = 0.0
        self._peak_balance = 0.0
        self._gross_profit = 0.0
        self._gross_loss = 0.0
        self._consecutive_wins = 0
        self._consecutive_losses = 0
        self._max_consecutive_wins = 0
        self._max_consecutive_losses = 0

        self._daily_pnl: Dict[str, float] = {}
        self._daily_trades: Dict[str, int] = {}

        # Load existing stats
        self._load_stats()
        logger.info("Trade logger initialized: %s", self._trades_file)

    def log_trade(self, record: TradeRecord) -> None:
        """Append a trade record to the log file."""
        record.dry_run = self._cfg.dry_run

        # Write to JSONL file
        with open(self._trades_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(asdict(record), ensure_ascii=False) + "\n")

        # Update statistics for closed trades
        if record.action == "CLOSE" and record.pnl_usd != 0:
            self._update_stats(record)

        # Update daily tracking
        today = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
        if record.action == "OPEN":
            self._daily_trades[today] = self._daily_trades.get(today, 0) + 1
        if record.action == "CLOSE":
            self._daily_pnl[today] = self._daily_pnl.get(today, 0) + record.pnl_usd

        logger.info(
            "TRADE LOG: %s %s %s @ %.2f | conf=%.3f | PnL=$%.2f | %s",
            record.action, record.side, record.symbol,
            record.entry_price or record.exit_price,
            record.confidence, record.pnl_usd,
            "DRY_RUN" if record.dry_run else "LIVE",
        )

    def _update_stats(self, record: TradeRecord) -> None:
        """Update running statistics after a closed trade."""
        self._total_trades += 1
        self._total_pnl += record.pnl_usd

        if record.pnl_usd > 0:
            self._winning_trades += 1
            self._gross_profit += record.pnl_usd
            self._consecutive_wins += 1
            self._consecutive_losses = 0
            self._max_consecutive_wins = max(
                self._max_consecutive_wins, self._consecutive_wins
            )
        elif record.pnl_usd < 0:
            self._losing_trades += 1
            self._gross_loss += abs(record.pnl_usd)
            self._consecutive_losses += 1
            self._consecutive_wins = 0
            self._max_consecutive_losses = max(
                self._max_consecutive_losses, self._consecutive_losses
            )

        # Max drawdown
        self._peak_balance = max(self._peak_balance, self._total_pnl)
        drawdown = self._peak_balance - self._total_pnl
        self._max_drawdown = max(self._max_drawdown, drawdown)

        # Save stats periodically
        self._save_stats()

    def get_stats(self) -> Dict[str, Any]:
        """Get current performance statistics."""
        win_rate = (
            self._winning_trades / self._total_trades * 100
            if self._total_trades > 0 else 0
        )
        avg_win = (
            self._gross_profit / self._winning_trades
            if self._winning_trades > 0 else 0
        )
        avg_loss = (
            self._gross_loss / self._losing_trades
            if self._losing_trades > 0 else 0
        )
        profit_factor = (
            self._gross_profit / self._gross_loss
            if self._gross_loss > 0 else float("inf")
        )
        expectancy = (
            (win_rate / 100 * avg_win) - ((1 - win_rate / 100) * avg_loss)
            if self._total_trades > 0 else 0
        )

        return {
            "total_trades": self._total_trades,
            "winning_trades": self._winning_trades,
            "losing_trades": self._losing_trades,
            "win_rate_pct": round(win_rate, 2),
            "total_pnl_usd": round(self._total_pnl, 2),
            "gross_profit_usd": round(self._gross_profit, 2),
            "gross_loss_usd": round(self._gross_loss, 2),
            "avg_win_usd": round(avg_win, 2),
            "avg_loss_usd": round(avg_loss, 2),
            "profit_factor": round(profit_factor, 3),
            "expectancy_usd": round(expectancy, 2),
            "max_drawdown_usd": round(self._max_drawdown, 2),
            "max_consecutive_wins": self._max_consecutive_wins,
            "max_consecutive_losses": self._max_consecutive_losses,
            "current_consecutive_losses": self._consecutive_losses,
        }

    def get_daily_summary(self) -> str:
        """Get a human-readable daily summary."""
        stats = self.get_stats()
        today = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
        daily_pnl = self._daily_pnl.get(today, 0)
        daily_trades = self._daily_trades.get(today, 0)

        return (
            f"═══ Daily Summary ({today}) ═══\n"
            f"  Today: {daily_trades} trades, PnL ${daily_pnl:+.2f}\n"
            f"  Overall: {stats['total_trades']} trades, "
            f"Win Rate {stats['win_rate_pct']}%\n"
            f"  Total PnL: ${stats['total_pnl_usd']:+.2f}\n"
            f"  Profit Factor: {stats['profit_factor']}\n"
            f"  Max Drawdown: ${stats['max_drawdown_usd']}\n"
            f"  Expectancy: ${stats['expectancy_usd']:+.2f}/trade\n"
            f"═══════════════════════════════"
        )

    def get_daily_pnl_pct(self, balance: float) -> float:
        """Get today's PnL as percentage of balance."""
        today = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
        daily_pnl = self._daily_pnl.get(today, 0)
        return (daily_pnl / balance * 100) if balance > 0 else 0

    def get_daily_trade_count(self) -> int:
        """Get today's trade count."""
        today = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
        return self._daily_trades.get(today, 0)

    def _save_stats(self) -> None:
        """Save stats to JSON file."""
        try:
            with open(self._stats_file, "w", encoding="utf-8") as f:
                json.dump(self.get_stats(), f, indent=2)
        except Exception as e:
            logger.debug("Failed to save stats: %s", e)

    def _load_stats(self) -> None:
        """Load stats from JSON file if exists."""
        if not self._stats_file.exists():
            return
        try:
            with open(self._stats_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._total_trades = data.get("total_trades", 0)
            self._winning_trades = data.get("winning_trades", 0)
            self._losing_trades = data.get("losing_trades", 0)
            self._total_pnl = data.get("total_pnl_usd", 0)
            self._gross_profit = data.get("gross_profit_usd", 0)
            self._gross_loss = data.get("gross_loss_usd", 0)
            self._max_drawdown = data.get("max_drawdown_usd", 0)
            self._max_consecutive_wins = data.get("max_consecutive_wins", 0)
            self._max_consecutive_losses = data.get("max_consecutive_losses", 0)
            logger.info("Loaded stats: %d trades, PnL=$%.2f", self._total_trades, self._total_pnl)
        except Exception as e:
            logger.debug("Failed to load stats: %s", e)
