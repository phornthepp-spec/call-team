"""
Pydantic schemas for orders, signals, and executions.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class SignalCreateRequest(BaseModel):
    """Manual signal injection (for testing / override)."""
    account_id: int
    symbol: str = "XAUUSD"
    direction: str  # BUY / SELL
    entry_price: float
    stop_loss: float
    take_profit: float
    confidence: float = 0.0
    confirmation_count: int = 0
    strategy_name: str = "manual"
    timeframe: str = "M15"
    notes: Optional[str] = None


class SignalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int
    symbol: str
    direction: str
    entry_price: Decimal
    stop_loss: Decimal
    take_profit: Decimal
    risk_reward_ratio: Decimal
    strategy_name: Optional[str] = None
    timeframe: Optional[str] = None
    confidence: Optional[float] = None
    confirmation_count: int = 0
    status: str
    signal_fingerprint: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime


class OrderPlaceRequest(BaseModel):
    """Direct order placement request (post risk-check)."""
    account_id: int
    signal_id: Optional[int] = None
    risk_check_run_id: Optional[int] = None
    symbol: str = "XAUUSD"
    direction: str  # BUY / SELL
    lot_size: float
    entry_price: float
    stop_loss: float
    take_profit: float
    magic_number: int = 999999
    comment: Optional[str] = None
    deviation_points: int = 20


class OrderResponse(BaseModel):
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
    magic_number: int
    comment: Optional[str] = None
    slippage_points: Optional[float] = None
    error_message: Optional[str] = None
    close_reason: Optional[str] = None
    close_price: Optional[Decimal] = None
    profit: Decimal = Decimal("0")
    commission: Decimal = Decimal("0")
    swap: Decimal = Decimal("0")
    placed_at: Optional[datetime] = None
    filled_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class OrderCloseRequest(BaseModel):
    """Close an order by ticket or DB id."""
    reason: str = "MANUAL"
    comment: Optional[str] = None


class OpenPositionResponse(BaseModel):
    """Live open position from MT5."""
    ticket: int
    symbol: str
    side: str
    volume: float
    price_open: float
    current_price: float
    sl: float
    tp: float
    floating_pl: float
    magic: int
    comment: str = ""
    time_open: Optional[datetime] = None
    in_db: bool = False  # whether a matching Order row exists


class ExecutionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    order_id: int
    mt5_deal_id: Optional[int] = None
    fill_price: Decimal
    fill_lot_size: Decimal
    commission: Decimal
    swap: Decimal
    profit: Decimal
    slippage_points: Optional[float] = None
    opened_at: datetime
    closed_at: Optional[datetime] = None
    execution_time_ms: Optional[int] = None


class OrderHistoryResponse(BaseModel):
    """Paginated order history."""
    orders: List[OrderResponse] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    per_page: int = 50
