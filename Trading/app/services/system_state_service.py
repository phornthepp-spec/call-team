"""
System state service.

Manages global system state: kill switch, safe mode, lockouts,
and component health tracking. This is the single source of truth
for "should the system be trading right now?"
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.enums import (
    AlertSeverity,
    AuditEventType,
    LockoutTrigger,
    LockoutType,
    SystemHealthStatus,
)
from app.models.account import LockoutEvent
from app.services.audit_service import AuditService

logger = logging.getLogger(__name__)


class SystemStateService:
    """
    Centralised state for kill switch, safe mode, lockouts.

    Operates both in-memory (for hot-path speed) and persisted to DB
    (for restart recovery). On startup, load from DB to rebuild state.
    """

    def __init__(self):
        self._kill_switch_active: bool = False
        self._kill_switch_reason: Optional[str] = None
        self._safe_mode_active: bool = False
        self._safe_mode_reason: Optional[str] = None
        self._component_health: Dict[str, SystemHealthStatus] = {}
        self._audit = AuditService()

    # ── Kill switch ────────────────────────────────────────────────

    @property
    def kill_switch_active(self) -> bool:
        return self._kill_switch_active

    async def activate_kill_switch(
        self,
        db: AsyncSession,
        reason: str,
        *,
        account_id: Optional[int] = None,
    ) -> None:
        """Activate the kill switch — all trading stops immediately."""
        self._kill_switch_active = True
        self._kill_switch_reason = reason
        logger.critical("KILL SWITCH ACTIVATED: %s", reason)

        # Persist lockout
        lockout = LockoutEvent(
            account_id=account_id or 0,
            lockout_type=LockoutType.KILL_SWITCH,
            trigger=LockoutTrigger.MANUAL,
            reason=reason,
            is_active=True,
        )
        db.add(lockout)

        await self._audit.log_event(
            db,
            AuditEventType.KILL_SWITCH_ACTIVATED,
            f"Kill switch activated: {reason}",
            account_id=account_id,
            details={"reason": reason},
        )
        await self._audit.create_alert(
            db,
            AlertSeverity.CRITICAL,
            "Kill Switch Activated",
            reason,
            account_id=account_id,
            source="kill_switch",
        )
        await db.commit()

    async def deactivate_kill_switch(
        self,
        db: AsyncSession,
        *,
        account_id: Optional[int] = None,
    ) -> None:
        """Deactivate the kill switch — resume trading."""
        self._kill_switch_active = False
        self._kill_switch_reason = None
        logger.info("Kill switch deactivated")

        # Mark lockout inactive
        stmt = (
            select(LockoutEvent)
            .where(
                and_(
                    LockoutEvent.lockout_type == LockoutType.KILL_SWITCH,
                    LockoutEvent.is_active == True,  # noqa: E712
                )
            )
        )
        result = await db.execute(stmt)
        for row in result.scalars().all():
            row.is_active = False
            row.resolved_at = datetime.now(tz=timezone.utc)

        await self._audit.log_event(
            db,
            AuditEventType.KILL_SWITCH_DEACTIVATED,
            "Kill switch deactivated",
            account_id=account_id,
        )
        await db.commit()

    # ── Safe mode ──────────────────────────────────────────────────

    @property
    def safe_mode_active(self) -> bool:
        return self._safe_mode_active

    async def activate_safe_mode(
        self,
        db: AsyncSession,
        reason: str,
        *,
        account_id: Optional[int] = None,
    ) -> None:
        if self._safe_mode_active:
            return  # already active

        self._safe_mode_active = True
        self._safe_mode_reason = reason
        logger.warning("SAFE MODE ACTIVATED: %s", reason)

        lockout = LockoutEvent(
            account_id=account_id or 0,
            lockout_type=LockoutType.SAFE_MODE,
            trigger=LockoutTrigger.WARN_CLUSTER,
            reason=reason,
            is_active=True,
        )
        db.add(lockout)

        await self._audit.log_event(
            db,
            AuditEventType.SAFE_MODE_ACTIVATED,
            f"Safe mode activated: {reason}",
            account_id=account_id,
            details={"reason": reason},
        )
        await db.commit()

    async def deactivate_safe_mode(
        self,
        db: AsyncSession,
        *,
        account_id: Optional[int] = None,
    ) -> None:
        if not self._safe_mode_active:
            return

        self._safe_mode_active = False
        self._safe_mode_reason = None
        logger.info("Safe mode deactivated")

        stmt = (
            select(LockoutEvent)
            .where(
                and_(
                    LockoutEvent.lockout_type == LockoutType.SAFE_MODE,
                    LockoutEvent.is_active == True,  # noqa: E712
                )
            )
        )
        result = await db.execute(stmt)
        for row in result.scalars().all():
            row.is_active = False
            row.resolved_at = datetime.now(tz=timezone.utc)

        await self._audit.log_event(
            db,
            AuditEventType.SAFE_MODE_DEACTIVATED,
            "Safe mode deactivated",
            account_id=account_id,
        )
        await db.commit()

    # ── Lockouts ───────────────────────────────────────────────────

    async def create_lockout(
        self,
        db: AsyncSession,
        account_id: int,
        lockout_type: LockoutType,
        trigger: LockoutTrigger,
        reason: str,
        *,
        expires_at: Optional[datetime] = None,
    ) -> LockoutEvent:
        """Create a new lockout event."""
        lockout = LockoutEvent(
            account_id=account_id,
            lockout_type=lockout_type,
            trigger=trigger,
            reason=reason,
            is_active=True,
            expires_at=expires_at,
        )
        db.add(lockout)
        await db.flush()

        await self._audit.log_event(
            db,
            AuditEventType.LOCKOUT_ACTIVATED,
            f"Lockout: {lockout_type.value} ({trigger.value}) — {reason}",
            account_id=account_id,
            details={
                "lockout_type": lockout_type.value,
                "trigger": trigger.value,
                "reason": reason,
                "expires_at": expires_at.isoformat() if expires_at else None,
            },
        )
        logger.warning(
            "LOCKOUT [%s] trigger=%s: %s (expires=%s)",
            lockout_type.value, trigger.value, reason, expires_at,
        )
        return lockout

    async def get_active_lockouts(
        self,
        db: AsyncSession,
        account_id: int,
    ) -> List[LockoutEvent]:
        """Get all currently active lockouts for an account."""
        now = datetime.now(tz=timezone.utc)
        stmt = (
            select(LockoutEvent)
            .where(
                and_(
                    LockoutEvent.account_id == account_id,
                    LockoutEvent.is_active == True,  # noqa: E712
                )
            )
        )
        result = await db.execute(stmt)
        lockouts = list(result.scalars().all())

        # Auto-expire lockouts whose expiry has passed
        active = []
        for lo in lockouts:
            if lo.expires_at and lo.expires_at <= now:
                lo.is_active = False
                lo.resolved_at = now
                logger.info("Lockout %d auto-expired: %s", lo.id, lo.lockout_type.value)
            else:
                active.append(lo)

        if len(active) != len(lockouts):
            await db.flush()

        return active

    async def has_lockout(
        self,
        db: AsyncSession,
        account_id: int,
        lockout_type: Optional[LockoutType] = None,
    ) -> bool:
        """Check if any active lockout exists."""
        lockouts = await self.get_active_lockouts(db, account_id)
        if lockout_type is None:
            return len(lockouts) > 0
        return any(lo.lockout_type == lockout_type for lo in lockouts)

    async def clear_lockout(
        self,
        db: AsyncSession,
        account_id: int,
        lockout_type: LockoutType,
    ) -> int:
        """Clear all active lockouts of a given type for an account."""
        now = datetime.now(tz=timezone.utc)
        stmt = (
            select(LockoutEvent)
            .where(
                and_(
                    LockoutEvent.account_id == account_id,
                    LockoutEvent.lockout_type == lockout_type,
                    LockoutEvent.is_active == True,  # noqa: E712
                )
            )
        )
        result = await db.execute(stmt)
        cleared = 0
        for lo in result.scalars().all():
            lo.is_active = False
            lo.resolved_at = now
            cleared += 1

        if cleared:
            await self._audit.log_event(
                db,
                AuditEventType.LOCKOUT_CLEARED,
                f"Lockout cleared: {lockout_type.value} ({cleared} events)",
                account_id=account_id,
            )
            await db.flush()

        return cleared

    # ── Component health ───────────────────────────────────────────

    def update_component_health(
        self,
        component: str,
        status: SystemHealthStatus,
    ) -> None:
        """Update in-memory component health status."""
        prev = self._component_health.get(component)
        self._component_health[component] = status
        if prev != status:
            logger.info("Component %s: %s → %s", component, prev, status.value)

    def get_component_health(self, component: str) -> SystemHealthStatus:
        return self._component_health.get(component, SystemHealthStatus.OFFLINE)

    def get_all_component_health(self) -> Dict[str, str]:
        return {k: v.value for k, v in self._component_health.items()}

    def get_overall_health(self) -> SystemHealthStatus:
        """Aggregate health: worst component determines overall."""
        if not self._component_health:
            return SystemHealthStatus.OFFLINE
        statuses = list(self._component_health.values())
        if any(s == SystemHealthStatus.CRITICAL for s in statuses):
            return SystemHealthStatus.CRITICAL
        if any(s == SystemHealthStatus.DEGRADED for s in statuses):
            return SystemHealthStatus.DEGRADED
        if any(s == SystemHealthStatus.OFFLINE for s in statuses):
            return SystemHealthStatus.OFFLINE
        return SystemHealthStatus.HEALTHY

    # ── State snapshot ─────────────────────────────────────────────

    def get_system_state(self) -> Dict[str, Any]:
        """Full system state snapshot for the dashboard."""
        return {
            "kill_switch_active": self._kill_switch_active,
            "kill_switch_reason": self._kill_switch_reason,
            "safe_mode_active": self._safe_mode_active,
            "safe_mode_reason": self._safe_mode_reason,
            "overall_health": self.get_overall_health().value,
            "component_health": self.get_all_component_health(),
        }

    # ── Startup recovery ───────────────────────────────────────────

    async def load_from_db(self, db: AsyncSession) -> None:
        """Recover system state from DB on startup."""
        # Check for active kill switch
        stmt = (
            select(LockoutEvent)
            .where(
                and_(
                    LockoutEvent.lockout_type == LockoutType.KILL_SWITCH,
                    LockoutEvent.is_active == True,  # noqa: E712
                )
            )
            .limit(1)
        )
        result = await db.execute(stmt)
        ks = result.scalar_one_or_none()
        if ks:
            self._kill_switch_active = True
            self._kill_switch_reason = ks.reason
            logger.warning("Kill switch recovered from DB: %s", ks.reason)

        # Check for active safe mode
        stmt = (
            select(LockoutEvent)
            .where(
                and_(
                    LockoutEvent.lockout_type == LockoutType.SAFE_MODE,
                    LockoutEvent.is_active == True,  # noqa: E712
                )
            )
            .limit(1)
        )
        result = await db.execute(stmt)
        sm = result.scalar_one_or_none()
        if sm:
            self._safe_mode_active = True
            self._safe_mode_reason = sm.reason
            logger.warning("Safe mode recovered from DB: %s", sm.reason)
