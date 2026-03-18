"""
Base Risk Guard interface.

Every guard evaluates an EvaluationContext and returns PASS / WARN / BLOCK.
Guards are deterministic and rule-based — they cannot be bypassed by signals.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class GuardStatus(Enum):
    PASS = "PASS"
    WARN = "WARN"
    BLOCK = "BLOCK"


class GuardCategory(Enum):
    SYSTEM = "SYSTEM"
    ACCOUNT = "ACCOUNT"
    MARKET = "MARKET"
    STRATEGY = "STRATEGY"


class GuardSeverity(Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


@dataclass
class GuardResult:
    """Immutable outcome of a single guard evaluation."""
    guard_name: str
    category: str
    status: GuardStatus
    severity: str
    current_value: Optional[str] = None
    threshold: Optional[str] = None
    reason: Optional[str] = None
    action: Optional[str] = None
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

    Populated once per risk check and shared across all guards.
    """
    # Account
    balance_usd: float = 0.0
    free_balance_usd: float = 0.0
    total_position_value_usd: float = 0.0
    open_positions_count: int = 0

    # Daily stats
    daily_pnl_pct: float = 0.0
    daily_trades_taken: int = 0
    daily_consecutive_losses: int = 0

    # Signal
    signal_side: str = ""
    entry_price: float = 0.0
    stop_loss: float = 0.0
    take_profit: float = 0.0
    rr_ratio: float = 0.0
    confidence: float = 0.0
    confirmation_count: int = 0

    # Market
    bid: float = 0.0
    ask: float = 0.0
    spread_pct: float = 0.0
    atr: float = 0.0
    atr_baseline: float = 0.0
    volume_ratio: float = 0.0
    regime: str = "UNKNOWN"
    volatility: str = "NORMAL"

    # Cooldown / history
    last_trade_timestamp: Optional[float] = None
    last_loss_timestamp: Optional[float] = None
    last_trade_direction: Optional[str] = None
    last_trade_was_loss: bool = False

    # System state
    exchange_connected: bool = False
    kill_switch_active: bool = False

    # Computed (set by position sizer)
    computed_amount: float = 0.0
    risk_per_trade_pct: float = 0.0


class BaseGuard(ABC):
    """Abstract base class for all risk guards."""

    def __init__(self, name: str, category: str, severity: str):
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
