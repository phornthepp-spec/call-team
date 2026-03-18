"""
Orders router -- open positions, order history, close individual or all positions.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from core.auth import get_current_user
from models.models import User, TradingAccount, Order, Execution
from schemas.schemas import OrderRead, OrderCloseResponse, BulkCloseResponse
from services.mt5_service import MT5Service

router = APIRouter()


async def _get_active_account(
    db: AsyncSession, user_id: int
) -> TradingAccount:
    """Helper: return the user's first active trading account or raise 400."""
    result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.user_id == user_id,
            TradingAccount.is_active.is_(True),
        )
    )
    account = result.scalars().first()
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active trading account found",
        )
    return account


# ── GET /open ────────────────────────────────────────────────────────────

@router.get("/open", response_model=List[OrderRead])
async def list_open_positions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all currently open positions from MT5 and sync with database."""

    account = await _get_active_account(db, current_user.id)
    mt5 = MT5Service()

    try:
        positions = await mt5.get_open_positions(
            login=account.mt5_login,
            password=account.mt5_password,
            server=account.mt5_server,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch open positions from MT5: {str(exc)}",
        )

    # Sync MT5 positions with our database
    open_orders: List[Order] = []
    for pos in positions:
        result = await db.execute(
            select(Order).where(
                Order.account_id == account.id,
                Order.ticket == pos["ticket"],
            )
        )
        order = result.scalar_one_or_none()

        if order is None:
            # External order -- track it
            order = Order(
                account_id=account.id,
                ticket=pos["ticket"],
                symbol=pos.get("symbol", "XAUUSD"),
                direction=pos.get("type", "buy"),
                lot=pos.get("volume", 0.0),
                entry_price=pos.get("price_open", 0.0),
                stop_loss=pos.get("sl", 0.0),
                take_profit=pos.get("tp", 0.0),
                status="open",
                current_price=pos.get("price_current"),
                profit=pos.get("profit"),
            )
            db.add(order)
        else:
            # Update live data
            order.current_price = pos.get("price_current", order.current_price)
            order.profit = pos.get("profit", order.profit)
            order.status = "open"

        open_orders.append(order)

    await db.flush()
    for o in open_orders:
        await db.refresh(o)

    return open_orders


# ── GET /history ─────────────────────────────────────────────────────────

@router.get("/history", response_model=List[OrderRead])
async def list_order_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List closed orders from the database with pagination."""

    # Get all user account IDs
    acct_result = await db.execute(
        select(TradingAccount.id).where(
            TradingAccount.user_id == current_user.id,
        )
    )
    account_ids = [row[0] for row in acct_result.all()]

    if not account_ids:
        return []

    result = await db.execute(
        select(Order)
        .where(
            and_(
                Order.account_id.in_(account_ids),
                Order.status == "closed",
            )
        )
        .order_by(Order.id.desc())
        .offset(skip)
        .limit(limit)
    )
    orders = result.scalars().all()

    return orders


# ── POST /close/{ticket} ────────────────────────────────────────────────

@router.post("/close/{ticket}", response_model=OrderCloseResponse)
async def close_position(
    ticket: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Close a single open position by its MT5 ticket number."""

    account = await _get_active_account(db, current_user.id)

    # Find the order in our DB
    result = await db.execute(
        select(Order).where(
            Order.account_id == account.id,
            Order.ticket == ticket,
        )
    )
    order = result.scalar_one_or_none()

    mt5 = MT5Service()

    try:
        close_result = await mt5.close_position(
            login=account.mt5_login,
            password=account.mt5_password,
            server=account.mt5_server,
            ticket=ticket,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to close position on MT5: {str(exc)}",
        )

    if not close_result.get("success", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=close_result.get("message", "Close order failed"),
        )

    # Update database
    if order is not None:
        order.status = "closed"
        order.close_price = close_result.get("price", 0.0)
        order.profit = close_result.get("profit", order.profit)

        exec_record = Execution(
            order_id=order.id,
            ticket=ticket,
            action="close",
            price=close_result.get("price", 0.0),
            lot=order.lot,
            comment="Manual close",
        )
        db.add(exec_record)
        await db.flush()
        await db.refresh(order)

    return OrderCloseResponse(
        ticket=ticket,
        success=True,
        close_price=close_result.get("price", 0.0),
        profit=close_result.get("profit", 0.0),
        message="Position closed successfully",
    )


# ── POST /close-all ─────────────────────────────────────────────────────

@router.post("/close-all", response_model=BulkCloseResponse)
async def close_all_positions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Emergency close: close ALL open positions on the user's active account.
    """

    account = await _get_active_account(db, current_user.id)
    mt5 = MT5Service()

    try:
        positions = await mt5.get_open_positions(
            login=account.mt5_login,
            password=account.mt5_password,
            server=account.mt5_server,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch open positions: {str(exc)}",
        )

    if not positions:
        return BulkCloseResponse(
            total=0,
            closed=0,
            failed=0,
            results=[],
            message="No open positions to close",
        )

    results = []
    closed_count = 0
    failed_count = 0

    for pos in positions:
        ticket = pos["ticket"]
        try:
            close_result = await mt5.close_position(
                login=account.mt5_login,
                password=account.mt5_password,
                server=account.mt5_server,
                ticket=ticket,
            )
            success = close_result.get("success", False)
        except Exception:
            success = False
            close_result = {}

        if success:
            closed_count += 1

            # Update order in DB
            order_result = await db.execute(
                select(Order).where(
                    Order.account_id == account.id,
                    Order.ticket == ticket,
                )
            )
            order = order_result.scalar_one_or_none()
            if order is not None:
                order.status = "closed"
                order.close_price = close_result.get("price", 0.0)
                order.profit = close_result.get("profit", order.profit)

                exec_record = Execution(
                    order_id=order.id,
                    ticket=ticket,
                    action="close",
                    price=close_result.get("price", 0.0),
                    lot=order.lot,
                    comment="Emergency close-all",
                )
                db.add(exec_record)
        else:
            failed_count += 1

        results.append({
            "ticket": ticket,
            "success": success,
            "profit": close_result.get("profit", 0.0),
        })

    await db.flush()

    return BulkCloseResponse(
        total=len(positions),
        closed=closed_count,
        failed=failed_count,
        results=results,
        message=f"Closed {closed_count}/{len(positions)} positions",
    )
