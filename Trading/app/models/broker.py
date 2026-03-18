"""
Broker profile ORM model.

Stores broker-specific configuration including ACCM connection details,
symbol mappings, execution profile, and MT5 server candidates.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IDMixin, TimestampMixin


class BrokerProfile(Base, IDMixin, TimestampMixin):
    """Persisted broker configuration."""
    __tablename__ = "broker_profiles"

    broker_name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    broker_domain: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # MT5 connection
    mt5_server_candidates: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=list,
        comment='["ACCM-Live", "ACCM-Demo"]'
    )
    default_mt5_server: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Symbol mapping
    primary_symbol: Mapped[str] = mapped_column(String(20), default="XAUUSD", nullable=False)
    symbol_aliases: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=list,
        comment='["XAUUSD", "XAUUSD.", "XAUUSDm", "GOLD"]'
    )
    symbol_mapping: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict,
        comment='{"canonical": "XAUUSD", "broker_symbol": "XAUUSD"}'
    )

    # Contract spec overrides (if broker returns unexpected values)
    contract_spec_overrides: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict,
        comment='{"contract_size": 100, "volume_min": 0.01, "volume_step": 0.01}'
    )

    # Execution profile
    fill_policy_preferences: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=list,
        comment='["IOC", "RETURN"]'
    )
    default_order_deviation_points: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    execution_timeout_seconds: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    slippage_profile: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict,
        comment='{"warn_points": 12, "max_points": 20}'
    )

    # Connection resilience
    reconnect_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    reconnect_backoff_seconds: Mapped[float] = mapped_column(Float, default=2.0, nullable=False)

    # Stop / freeze level overrides
    stop_level_override: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    freeze_level_override: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Magic number namespace
    magic_number_base: Mapped[int] = mapped_column(Integer, default=999000, nullable=False)
    comment_prefix: Mapped[str] = mapped_column(String(20), default="7H-AUTO", nullable=False)

    # Execution health tracking
    execution_health: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=dict,
        comment='{"avg_fill_ms": 120, "success_rate": 0.98}'
    )

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
