"""
Pydantic v2 schemas for request / response validation.

Covers authentication, account management, signals, orders,
risk management, analytics, allocations, and strategy configuration.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ══════════════════════════════════════════════════════════════════════════
#  Authentication
# ══════════════════════════════════════════════════════════════════════════

class UserCreate(BaseModel):
    """Register a new user."""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(None, max_length=255)


class UserLogin(BaseModel):
    """Login credentials."""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Public user representation."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: Optional[str] = None
    is_active: bool
    created_at: datetime


class Token(BaseModel):
    """JWT access token response."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Token lifetime in seconds")


class TokenPayload(BaseModel):
    """Decoded JWT payload (internal use)."""
    sub: int
    exp: datetime


# ══════════════════════════════════════════════════════════════════════════
#  Trading Accounts
# ══════════════════════════════════════════════════════════════════════════

class AccountConnect(BaseModel):
    """Connect an MT5 trading account."""
    mt5_login: int
    mt5_server: str = Field(..., max_length=255)
    account_name: Optional[str] = Field(None, max_length=255)
    broker: Optional[str] = Field(None, max_length=255)
    currency: str = Field("USD", max_length=10)
    leverage: Optional[int] = Field(None, gt=0)


class AccountResponse(BaseModel):
    """Trading account details."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    mt5_login: int
    mt5_server: str
    account_name: Optional[str] = None
    broker: Optional[str] = None
    currency: str
    leverage: Optional[int] = None
    is_active: bool
    created_at: datetime


class AccountSnapshot(BaseModel):
    """Point-in-time account snapshot."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    balance: Decimal
    equity: Decimal
    margin: Decimal
    free_margin: Decimal
    margin_level: Optional[Decimal] = None
    open_positions: int
    floating_pnl: Decimal
    snapshot_at: datetime


# ══════════════════════════════════════════════════════════════════════════
#  Trade Signals
# ══════════════════════════════════════════════════════════════════════════

class SignalResponse(BaseModel):
    """Trade signal detail."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    symbol: str
    direction: str
    entry_price: Decimal
    stop_loss: Decimal
    take_profit: Decimal
    lot_size: Decimal
    risk_reward_ratio: Decimal
    strategy_name: Optional[str] = None
    timeframe: Optional[str] = None
    confidence: Optional[Decimal] = None
    notes: Optional[str] = None
    status: str
    approved_at: Optional[datetime] = None
    expired_at: Optional[datetime] = None
    created_at: datetime
    risk_checks: List[RiskCheckItem] = []


class RiskCheckItem(BaseModel):
    """Individual risk check result nested inside a signal."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    check_name: str
    check_value: Optional[str] = None
    threshold: Optional[str] = None
    verdict: str
    reason: Optional[str] = None
    checked_at: datetime


# Rebuild SignalResponse now that RiskCheckItem is defined.
SignalResponse.model_rebuild()


class SignalApprove(BaseModel):
    """Approve or reject a pending signal."""
    approved: bool
    reason: Optional[str] = Field(None, max_length=500)


# ══════════════════════════════════════════════════════════════════════════
#  Orders & Executions
# ══════════════════════════════════════════════════════════════════════════

class ExecutionItem(BaseModel):
    """Execution fill detail."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    mt5_deal_id: Optional[int] = None
    fill_price: Decimal
    fill_lot_size: Decimal
    commission: Decimal
    swap: Decimal
    profit: Decimal
    close_price: Optional[Decimal] = None
    close_reason: Optional[str] = None
    opened_at: datetime
    closed_at: Optional[datetime] = None


class OrderResponse(BaseModel):
    """Order with nested executions."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    signal_id: Optional[int] = None
    mt5_ticket: Optional[int] = None
    symbol: str
    order_type: str
    direction: str
    lot_size: Decimal
    entry_price: Optional[Decimal] = None
    stop_loss: Optional[Decimal] = None
    take_profit: Optional[Decimal] = None
    status: str
    error_message: Optional[str] = None
    placed_at: Optional[datetime] = None
    filled_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    executions: List[ExecutionItem] = []


# ══════════════════════════════════════════════════════════════════════════
#  Risk Management
# ══════════════════════════════════════════════════════════════════════════

class RiskStatus(BaseModel):
    """Current risk status for an account."""
    account_id: int
    stat_date: date
    starting_balance: Decimal
    ending_balance: Optional[Decimal] = None
    realized_pnl: Decimal
    trades_taken: int
    wins: int
    losses: int
    consecutive_losses: int
    max_drawdown_pct: Decimal
    is_locked: bool
    lock_reason: Optional[str] = None
    daily_loss_pct: Decimal = Field(
        ..., description="Current day loss as a percentage of starting balance"
    )
    weekly_loss_pct: Decimal = Field(
        ..., description="Current week loss as a percentage of starting balance"
    )
    remaining_trades: int = Field(
        ..., description="Number of trades still allowed today"
    )


class RiskConfigUpdate(BaseModel):
    """Update risk management parameters."""
    risk_per_trade_pct: Optional[float] = Field(None, gt=0, le=5.0)
    daily_loss_limit_pct: Optional[float] = Field(None, gt=0, le=10.0)
    weekly_loss_limit_pct: Optional[float] = Field(None, gt=0, le=20.0)
    max_trades_per_day: Optional[int] = Field(None, ge=1, le=20)
    max_consecutive_losses: Optional[int] = Field(None, ge=1, le=10)
    min_rr: Optional[float] = Field(None, ge=1.0, le=10.0)
    max_spread_points: Optional[int] = Field(None, ge=1, le=100)


# ══════════════════════════════════════════════════════════════════════════
#  Analytics
# ══════════════════════════════════════════════════════════════════════════

class AnalyticsDaily(BaseModel):
    """Daily performance analytics row."""
    model_config = ConfigDict(from_attributes=True)

    stat_date: date
    starting_balance: Decimal
    ending_balance: Optional[Decimal] = None
    realized_pnl: Decimal
    total_commission: Decimal
    total_swap: Decimal
    trades_taken: int
    wins: int
    losses: int
    consecutive_losses: int
    max_drawdown_pct: Decimal
    is_locked: bool
    lock_reason: Optional[str] = None
    win_rate: Optional[float] = Field(None, description="Win rate as a fraction (0-1)")
    net_pnl: Decimal = Field(..., description="PnL after commission and swap")


# ══════════════════════════════════════════════════════════════════════════
#  Profit Allocations
# ══════════════════════════════════════════════════════════════════════════

class AllocationRun(BaseModel):
    """Request to create profit allocations for a period."""
    account_id: int
    period_start: date
    period_end: date
    allocations: List[AllocationItem]


class AllocationItem(BaseModel):
    """Single allocation bucket."""
    category: str = Field(..., description="COMPOUND | WITHDRAW | RESERVE | TAX")
    percentage: Decimal = Field(..., ge=0, le=100)
    notes: Optional[str] = None


class AllocationResponse(BaseModel):
    """Profit allocation result."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    period_start: date
    period_end: date
    gross_profit: Decimal
    net_profit: Decimal
    category: str
    percentage: Decimal
    amount: Decimal
    notes: Optional[str] = None
    created_at: datetime


# ══════════════════════════════════════════════════════════════════════════
#  Strategy Configuration
# ══════════════════════════════════════════════════════════════════════════

class StrategyConfigCreate(BaseModel):
    """Create a new strategy configuration."""
    strategy_name: str = Field(..., max_length=100)
    description: Optional[str] = None
    symbol: str = Field("XAUUSD", max_length=20)
    timeframe: str = Field("H1")
    parameters: Optional[Dict[str, Any]] = None
    is_active: bool = True


class StrategyConfigResponse(BaseModel):
    """Strategy configuration detail."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    strategy_name: str
    description: Optional[str] = None
    symbol: str
    timeframe: str
    parameters: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class StrategyConfigUpdate(BaseModel):
    """Partial update for a strategy configuration."""
    description: Optional[str] = None
    symbol: Optional[str] = Field(None, max_length=20)
    timeframe: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


# ══════════════════════════════════════════════════════════════════════════
#  Auto-Trade
# ══════════════════════════════════════════════════════════════════════════

class AutoTradeConfigUpdate(BaseModel):
    """Update auto-trade configuration."""
    enabled: Optional[bool] = None
    evaluation_interval_seconds: Optional[int] = Field(None, ge=15, le=900)
    min_confidence_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)
    timeframe: Optional[str] = Field(None, pattern=r"^(M1|M5|M15|M30|H1|H4)$")
    max_auto_trades_per_day: Optional[int] = Field(None, ge=1, le=10)


class AutoTradeConfigResponse(BaseModel):
    """Auto-trade configuration response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    enabled: bool
    evaluation_interval_seconds: int
    min_confidence_threshold: float
    timeframe: str
    max_auto_trades_per_day: int
    updated_at: datetime


class AutoTradeStatusResponse(BaseModel):
    """Live auto-trade status."""
    enabled: bool
    running: bool
    cycle_count: int = 0
    signals_evaluated: int = 0
    trades_executed: int = 0
    trades_skipped: int = 0
    last_evaluation_at: Optional[datetime] = None
    last_trade_at: Optional[datetime] = None
    last_error: Optional[str] = None
    config: Optional[AutoTradeConfigResponse] = None
