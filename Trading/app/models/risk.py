"""
Risk check and risk guard result ORM models.

Every risk evaluation run produces one RiskCheckRun plus N RiskGuardResult rows,
giving a full audit trail of every guard's verdict for every signal.
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
    FinalDecision, GuardCategory, GuardSeverity, GuardStatus, PolicyMode,
)
from app.models.base import Base, IDMixin


class RiskCheckRun(Base, IDMixin):
    """One complete risk evaluation for a signal / pre-trade check."""
    __tablename__ = "risk_check_runs"
    __table_args__ = (
        Index("ix_riskrun_account_date", "account_id", "checked_at"),
    )

    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("trading_accounts.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    signal_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("trade_signals.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    policy_mode: Mapped[PolicyMode] = mapped_column(Enum(PolicyMode), nullable=False)
    final_decision: Mapped[FinalDecision] = mapped_column(Enum(FinalDecision), nullable=False)
    decision_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    total_guards: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    pass_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    warn_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    block_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    requested_lot: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    approved_lot: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    lot_reduction_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    execution_time_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Full snapshot of account state at time of check
    account_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    market_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    guard_results: Mapped[List["RiskGuardResult"]] = relationship(
        back_populates="risk_check_run", cascade="all, delete-orphan"
    )


class RiskGuardResult(Base, IDMixin):
    """Individual guard outcome within a RiskCheckRun."""
    __tablename__ = "risk_guard_results"
    __table_args__ = (
        Index("ix_guardresult_run", "risk_check_run_id"),
    )

    risk_check_run_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("risk_check_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    guard_name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[GuardCategory] = mapped_column(Enum(GuardCategory), nullable=False)
    status: Mapped[GuardStatus] = mapped_column(Enum(GuardStatus), nullable=False)
    severity: Mapped[GuardSeverity] = mapped_column(Enum(GuardSeverity), nullable=False)
    current_value: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    threshold: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    action: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    lockout_impact: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    safe_mode_impact: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    checked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    risk_check_run: Mapped["RiskCheckRun"] = relationship(back_populates="guard_results")
