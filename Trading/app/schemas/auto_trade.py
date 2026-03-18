"""
Pydantic schemas for auto-trade API endpoints.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AutoTradeConfigSchema(BaseModel):
    """Auto-trade configuration (editable by user)."""
    evaluation_interval_seconds: int = Field(60, ge=15, le=900)
    min_confidence_threshold: float = Field(0.70, ge=0.0, le=1.0)
    timeframe: str = "M15"
    max_auto_trades_per_day: int = Field(3, ge=1, le=10)


class AutoTradeConfigUpdate(BaseModel):
    """Partial update for auto-trade config."""
    evaluation_interval_seconds: Optional[int] = Field(None, ge=15, le=900)
    min_confidence_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)
    timeframe: Optional[str] = None
    max_auto_trades_per_day: Optional[int] = Field(None, ge=1, le=10)


class AutoTradeStatusResponse(BaseModel):
    """Full status of the auto-trade worker."""
    enabled: bool = False
    running: bool = False
    cycle_count: int = 0
    signals_evaluated: int = 0
    trades_executed: int = 0
    trades_skipped: int = 0
    trades_rejected: int = 0
    last_evaluation_at: Optional[datetime] = None
    last_trade_at: Optional[datetime] = None
    last_signal_side: Optional[str] = None
    last_signal_confidence: Optional[float] = None
    last_error: Optional[str] = None
    uptime_seconds: Optional[float] = None
    config: AutoTradeConfigSchema = Field(default_factory=AutoTradeConfigSchema)


class AutoTradeActionResponse(BaseModel):
    """Response for start/stop actions."""
    success: bool
    message: str
    status: AutoTradeStatusResponse
