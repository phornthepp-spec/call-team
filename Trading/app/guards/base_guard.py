"""
Base risk guard interface.

Every guard implements ``evaluate()`` which returns a ``GuardResult``.
Guards are deterministic, rule-based, and cannot be bypassed by AI signals.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from app.core.enums import GuardCategory, GuardSeverity, GuardStatus

logger = logging.getLogger(__name__)


@dataclass
class GuardResult:
    """Immutable outcome of a single guard evaluation."""
    guard_name: str
    category: GuardCategory
    status: GuardStatus
    severity: GuardSeverity
    current_value: Optional[str] = None
    threshold: Optional[str] = None
    reason: Optional[str] = None
    action: Optional[str] = None             # e.g. "reject", "reduce_lot", "lockout"
    lockout_impact: Optional[str] = None     # e.g. "DAILY", "WEEKLY"
    safe_mode_impact: Optional[str] = None   # e.g. "activate_safe_mode"
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_block(self) -> bool:
        return self.status == GuardStatus.BLOCK

    @property
    def is_warn(self) -> bool:
        return self.status == GuardStatus.WARN

    @property
    def is_pass(self) -> bool:
        return self.status == GuardStatus.PASS


@dataclass
class EvaluationContext:
    """
    All data a guard may inspect during evaluation.

    Populated once per risk check run and passed to every guard. This prevents
    each guard from independently querying MT5 / DB.
    """
    # Account
    balance: float = 0.0
    equity: float = 0.0
    margin: float = 0.0
    free_margin: float = 0.0
    margin_level: float = 0.0
    open_positions_count: int = 0

    # Daily stats
    daily_loss_pct: float = 0.0
    daily_trades_taken: int = 0
    daily_consecutive_losses: int = 0
    daily_profit_r: float = 0.0
    daily_locked: bool = False

    # Weekly / monthly stats
    weekly_loss_pct: float = 0.0
    weekly_locked: bool = False
    monthly_loss_pct: float = 0.0
    monthly_locked: bool = False

    # Open risk
    open_risk_pct: float = 0.0

    # Signal
    signal_side: str = ""
    entry_price: float = 0.0
    stop_loss: float = 0.0
    take_profit: float = 0.0
    rr_ratio: float = 0.0
    confidence: float = 0.0
    confirmation_count: int = 0
    strategy_name: str = ""
    regime_expectation: Optional[str] = None
    signal_fingerprint: Optional[str] = None
    model_latency_ms: Optional[int] = None

    # Market
    bid: float = 0.0
    ask: float = 0.0
    spread_points: float = 0.0
    atr: float = 0.0
    atr_baseline: float = 0.0       # recent average ATR for comparison
    recent_candle_range: float = 0.0
    avg_candle_range: float = 0.0
    tick_time: Optional[float] = None    # epoch seconds
    current_session: str = ""
    news_upcoming: bool = False
    news_minutes_away: Optional[int] = None
    market_regime: str = "UNKNOWN"
    volatility_state: str = "NORMAL"
    is_rollover_window: bool = False

    # Computed lot (set by position sizer before re-check)
    computed_lot: float = 0.0
    risk_per_trade_pct: float = 0.0

    # System state
    mt5_connected: bool = False
    broker_health_ok: bool = True
    reconciliation_clean: bool = True
    kill_switch_active: bool = False
    safe_mode_active: bool = False
    duplicate_signal: bool = False
    duplicate_order: bool = False

    # Recent history (for cooldown / re-entry guards)
    last_trade_timestamp: Optional[float] = None
    last_loss_timestamp: Optional[float] = None
    last_trade_direction: Optional[str] = None
    last_trade_was_loss: bool = False
    trades_this_hour: int = 0
    recent_loss_streak: int = 0
    recent_expectancy: float = 0.0
    recent_warn_count: int = 0
    recent_slippage_avg: float = 0.0

    # Feature availability
    features_available: bool = True
    feature_latency_ms: int = 0


class BaseGuard(ABC):
    """Abstract base class for all risk guards."""

    def __init__(self, name: str, category: GuardCategory, severity: GuardSeverity):
        self.name = name
        self.category = category
        self.severity = severity

    @abstractmethod
    def evaluate(self, ctx: EvaluationContext) -> GuardResult:
        """Run this guard against the evaluation context."""
        ...

    def _pass(self, reason: str = "OK", **kw) -> GuardResult:
        return GuardResult(
            guard_name=self.name,
            category=self.category,
            status=GuardStatus.PASS,
            severity=self.severity,
            reason=reason,
            **kw,
        )

    def _warn(self, reason: str, **kw) -> GuardResult:
        logger.warning("GUARD WARN [%s]: %s", self.name, reason)
        return GuardResult(
            guard_name=self.name,
            category=self.category,
            status=GuardStatus.WARN,
            severity=self.severity,
            reason=reason,
            **kw,
        )

    def _block(self, reason: str, **kw) -> GuardResult:
        logger.warning("GUARD BLOCK [%s]: %s", self.name, reason)
        return GuardResult(
            guard_name=self.name,
            category=self.category,
            status=GuardStatus.BLOCK,
            severity=self.severity,
            reason=reason,
            **kw,
        )
