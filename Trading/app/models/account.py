"""
User, TradingAccount, AccountSnapshot, DailyRiskStats, WeeklyRiskStats,
MonthlyRiskStats, LockoutEvent ORM models.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    Boolean, Date, DateTime, Enum, Float, ForeignKey, Index, Integer,
    Numeric, String, Text, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import LockoutTrigger, LockoutType
from app.models.base import Base, IDMixin, TimestampMixin


class User(Base, IDMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    trading_accounts: Mapped[List["TradingAccount"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class TradingAccount(Base, IDMixin, TimestampMixin):
    __tablename__ = "trading_accounts"

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    broker_profile_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("broker_profiles.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    mt5_login: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    mt5_server: Mapped[str] = mapped_column(String(255), nullable=False)
    account_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    broker: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    leverage: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user: Mapped["User"] = relationship(back_populates="trading_accounts")
    snapshots: Mapped[List["AccountSnapshot"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )
    daily_risk_stats: Mapped[List["DailyRiskStats"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )


class AccountSnapshot(Base, IDMixin):
    __tablename__ = "account_snapshots"

    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trading_accounts.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    equity: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    margin: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    free_margin: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    margin_level: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    open_positions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    floating_pnl: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    snapshot_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    account: Mapped["TradingAccount"] = relationship(back_populates="snapshots")


class DailyRiskStats(Base, IDMixin, TimestampMixin):
    __tablename__ = "daily_risk_stats"
    __table_args__ = (
        UniqueConstraint("account_id", "stat_date", name="uq_daily_risk_account_date"),
    )

    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trading_accounts.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    stat_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    starting_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
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
    open_risk_pct: Mapped[Decimal] = mapped_column(Numeric(6, 4), default=0, nullable=False)
    peak_equity: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)

    account: Mapped["TradingAccount"] = relationship(back_populates="daily_risk_stats")


class WeeklyRiskStats(Base, IDMixin, TimestampMixin):
    __tablename__ = "weekly_risk_stats"
    __table_args__ = (
        UniqueConstraint("account_id", "week_start", name="uq_weekly_risk_account_week"),
    )

    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trading_accounts.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    week_start: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    starting_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    realized_pnl: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    trades_taken: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    wins: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    losses: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_drawdown_pct: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=0, nullable=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class MonthlyRiskStats(Base, IDMixin, TimestampMixin):
    __tablename__ = "monthly_risk_stats"
    __table_args__ = (
        UniqueConstraint("account_id", "month_start", name="uq_monthly_risk_account_month"),
    )

    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trading_accounts.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    month_start: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    starting_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    realized_pnl: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0, nullable=False)
    trades_taken: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_drawdown_pct: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=0, nullable=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class LockoutEvent(Base, IDMixin):
    __tablename__ = "lockout_events"
    __table_args__ = (
        Index("ix_lockout_account_type", "account_id", "lockout_type"),
    )

    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trading_accounts.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    lockout_type: Mapped[LockoutType] = mapped_column(Enum(LockoutType), nullable=False)
    trigger: Mapped[LockoutTrigger] = mapped_column(Enum(LockoutTrigger), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    activated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cleared_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
