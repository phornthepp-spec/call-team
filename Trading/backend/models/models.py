"""
SQLAlchemy 2.0 ORM models for the XAUUSD trading system.

All 12 tables:
  users, trading_accounts, account_snapshots, market_ticks, market_bars,
  trade_signals, risk_checks, orders, executions, daily_risk_stats,
  profit_allocations, strategy_configs
"""

from __future__ import annotations

import enum
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


# ── Enums ────────────────────────────────────────────────────────────────

class SignalDirection(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"


class SignalStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


class RiskVerdict(str, enum.Enum):
    PASS = "PASS"
    FAIL = "FAIL"


class OrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    PLACED = "PLACED"
    FILLED = "FILLED"
    PARTIALLY_FILLED = "PARTIALLY_FILLED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


class OrderType(str, enum.Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"
    STOP = "STOP"
    STOP_LIMIT = "STOP_LIMIT"


class Timeframe(str, enum.Enum):
    M1 = "M1"
    M5 = "M5"
    M15 = "M15"
    M30 = "M30"
    H1 = "H1"
    H4 = "H4"
    D1 = "D1"
    W1 = "W1"
    MN1 = "MN1"


class AllocationCategory(str, enum.Enum):
    COMPOUND = "COMPOUND"
    WITHDRAW = "WITHDRAW"
    RESERVE = "RESERVE"
    TAX = "TAX"


# ── Models ───────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    trading_accounts: Mapped[List["TradingAccount"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    strategy_configs: Mapped[List["StrategyConfig"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class TradingAccount(Base):
    __tablename__ = "trading_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mt5_login: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    mt5_server: Mapped[str] = mapped_column(String(255), nullable=False)
    account_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    broker: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    leverage: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="trading_accounts")
    snapshots: Mapped[List["AccountSnapshot"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )
    signals: Mapped[List["TradeSignal"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )
    orders: Mapped[List["Order"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )
    daily_risk_stats: Mapped[List["DailyRiskStat"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )
    profit_allocations: Mapped[List["ProfitAllocation"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )
    auto_trade_config: Mapped[Optional["AutoTradeConfig"]] = relationship(
        back_populates="account", cascade="all, delete-orphan", uselist=False
    )


class AccountSnapshot(Base):
    __tablename__ = "account_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trading_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    equity: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    margin: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    free_margin: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    margin_level: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    open_positions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    floating_pnl: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    snapshot_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    # Relationships
    account: Mapped["TradingAccount"] = relationship(back_populates="snapshots")


class MarketTick(Base):
    __tablename__ = "market_ticks"
    __table_args__ = (
        Index("ix_market_ticks_symbol_time", "symbol", "tick_time"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    bid: Mapped[Decimal] = mapped_column(Numeric(12, 5), nullable=False)
    ask: Mapped[Decimal] = mapped_column(Numeric(12, 5), nullable=False)
    spread: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    volume: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    tick_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class MarketBar(Base):
    __tablename__ = "market_bars"
    __table_args__ = (
        UniqueConstraint("symbol", "timeframe", "bar_time", name="uq_market_bars_symbol_tf_time"),
        Index("ix_market_bars_symbol_tf_time", "symbol", "timeframe", "bar_time"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    timeframe: Mapped[Timeframe] = mapped_column(Enum(Timeframe), nullable=False)
    open: Mapped[Decimal] = mapped_column(Numeric(12, 5), nullable=False)
    high: Mapped[Decimal] = mapped_column(Numeric(12, 5), nullable=False)
    low: Mapped[Decimal] = mapped_column(Numeric(12, 5), nullable=False)
    close: Mapped[Decimal] = mapped_column(Numeric(12, 5), nullable=False)
    tick_volume: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    real_volume: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    bar_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class TradeSignal(Base):
    __tablename__ = "trade_signals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trading_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    symbol: Mapped[str] = mapped_column(String(20), default="XAUUSD", nullable=False)
    direction: Mapped[SignalDirection] = mapped_column(Enum(SignalDirection), nullable=False)
    entry_price: Mapped[Decimal] = mapped_column(Numeric(12, 5), nullable=False)
    stop_loss: Mapped[Decimal] = mapped_column(Numeric(12, 5), nullable=False)
    take_profit: Mapped[Decimal] = mapped_column(Numeric(12, 5), nullable=False)
    lot_size: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    risk_reward_ratio: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    strategy_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    timeframe: Mapped[Optional[Timeframe]] = mapped_column(Enum(Timeframe), nullable=True)
    confidence: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[SignalStatus] = mapped_column(
        Enum(SignalStatus), default=SignalStatus.PENDING, nullable=False, index=True
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expired_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    account: Mapped["TradingAccount"] = relationship(back_populates="signals")
    risk_checks: Mapped[List["RiskCheck"]] = relationship(
        back_populates="signal", cascade="all, delete-orphan"
    )
    orders: Mapped[List["Order"]] = relationship(
        back_populates="signal", cascade="all, delete-orphan"
    )


class RiskCheck(Base):
    __tablename__ = "risk_checks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    signal_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trade_signals.id", ondelete="CASCADE"), nullable=False, index=True
    )
    check_name: Mapped[str] = mapped_column(String(100), nullable=False)
    check_value: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    threshold: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    verdict: Mapped[RiskVerdict] = mapped_column(Enum(RiskVerdict), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    signal: Mapped["TradeSignal"] = relationship(back_populates="risk_checks")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trading_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    signal_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("trade_signals.id", ondelete="SET NULL"), nullable=True, index=True
    )
    mt5_ticket: Mapped[Optional[int]] = mapped_column(Integer, unique=True, nullable=True)
    symbol: Mapped[str] = mapped_column(String(20), default="XAUUSD", nullable=False)
    order_type: Mapped[OrderType] = mapped_column(Enum(OrderType), nullable=False)
    direction: Mapped[SignalDirection] = mapped_column(Enum(SignalDirection), nullable=False)
    lot_size: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    entry_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    stop_loss: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    take_profit: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus), default=OrderStatus.PENDING, nullable=False, index=True
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    placed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    filled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    account: Mapped["TradingAccount"] = relationship(back_populates="orders")
    signal: Mapped[Optional["TradeSignal"]] = relationship(back_populates="orders")
    executions: Mapped[List["Execution"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )


class Execution(Base):
    __tablename__ = "executions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mt5_deal_id: Mapped[Optional[int]] = mapped_column(Integer, unique=True, nullable=True)
    fill_price: Mapped[Decimal] = mapped_column(Numeric(12, 5), nullable=False)
    fill_lot_size: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    commission: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    swap: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    profit: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    close_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 5), nullable=True)
    close_reason: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    order: Mapped["Order"] = relationship(back_populates="executions")


class DailyRiskStat(Base):
    __tablename__ = "daily_risk_stats"
    __table_args__ = (
        UniqueConstraint("account_id", "stat_date", name="uq_daily_risk_account_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trading_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    stat_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    starting_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    ending_balance: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    realized_pnl: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    total_commission: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    total_swap: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    trades_taken: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    wins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    losses: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    consecutive_losses: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_drawdown_pct: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=0, nullable=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    lock_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    account: Mapped["TradingAccount"] = relationship(back_populates="daily_risk_stats")


class ProfitAllocation(Base):
    __tablename__ = "profit_allocations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trading_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    gross_profit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    net_profit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    category: Mapped[AllocationCategory] = mapped_column(Enum(AllocationCategory), nullable=False)
    percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    account: Mapped["TradingAccount"] = relationship(back_populates="profit_allocations")


class StrategyConfig(Base):
    __tablename__ = "strategy_configs"
    __table_args__ = (
        UniqueConstraint("user_id", "strategy_name", name="uq_strategy_config_user_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    strategy_name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    symbol: Mapped[str] = mapped_column(String(20), default="XAUUSD", nullable=False)
    timeframe: Mapped[Timeframe] = mapped_column(Enum(Timeframe), default=Timeframe.H1, nullable=False)
    parameters: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="strategy_configs")


class AutoTradeConfig(Base):
    """Per-account full-auto trading configuration."""
    __tablename__ = "auto_trade_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trading_accounts.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    evaluation_interval_seconds: Mapped[int] = mapped_column(
        Integer, default=60, nullable=False
    )
    min_confidence_threshold: Mapped[float] = mapped_column(
        Float, default=0.70, nullable=False
    )
    timeframe: Mapped[str] = mapped_column(String(10), default="M15", nullable=False)
    max_auto_trades_per_day: Mapped[int] = mapped_column(
        Integer, default=3, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    account: Mapped["TradingAccount"] = relationship(
        back_populates="auto_trade_config"
    )
