"""
Pydantic schemas for broker profiles and ACCM-specific configuration.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class BrokerConnectionConfig(BaseModel):
    """Runtime broker connection parameters."""
    broker_name: str = "ACCM"
    broker_domain: str = "accm.global"
    mt5_server: str = "ACCM-Live"
    mt5_login: int = 0
    mt5_password: str = ""
    terminal_path: str = ""
    terminal_data_path: str = ""


class BrokerSymbolConfig(BaseModel):
    """Broker-specific symbol configuration."""
    canonical_symbol: str = "XAUUSD"
    broker_symbol: str = "XAUUSD"
    aliases: List[str] = Field(default_factory=lambda: ["XAUUSD", "XAUUSD.", "XAUUSDm", "GOLD", "GOLD."])
    contract_size: float = 100.0
    volume_min: float = 0.01
    volume_max: float = 100.0
    volume_step: float = 0.01
    point: float = 0.01
    digits: int = 2
    stop_level: int = 0
    freeze_level: int = 0


class BrokerExecutionProfile(BaseModel):
    """Broker-specific execution parameters."""
    fill_policy_preferences: List[str] = Field(default_factory=lambda: ["IOC", "RETURN"])
    default_deviation_points: int = 20
    execution_timeout_seconds: int = 3
    max_order_retries: int = 1
    reconnect_attempts: int = 3
    reconnect_backoff_seconds: float = 2.0
    slippage_warn_points: float = 12.0
    slippage_max_points: float = 20.0
    magic_number_base: int = 999000
    comment_prefix: str = "7H-AUTO"


class BrokerHealthSnapshot(BaseModel):
    """Current broker execution health."""
    connected: bool = False
    last_heartbeat: Optional[datetime] = None
    avg_fill_time_ms: float = 0.0
    success_rate: float = 1.0
    recent_slippage_avg: float = 0.0
    recent_slippage_max: float = 0.0
    consecutive_failures: int = 0


class BrokerProfileResponse(BaseModel):
    """Full broker profile for API responses."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    broker_name: str
    broker_domain: str
    is_active: bool
    mt5_server_candidates: List[str]
    primary_symbol: str
    symbol_aliases: List[str]
    symbol_mapping: Dict[str, Any]
    contract_spec_overrides: Dict[str, Any]
    fill_policy_preferences: List[str]
    default_order_deviation_points: int
    execution_timeout_seconds: int
    reconnect_attempts: int
    magic_number_base: int
    comment_prefix: str
    created_at: datetime
    updated_at: datetime


class BrokerProfileCreate(BaseModel):
    """Create a new broker profile."""
    broker_name: str
    broker_domain: str
    mt5_server_candidates: List[str] = Field(default_factory=list)
    primary_symbol: str = "XAUUSD"
    symbol_aliases: List[str] = Field(default_factory=list)
    default_order_deviation_points: int = 20
    execution_timeout_seconds: int = 3
    reconnect_attempts: int = 3


class SymbolInfoResponse(BaseModel):
    """Resolved symbol information from broker + MT5."""
    canonical_symbol: str
    broker_symbol: str
    resolved_from_alias: bool = False
    contract_size: float
    volume_min: float
    volume_max: float
    volume_step: float
    point: float
    digits: int
    stop_level: int
    freeze_level: int
    spread: float = 0.0
    filling_mode: int = 0
    execution_mode: int = 0
    visible: bool = True
