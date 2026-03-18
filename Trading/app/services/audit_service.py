"""
Audit logging service.

Records every decision, trade, lockout, and system event for
post-trade review and compliance. Uses async DB writes so the
hot path is never blocked.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import AlertSeverity, AuditEventType
from app.models.audit import Alert, AuditLog, SystemHealthEvent

logger = logging.getLogger(__name__)


class AuditService:
    """Thin wrapper around audit-related DB operations."""

    # ── Audit log ──────────────────────────────────────────────────

    async def log_event(
        self,
        db: AsyncSession,
        event_type: AuditEventType,
        summary: str,
        *,
        account_id: Optional[int] = None,
        signal_id: Optional[int] = None,
        order_id: Optional[int] = None,
        risk_check_run_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> AuditLog:
        """Create an audit log entry."""
        entry = AuditLog(
            account_id=account_id,
            event_type=event_type,
            summary=summary[:500],
            details=details or {},
            signal_id=signal_id,
            order_id=order_id,
            risk_check_run_id=risk_check_run_id,
        )
        db.add(entry)
        await db.flush()
        logger.debug("AUDIT [%s]: %s", event_type.value, summary)
        return entry

    async def get_recent_events(
        self,
        db: AsyncSession,
        *,
        account_id: Optional[int] = None,
        event_type: Optional[AuditEventType] = None,
        limit: int = 50,
    ) -> List[AuditLog]:
        """Retrieve recent audit entries, newest first."""
        stmt = select(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit)
        if account_id is not None:
            stmt = stmt.where(AuditLog.account_id == account_id)
        if event_type is not None:
            stmt = stmt.where(AuditLog.event_type == event_type)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    # ── Alerts ─────────────────────────────────────────────────────

    async def create_alert(
        self,
        db: AsyncSession,
        severity: AlertSeverity,
        title: str,
        message: str,
        *,
        account_id: Optional[int] = None,
        source: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Alert:
        """Create a user-facing alert."""
        alert = Alert(
            account_id=account_id,
            severity=severity,
            title=title[:255],
            message=message,
            source=source,
            metadata_json=metadata or {},
        )
        db.add(alert)
        await db.flush()
        logger.info("ALERT [%s] %s: %s", severity.value, title, message[:100])
        return alert

    async def get_unacknowledged_alerts(
        self,
        db: AsyncSession,
        *,
        account_id: Optional[int] = None,
        limit: int = 20,
    ) -> List[Alert]:
        stmt = (
            select(Alert)
            .where(Alert.is_acknowledged == False)  # noqa: E712
            .order_by(desc(Alert.created_at))
            .limit(limit)
        )
        if account_id is not None:
            stmt = stmt.where(Alert.account_id == account_id)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def acknowledge_alert(self, db: AsyncSession, alert_id: int) -> bool:
        """Mark an alert as acknowledged."""
        stmt = select(Alert).where(Alert.id == alert_id)
        result = await db.execute(stmt)
        alert = result.scalar_one_or_none()
        if alert is None:
            return False
        alert.is_acknowledged = True
        alert.acknowledged_at = datetime.now(tz=timezone.utc)
        await db.flush()
        return True

    # ── System health events ───────────────────────────────────────

    async def log_health_event(
        self,
        db: AsyncSession,
        component: str,
        status: str,
        *,
        message: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> SystemHealthEvent:
        from app.core.enums import SystemHealthStatus
        evt = SystemHealthEvent(
            component=component,
            status=SystemHealthStatus(status),
            message=message,
            details=details or {},
        )
        db.add(evt)
        await db.flush()
        return evt

    # ── Convenience: log risk check run ────────────────────────────

    async def log_risk_check(
        self,
        db: AsyncSession,
        account_id: int,
        decision: str,
        guard_count: int,
        block_count: int,
        warn_count: int,
        final_lot: float,
        *,
        signal_id: Optional[int] = None,
        risk_check_run_id: Optional[int] = None,
    ) -> AuditLog:
        return await self.log_event(
            db,
            AuditEventType.RISK_CHECK_RUN,
            f"Risk check: {decision} | guards={guard_count} blocks={block_count} "
            f"warns={warn_count} lot={final_lot}",
            account_id=account_id,
            signal_id=signal_id,
            risk_check_run_id=risk_check_run_id,
            details={
                "decision": decision,
                "guard_count": guard_count,
                "block_count": block_count,
                "warn_count": warn_count,
                "final_lot": final_lot,
            },
        )

    async def log_order_event(
        self,
        db: AsyncSession,
        event_type: AuditEventType,
        account_id: int,
        order_id: int,
        ticket: int,
        details: Dict[str, Any],
    ) -> AuditLog:
        return await self.log_event(
            db,
            event_type,
            f"Order {event_type.value}: ticket={ticket}",
            account_id=account_id,
            order_id=order_id,
            details=details,
        )
