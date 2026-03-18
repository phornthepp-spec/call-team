"""
Pydantic schemas for risk guard evaluation, risk check requests/responses,
and system state snapshots.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import (
    FinalDecision, GuardCategory, GuardSeverity, GuardStatus, PolicyMode,
)


# ── Guard Result ────────────────────────────────────────────────────────

class GuardResultSchema(BaseModel):
    """Single guard evaluation result."""
    guard_name: str
    category: GuardCategory
    status: GuardStatus
    severity: GuardSeverity
    current_value: Optional[str] = None
    threshold: Optional[str] = None
    reason: Optional[str] = None
    action: Optional[str] = None
    lockout_impact: Optional[str] = None
    safe_mode_impact: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


# ── Risk Check ──────────────────────────────────────────────────────────

class PreTradeCheckRequest(BaseModel):
    """Request for a pre-trade risk evaluation."""
    account_id: int
    signal_side: str       # BUY / SELL
    entry_price: float
    stop_loss: float
    take_profit: float
    confidence: float = 0.0
    confirmation_count: int = 0
    rr_ratio: float = 0.0
    strategy_name: str = "trend_breakout"
    timeframe: str = "M15"
    regime_expectation: Optional[str] = None
    signal_fingerprint: Optional[str] = None


class RiskCheckResponse(BaseModel):
    """Complete risk check result."""
    run_id: int
    policy_mode: PolicyMode
    final_decision: FinalDecision
    decision_reason: Optional[str] = None
    total_guards: int = 0
    pass_count: int = 0
    warn_count: int = 0
    block_count: int = 0
    requested_lot: Optional[float] = None
    approved_lot: Optional[float] = None
    lot_reduction_reason: Optional[str] = None
    guard_results: List[GuardResultSchema] = Field(default_factory=list)
    execution_time_ms: Optional[int] = None
    checked_at: datetime


# ── Risk Status ─────────────────────────────────────────────────────────

class RiskStatusResponse(BaseModel):
    """Aggregated risk status for the dashboard."""
    policy_mode: PolicyMode
    kill_switch_active: bool = False
    safe_mode_active: bool = False

    # Daily
    daily_loss_pct: float = 0.0
    daily_loss_limit_pct: float = 1.0
    daily_trades_taken: int = 0
    daily_max_trades: int = 3
    daily_locked: bool = False
    daily_consecutive_losses: int = 0

    # Weekly
    weekly_loss_pct: float = 0.0
    weekly_loss_limit_pct: float = 2.5
    weekly_locked: bool = False

    # Monthly
    monthly_loss_pct: float = 0.0
    monthly_loss_limit_pct: float = 6.0
    monthly_locked: bool = False

    # Open risk
    open_risk_pct: float = 0.0
    max_open_risk_pct: float = 1.0
    open_positions_count: int = 0
    max_simultaneous_positions: int = 1

    # Profit
    daily_profit_r: float = 0.0
    profit_lock_active: bool = False

    # Margin
    margin_level: float = 0.0
    free_margin_pct: float = 0.0

    # Broker
    mt5_connected: bool = False
    broker_health: str = "UNKNOWN"
    reconciliation_clean: bool = True

    # Lockouts
    active_lockouts: List[str] = Field(default_factory=list)

    # Recent
    last_trade_at: Optional[datetime] = None
    last_loss_at: Optional[datetime] = None
    recent_warn_count: int = 0


# ── Lockout ─────────────────────────────────────────────────────────────

class LockoutResponse(BaseModel):
    """Active lockout info."""
    lockout_type: str
    trigger: str
    is_active: bool
    activated_at: datetime
    expires_at: Optional[datetime] = None
    reason: Optional[str] = None


class LockoutListResponse(BaseModel):
    """List of active lockouts."""
    lockouts: List[LockoutResponse] = Field(default_factory=list)
    any_active: bool = False


# ── Position Sizing ────────────────────────────────────────────────────

class PositionSizeResult(BaseModel):
    """Detailed position sizing output."""
    risk_amount: float = 0.0
    stop_distance: float = 0.0
    value_per_point_per_lot: float = 0.0
    raw_lot: float = 0.0
    normalized_lot: float = 0.0
    reduced_lot: float = 0.0
    final_lot: float = 0.0
    lot_reduction_reason: Optional[str] = None
    broker_constraint_reason: Optional[str] = None
    risk_pct_used: float = 0.0
    is_valid: bool = True
    rejection_reason: Optional[str] = None
