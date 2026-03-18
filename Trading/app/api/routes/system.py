"""
System status & health API endpoints.

- System health
- Audit log
- Alerts
- Reconciliation
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_mt5_service, get_system_state
from app.core.enums import AuditEventType
from app.models.audit import Alert, AuditLog
from app.services.audit_service import AuditService
from app.services.reconciliation_service import ReconciliationService
from app.services.system_state_service import SystemStateService

router = APIRouter(prefix="/system", tags=["system"])
_audit = AuditService()
_recon = ReconciliationService()


# ── System health ──────────────────────────────────────────────────

@router.get("/health")
async def get_system_health(
    system_state: SystemStateService = Depends(get_system_state),
    mt5_service=Depends(get_mt5_service),
) -> Dict[str, Any]:
    """Full system health snapshot."""
    state = system_state.get_system_state() if system_state else {}

    mt5_status = "OFFLINE"
    mt5_heartbeat = None
    if mt5_service:
        mt5_status = "CONNECTED" if mt5_service.connected else "DISCONNECTED"
        mt5_heartbeat = mt5_service.last_heartbeat

    return {
        **state,
        "mt5_status": mt5_status,
        "mt5_simulation_mode": mt5_service.simulation_mode if mt5_service else True,
        "mt5_last_heartbeat": mt5_heartbeat,
        "server_time": datetime.now(tz=timezone.utc).isoformat(),
    }


@router.get("/ping")
async def ping(mt5_service=Depends(get_mt5_service)):
    """Quick health check."""
    mt5_alive = False
    if mt5_service:
        mt5_alive = mt5_service.ping()
    return {"status": "ok", "mt5_alive": mt5_alive}


# ── Reconciliation ─────────────────────────────────────────────────

@router.post("/reconcile/{account_id}")
async def run_reconciliation(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    mt5_service=Depends(get_mt5_service),
) -> Dict[str, Any]:
    """Run position reconciliation between DB and MT5."""
    from app.models.order import Order
    from app.core.enums import OrderStatus

    if not mt5_service or not mt5_service.connected:
        raise HTTPException(status_code=503, detail="MT5 not connected")

    # Get DB open positions
    result = await db.execute(
        select(Order).where(
            Order.account_id == account_id,
            Order.status.in_([OrderStatus.FILLED, OrderStatus.PLACED]),
        )
    )
    db_orders = result.scalars().all()
    db_positions = [
        {"ticket": o.mt5_ticket, "status": o.status.value}
        for o in db_orders if o.mt5_ticket
    ]

    # Get MT5 positions
    mt5_positions = mt5_service.get_positions()

    recon = _recon.reconcile(db_positions, mt5_positions)

    # Log if mismatch
    if recon.has_mismatch:
        await _audit.log_event(
            db, AuditEventType.RECONCILIATION_MISMATCH,
            recon.message, account_id=account_id,
            details={
                "db_only": recon.db_only_tickets,
                "mt5_only": recon.mt5_only_tickets,
                "matched": recon.matched_tickets,
            },
        )
        await db.commit()

    return {
        "is_clean": recon.is_clean,
        "message": recon.message,
        "db_only_tickets": recon.db_only_tickets,
        "mt5_only_tickets": recon.mt5_only_tickets,
        "matched_count": len(recon.matched_tickets),
        "details": recon.mismatched_details,
    }


# ── Audit log ──────────────────────────────────────────────────────

@router.get("/audit/{account_id}")
async def get_audit_log(
    account_id: int,
    event_type: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Get recent audit log entries."""
    et = None
    if event_type:
        try:
            et = AuditEventType(event_type)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown event type: {event_type}")

    entries = await _audit.get_recent_events(
        db, account_id=account_id, event_type=et, limit=min(limit, 200),
    )
    return [
        {
            "id": e.id,
            "event_type": e.event_type.value,
            "summary": e.summary,
            "details": e.details,
            "signal_id": e.signal_id,
            "order_id": e.order_id,
            "created_at": e.created_at.isoformat(),
        }
        for e in entries
    ]


# ── Alerts ─────────────────────────────────────────────────────────

@router.get("/alerts")
async def get_alerts(
    account_id: Optional[int] = None,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Get unacknowledged alerts."""
    alerts = await _audit.get_unacknowledged_alerts(
        db, account_id=account_id, limit=limit,
    )
    return [
        {
            "id": a.id,
            "severity": a.severity.value,
            "title": a.title,
            "message": a.message,
            "source": a.source,
            "created_at": a.created_at.isoformat(),
        }
        for a in alerts
    ]


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Acknowledge an alert."""
    ok = await _audit.acknowledge_alert(db, alert_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Alert not found")
    await db.commit()
    return {"status": "acknowledged", "alert_id": alert_id}
