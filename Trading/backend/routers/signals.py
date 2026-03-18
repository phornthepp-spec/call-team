"""
Signals router -- evaluate, list, approve, and reject trade signals.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from core.auth import get_current_user
from models.models import (
    User,
    TradingAccount,
    TradeSignal,
    RiskCheck,
    Order,
    Execution,
)
from schemas.schemas import (
    SignalEvaluateRequest,
    SignalEvaluateResponse,
    TradeSignalRead,
    OrderRead,
    RiskCheckRead,
)
from services.signal_service import evaluate_xauusd_signal
from services.risk_service import risk_check, calculate_lot_size, check_daily_lockout
from services.mt5_service import MT5Service

router = APIRouter()


# ── POST /evaluate ───────────────────────────────────────────────────────

@router.post("/evaluate", response_model=SignalEvaluateResponse)
async def evaluate_signal(
    payload: SignalEvaluateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Run the signal engine on XAUUSD, then run a risk check.
    Returns the signal together with the risk assessment.
    """

    # Verify user has an active trading account
    result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.user_id == current_user.id,
            TradingAccount.is_active.is_(True),
        )
    )
    account = result.scalars().first()
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active trading account found. Connect an MT5 account first.",
        )

    # Check daily lockout before evaluating
    is_locked = await check_daily_lockout(db=db, account_id=account.id)
    if is_locked:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Daily risk limit reached. Trading is locked for today.",
        )

    # Generate signal
    try:
        signal_data = await evaluate_xauusd_signal(
            account_id=account.id,
            timeframe=payload.timeframe,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Signal evaluation failed: {str(exc)}",
        )

    # Persist signal
    signal = TradeSignal(
        account_id=account.id,
        symbol="XAUUSD",
        direction=signal_data["direction"],
        entry_price=signal_data["entry_price"],
        stop_loss=signal_data["stop_loss"],
        take_profit=signal_data["take_profit"],
        timeframe=signal_data.get("timeframe", payload.timeframe),
        confidence=signal_data.get("confidence", 0.0),
        reason=signal_data.get("reason", ""),
        status="pending",
    )
    db.add(signal)
    await db.flush()
    await db.refresh(signal)

    # Run risk check
    try:
        risk_result = await risk_check(
            db=db,
            account_id=account.id,
            signal=signal,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Risk check failed: {str(exc)}",
        )

    # Persist risk check
    risk = RiskCheck(
        signal_id=signal.id,
        account_id=account.id,
        passed=risk_result["passed"],
        risk_reward_ratio=risk_result.get("risk_reward_ratio", 0.0),
        position_size=risk_result.get("position_size", 0.0),
        daily_loss_remaining=risk_result.get("daily_loss_remaining", 0.0),
        reason=risk_result.get("reason", ""),
    )
    db.add(risk)
    await db.flush()
    await db.refresh(risk)

    return SignalEvaluateResponse(
        signal=TradeSignalRead.model_validate(signal),
        risk_check=RiskCheckRead.model_validate(risk),
    )


# ── GET /latest ──────────────────────────────────────────────────────────

@router.get("/latest", response_model=List[TradeSignalRead])
async def get_latest_signals(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the latest pending signals for the current user's accounts."""

    # Get user's account IDs
    acct_result = await db.execute(
        select(TradingAccount.id).where(
            TradingAccount.user_id == current_user.id,
        )
    )
    account_ids = [row[0] for row in acct_result.all()]

    if not account_ids:
        return []

    result = await db.execute(
        select(TradeSignal)
        .where(
            and_(
                TradeSignal.account_id.in_(account_ids),
                TradeSignal.status == "pending",
            )
        )
        .order_by(TradeSignal.id.desc())
        .limit(limit)
    )
    signals = result.scalars().all()

    return signals


# ── POST /{id}/approve ───────────────────────────────────────────────────

@router.post("/{signal_id}/approve", response_model=OrderRead)
async def approve_signal(
    signal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Approve a pending signal: calculate lot size, place the order via MT5,
    and persist the execution result.
    """

    # Fetch signal and verify ownership
    result = await db.execute(
        select(TradeSignal).where(TradeSignal.id == signal_id)
    )
    signal = result.scalar_one_or_none()

    if signal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Signal not found",
        )

    # Verify ownership through account
    acct_result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == signal.account_id,
            TradingAccount.user_id == current_user.id,
        )
    )
    account = acct_result.scalar_one_or_none()
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this signal's trading account",
        )

    if signal.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Signal is already {signal.status}",
        )

    # Re-check daily lockout
    is_locked = await check_daily_lockout(db=db, account_id=account.id)
    if is_locked:
        signal.status = "rejected"
        await db.flush()
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Daily risk limit reached. Signal auto-rejected.",
        )

    # Calculate lot size
    try:
        lot_size = await calculate_lot_size(
            db=db,
            account_id=account.id,
            entry_price=signal.entry_price,
            stop_loss=signal.stop_loss,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lot size calculation failed: {str(exc)}",
        )

    # Place order on MT5
    mt5 = MT5Service()
    try:
        execution = await mt5.place_order(
            login=account.mt5_login,
            password=account.mt5_password,
            server=account.mt5_server,
            symbol="XAUUSD",
            direction=signal.direction,
            lot=lot_size,
            entry_price=signal.entry_price,
            stop_loss=signal.stop_loss,
            take_profit=signal.take_profit,
        )
    except Exception as exc:
        signal.status = "failed"
        await db.flush()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"MT5 order placement failed: {str(exc)}",
        )

    # Update signal status
    signal.status = "approved"

    # Persist order
    order = Order(
        account_id=account.id,
        signal_id=signal.id,
        ticket=execution["ticket"],
        symbol="XAUUSD",
        direction=signal.direction,
        lot=lot_size,
        entry_price=execution.get("price", signal.entry_price),
        stop_loss=signal.stop_loss,
        take_profit=signal.take_profit,
        status="open",
    )
    db.add(order)
    await db.flush()

    # Persist execution record
    exec_record = Execution(
        order_id=order.id,
        ticket=execution["ticket"],
        action="open",
        price=execution.get("price", signal.entry_price),
        lot=lot_size,
        comment=execution.get("comment", "Signal approved"),
    )
    db.add(exec_record)
    await db.flush()
    await db.refresh(order)

    return order


# ── POST /{id}/reject ───────────────────────────────────────────────────

@router.post("/{signal_id}/reject", response_model=TradeSignalRead)
async def reject_signal(
    signal_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reject a pending signal."""

    result = await db.execute(
        select(TradeSignal).where(TradeSignal.id == signal_id)
    )
    signal = result.scalar_one_or_none()

    if signal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Signal not found",
        )

    # Verify ownership through account
    acct_result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == signal.account_id,
            TradingAccount.user_id == current_user.id,
        )
    )
    if acct_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this signal's trading account",
        )

    if signal.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Signal is already {signal.status}",
        )

    signal.status = "rejected"
    await db.flush()
    await db.refresh(signal)

    return signal
