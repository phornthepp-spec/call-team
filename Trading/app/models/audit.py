"""
AuditLog, Alert, SystemHealthEvent ORM models.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import AlertSeverity, AuditEventType, SystemHealthStatus
from app.models.base import Base, IDMixin


class AuditLog(Base, IDMixin):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_event_ts", "event_type", "created_at"),
    )

    account_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("trading_accounts.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    event_type: Mapped[AuditEventType] = mapped_column(
        Enum(AuditEventType), nullable=False, index=True
    )
    summary: Mapped[str] = mapped_column(String(500), nullable=False)
    details: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    signal_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    order_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    risk_check_run_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


class Alert(Base, IDMixin):
    __tablename__ = "alerts"
    __table_args__ = (
        Index("ix_alert_severity_ts", "severity", "created_at"),
    )

    account_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("trading_accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    severity: Mapped[AlertSeverity] = mapped_column(
        Enum(AlertSeverity), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_acknowledged: Mapped[bool] = mapped_column(default=False, nullable=False)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SystemHealthEvent(Base, IDMixin):
    __tablename__ = "system_health_events"

    component: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    status: Mapped[SystemHealthStatus] = mapped_column(
        Enum(SystemHealthStatus), nullable=False
    )
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    details: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
