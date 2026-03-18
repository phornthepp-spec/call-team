"""
TradeSignal, Order, Execution ORM models.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey, Index, Integer,
    Numeric, String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import (
    CloseReason, OrderStatus, OrderType, SignalSide, SignalStatus, Timeframe,
)
from app.models.base import Base, IDMixin, TimestampMixin


class TradeSignal(Base, IDMixin, TimestampMixin):
    __tablename__ = "trade_signals"
    __table_args__ = (
        Index("ix_signal_account_status", "account_id", "status"),
    )

    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trading_accounts.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    symbol: Mapped[str] = mapped_column(String(20), default="XAUUSD", nullable=False)
    direction: Mapped[SignalSide] = mapped_column(Enum(SignalSide), nullable=False)
    entry_price: Mapped[Decimal] = mapped_column(Numeric(12, 5), nullable=False)
    stop_loss: Mapped[Decimal] = mapped_column(Numeric(12, 5), nullable=False)
    take_profit: Mapped[Decimal] = mapped_column(Numeric(12, 5), nullable=False)
    risk_reward_ratio: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    strategy_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    timeframe: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    confirmation_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    regime_expectation: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    setup_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    signal_fingerprint: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, index=True,
        comment="SHA-256 of (side+entry+sl+tp+timeframe+timestamp_minute) for dedup"
    )
    status: Mapped[SignalStatus] = mapped_column(
        Enum(SignalStatus), default=SignalStatus.PENDING, nullable=False, index=True
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expired_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # AI / model metadata
    model_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    model_latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    feature_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    orders: Mapped[List["Order"]] = relationship(
        back_populates="signal", cascade="all, delete-orphan"
    )


class Order(Base, IDMixin, TimestampMixin):
    __tablename__ = "orders"
    __table_args__ = (
        Index("ix_order_account_status", "account_id", "status"),
    )

    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trading_accounts.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    signal_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("trade_signals.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    mt5_ticket: Mapped[Optional[int]] = mapped_column(Integer, unique=True, nullable=True)
    symbol: Mapped[str] = mapped_column(String(20), default="XAUUSD", nullable=False)
    order_type: Mapped[OrderType] = mapped_column(Enum(OrderType), nullable=False)
    direction: Mapped[SignalSide] = mapped_column(Enum(SignalSide), nullable=False)
    lot_size: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False)
    entry_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    stop_loss: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    take_profit: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus), default=OrderStatus.PENDING, nullable=False, index=True
    )
    magic_number: Mapped[int] = mapped_column(Integer, default=999999, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    slippage_points: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    deviation_points: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    risk_check_run_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("risk_check_runs.id", ondelete="SET NULL"), nullable=True
    )
    close_reason: Mapped[Optional[CloseReason]] = mapped_column(Enum(CloseReason), nullable=True)
    close_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    profit: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    commission: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    swap: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)

    placed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    filled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    signal: Mapped[Optional["TradeSignal"]] = relationship(back_populates="orders")
    executions: Mapped[List["Execution"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )


class Execution(Base, IDMixin):
    __tablename__ = "executions"

    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    mt5_deal_id: Mapped[Optional[int]] = mapped_column(Integer, unique=True, nullable=True)
    fill_price: Mapped[Decimal] = mapped_column(Numeric(12, 5), nullable=False)
    fill_lot_size: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False)
    commission: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    swap: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    profit: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    slippage_points: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    close_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    close_reason: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    execution_time_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    order: Mapped["Order"] = relationship(back_populates="executions")
