"""
Risk evaluation & status API endpoints.

- Pre-trade risk check
- Risk status dashboard
- Kill switch / safe mode controls
- Lockout management
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import AppSettings
from app.core.dependencies import get_config, get_db, get_mt5_service, get_system_state
from app.core.enums import (
    FinalDecision, GuardStatus, LockoutType, PolicyMode,
)
from app.models.account import DailyRiskStats, LockoutEvent, TradingAccount
from app.models.risk import RiskCheckRun, RiskGuardResult
from app.schemas.risk import (
    GuardResultSchema,
    LockoutListResponse,
    LockoutResponse,
    PreTradeCheckRequest,
    RiskCheckResponse,
    RiskStatusResponse,
)
from app.services.system_state_service import SystemStateService

router = APIRouter(prefix="/risk", tags=["risk"])


# ── Pre-trade risk check ───────────────────────────────────────────

@router.post("/check", response_model=RiskCheckResponse)
async def run_pre_trade_check(
    req: PreTradeCheckRequest,
    db: AsyncSession = Depends(get_db),
    cfg: AppSettings = Depends(get_config),
    system_state: SystemStateService = Depends(get_system_state),
    mt5_service=Depends(get_mt5_service),
):
    """Run a full pre-trade risk evaluation against all guards."""
    from app.engine.risk_engine import RiskEngine

    # Quick kill-switch gate
    if system_state and system_state.kill_switch_active:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Kill switch is active — all trading blocked.",
        )

    # Verify account exists
    result = await db.execute(
        select(TradingAccount).where(TradingAccount.id == req.account_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    engine = RiskEngine(cfg=cfg)
    risk_result = engine.evaluate(
        signal_side=req.signal_side,
        entry_price=req.entry_price,
        stop_loss=req.stop_loss,
        take_profit=req.take_profit,
        confidence=req.confidence,
        confirmation_count=req.confirmation_count,
        rr_ratio=req.rr_ratio,
        strategy_name=req.strategy_name,
        timeframe=req.timeframe,
        regime_expectation=req.regime_expectation,
        account_info=mt5_service.get_account_info() if mt5_service else {},
        mt5_connected=mt5_service.connected if mt5_service else False,
        safe_mode_active=system_state.safe_mode_active if system_state else False,
        kill_switch_active=system_state.kill_switch_active if system_state else False,
    )

    # Persist to DB
    run = RiskCheckRun(
        account_id=req.account_id,
        policy_mode=PolicyMode(risk_result["policy_mode"]),
        final_decision=FinalDecision(risk_result["decision"]),
        decision_reason=risk_result.get("decision_reason"),
        total_guards=risk_result["total_guards"],
        pass_count=risk_result["pass_count"],
        warn_count=risk_result["warn_count"],
        block_count=risk_result["block_count"],
        requested_lot=risk_result.get("requested_lot"),
        approved_lot=risk_result.get("final_lot"),
        lot_reduction_reason=risk_result.get("lot_reduction_reason"),
        execution_time_ms=risk_result.get("execution_time_ms"),
        account_snapshot=risk_result.get("account_snapshot", {}),
        market_snapshot=risk_result.get("market_snapshot", {}),
    )
    db.add(run)
    await db.flush()

    # Persist individual guard results
    for gr in risk_result.get("guard_results", []):
        db.add(RiskGuardResult(
            risk_check_run_id=run.id,
            guard_name=gr["guard_name"],
            category=gr["category"],
            status=GuardStatus(gr["status"]),
            severity=gr["severity"],
            current_value=gr.get("current_value"),
            threshold=gr.get("threshold"),
            reason=gr.get("reason"),
            action=gr.get("action"),
            lockout_impact=gr.get("lockout_impact"),
            safe_mode_impact=gr.get("safe_mode_impact"),
            metadata_json=gr.get("metadata", {}),
        ))

    await db.commit()

    guard_schemas = [
        GuardResultSchema(**gr) for gr in risk_result.get("guard_results", [])
    ]

    return RiskCheckResponse(
        run_id=run.id,
        policy_mode=PolicyMode(risk_result["policy_mode"]),
        final_decision=FinalDecision(risk_result["decision"]),
        decision_reason=risk_result.get("decision_reason"),
        total_guards=risk_result["total_guards"],
        pass_count=risk_result["pass_count"],
        warn_count=risk_result["warn_count"],
        block_count=risk_result["block_count"],
        requested_lot=risk_result.get("requested_lot"),
        approved_lot=risk_result.get("final_lot"),
        lot_reduction_reason=risk_result.get("lot_reduction_reason"),
        guard_results=guard_schemas,
        execution_time_ms=risk_result.get("execution_time_ms"),
        checked_at=run.checked_at,
    )


# ── Risk status (dashboard) ───────────────────────────────────────

@router.get("/status/{account_id}", response_model=RiskStatusResponse)
async def get_risk_status(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    cfg: AppSettings = Depends(get_config),
    system_state: SystemStateService = Depends(get_system_state),
    mt5_service=Depends(get_mt5_service),
):
    """Get current risk status for the dashboard."""
    from datetime import date as date_type

    today = date_type.today()

    # Daily stats
    result = await db.execute(
        select(DailyRiskStats).where(
            and_(
                DailyRiskStats.account_id == account_id,
                DailyRiskStats.stat_date == today,
            )
        )
    )
    daily = result.scalar_one_or_none()

    # Active lockouts
    lockout_result = await db.execute(
        select(LockoutEvent).where(
            and_(
                LockoutEvent.account_id == account_id,
                LockoutEvent.is_active == True,  # noqa: E712
            )
        )
    )
    lockouts = lockout_result.scalars().all()

    # Account info from MT5
    account_info = {}
    mt5_connected = False
    if mt5_service:
        try:
            mt5_connected = mt5_service.connected
            if mt5_connected:
                account_info = mt5_service.get_account_info()
        except Exception:
            pass

    balance = account_info.get("balance", 0)
    daily_loss_pct = 0.0
    if daily and balance > 0:
        daily_loss_pct = abs(float(daily.realized_pnl)) / balance * 100 if float(daily.realized_pnl) < 0 else 0.0

    return RiskStatusResponse(
        policy_mode=PolicyMode(cfg.POLICY_MODE),
        kill_switch_active=system_state.kill_switch_active if system_state else False,
        safe_mode_active=system_state.safe_mode_active if system_state else False,
        daily_loss_pct=round(daily_loss_pct, 2),
        daily_loss_limit_pct=cfg.DAILY_LOSS_LIMIT_PCT,
        daily_trades_taken=daily.trades_taken if daily else 0,
        daily_max_trades=cfg.MAX_TRADES_PER_DAY,
        daily_locked=daily.is_locked if daily else False,
        daily_consecutive_losses=daily.consecutive_losses if daily else 0,
        open_positions_count=account_info.get("open_positions", 0),
        max_simultaneous_positions=cfg.MAX_SIMULTANEOUS_POSITIONS,
        margin_level=account_info.get("margin_level", 0),
        free_margin_pct=(
            (account_info.get("free_margin", 0) / balance * 100)
            if balance > 0 else 0.0
        ),
        mt5_connected=mt5_connected,
        active_lockouts=[lo.lockout_type.value for lo in lockouts],
    )


# ── Kill switch ────────────────────────────────────────────────────

@router.post("/kill-switch/activate")
async def activate_kill_switch(
    reason: str = "Manual activation",
    account_id: int = 0,
    db: AsyncSession = Depends(get_db),
    system_state: SystemStateService = Depends(get_system_state),
):
    """Activate kill switch — immediately stops all trading."""
    if not system_state:
        raise HTTPException(status_code=503, detail="System state service unavailable")
    await system_state.activate_kill_switch(db, reason, account_id=account_id)
    return {"status": "kill_switch_activated", "reason": reason}


@router.post("/kill-switch/deactivate")
async def deactivate_kill_switch(
    account_id: int = 0,
    db: AsyncSession = Depends(get_db),
    system_state: SystemStateService = Depends(get_system_state),
):
    """Deactivate kill switch — resume trading."""
    if not system_state:
        raise HTTPException(status_code=503, detail="System state service unavailable")
    await system_state.deactivate_kill_switch(db, account_id=account_id)
    return {"status": "kill_switch_deactivated"}


# ── Safe mode ──────────────────────────────────────────────────────

@router.post("/safe-mode/activate")
async def activate_safe_mode(
    reason: str = "Manual activation",
    account_id: int = 0,
    db: AsyncSession = Depends(get_db),
    system_state: SystemStateService = Depends(get_system_state),
):
    if not system_state:
        raise HTTPException(status_code=503, detail="System state service unavailable")
    await system_state.activate_safe_mode(db, reason, account_id=account_id)
    return {"status": "safe_mode_activated", "reason": reason}


@router.post("/safe-mode/deactivate")
async def deactivate_safe_mode(
    account_id: int = 0,
    db: AsyncSession = Depends(get_db),
    system_state: SystemStateService = Depends(get_system_state),
):
    if not system_state:
        raise HTTPException(status_code=503, detail="System state service unavailable")
    await system_state.deactivate_safe_mode(db, account_id=account_id)
    return {"status": "safe_mode_deactivated"}


# ── Lockouts ───────────────────────────────────────────────────────

@router.get("/lockouts/{account_id}", response_model=LockoutListResponse)
async def get_active_lockouts(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    system_state: SystemStateService = Depends(get_system_state),
):
    """Get all active lockouts for an account."""
    if not system_state:
        return LockoutListResponse(lockouts=[], any_active=False)

    lockouts = await system_state.get_active_lockouts(db, account_id)
    return LockoutListResponse(
        lockouts=[
            LockoutResponse(
                lockout_type=lo.lockout_type.value,
                trigger=lo.trigger.value,
                is_active=lo.is_active,
                activated_at=lo.activated_at,
                expires_at=lo.expires_at,
                reason=lo.reason,
            )
            for lo in lockouts
        ],
        any_active=len(lockouts) > 0,
    )


@router.post("/lockouts/{account_id}/clear/{lockout_type}")
async def clear_lockout(
    account_id: int,
    lockout_type: str,
    db: AsyncSession = Depends(get_db),
    system_state: SystemStateService = Depends(get_system_state),
):
    """Manually clear a specific lockout type."""
    if not system_state:
        raise HTTPException(status_code=503, detail="System state service unavailable")

    try:
        lt = LockoutType(lockout_type.upper())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown lockout type: {lockout_type}")

    cleared = await system_state.clear_lockout(db, account_id, lt)
    await db.commit()
    return {"cleared": cleared, "lockout_type": lockout_type}


# ── Risk check history ─────────────────────────────────────────────

@router.get("/history/{account_id}")
async def get_risk_check_history(
    account_id: int,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """Get recent risk check runs."""
    result = await db.execute(
        select(RiskCheckRun)
        .where(RiskCheckRun.account_id == account_id)
        .order_by(desc(RiskCheckRun.checked_at))
        .limit(min(limit, 100))
    )
    runs = result.scalars().all()

    return [
        {
            "id": r.id,
            "policy_mode": r.policy_mode.value,
            "final_decision": r.final_decision.value,
            "decision_reason": r.decision_reason,
            "total_guards": r.total_guards,
            "pass_count": r.pass_count,
            "warn_count": r.warn_count,
            "block_count": r.block_count,
            "approved_lot": r.approved_lot,
            "execution_time_ms": r.execution_time_ms,
            "checked_at": r.checked_at.isoformat(),
        }
        for r in runs
    ]
