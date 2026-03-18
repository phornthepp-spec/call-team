"""
Order & Signal API endpoints.

- Signal creation
- Order placement (with risk check)
- Position management
- Order history
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import AppSettings
from app.core.dependencies import get_config, get_db, get_mt5_service, get_system_state
from app.core.enums import (
    AuditEventType, OrderStatus, OrderType, SignalSide, SignalStatus,
)
from app.models.order import Execution, Order, TradeSignal
from app.schemas.order import (
    ExecutionResponse,
    OpenPositionResponse,
    OrderCloseRequest,
    OrderHistoryResponse,
    OrderPlaceRequest,
    OrderResponse,
    SignalCreateRequest,
    SignalResponse,
)
from app.services.audit_service import AuditService
from app.services.system_state_service import SystemStateService

router = APIRouter(prefix="/orders", tags=["orders"])
_audit = AuditService()


# ── Signal CRUD ────────────────────────────────────────────────────

@router.post("/signals", response_model=SignalResponse, status_code=201)
async def create_signal(
    req: SignalCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create a new trade signal (manual or from strategy)."""
    sl_dist = abs(req.entry_price - req.stop_loss)
    tp_dist = abs(req.take_profit - req.entry_price)
    rr = round(tp_dist / sl_dist, 2) if sl_dist > 0 else 0.0

    # Fingerprint for dedup
    fp_raw = f"{req.direction}|{req.entry_price}|{req.stop_loss}|{req.take_profit}|{req.timeframe}"
    fingerprint = hashlib.sha256(fp_raw.encode()).hexdigest()[:16]

    signal = TradeSignal(
        account_id=req.account_id,
        symbol=req.symbol,
        direction=SignalSide(req.direction.upper()),
        entry_price=Decimal(str(req.entry_price)),
        stop_loss=Decimal(str(req.stop_loss)),
        take_profit=Decimal(str(req.take_profit)),
        risk_reward_ratio=Decimal(str(rr)),
        strategy_name=req.strategy_name,
        timeframe=req.timeframe,
        confidence=req.confidence,
        confirmation_count=req.confirmation_count,
        notes=req.notes,
        signal_fingerprint=fingerprint,
        status=SignalStatus.PENDING,
    )
    db.add(signal)
    await db.flush()

    await _audit.log_event(
        db, AuditEventType.SIGNAL_GENERATED,
        f"Signal: {req.direction} {req.symbol} @ {req.entry_price} RR={rr}",
        account_id=req.account_id, signal_id=signal.id,
    )
    await db.commit()
    await db.refresh(signal)
    return signal


@router.get("/signals/latest/{account_id}", response_model=List[SignalResponse])
async def get_latest_signals(
    account_id: int,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TradeSignal)
        .where(TradeSignal.account_id == account_id)
        .order_by(desc(TradeSignal.created_at))
        .limit(min(limit, 50))
    )
    return result.scalars().all()


# ── Order placement ────────────────────────────────────────────────

@router.post("/place", response_model=OrderResponse, status_code=201)
async def place_order(
    req: OrderPlaceRequest,
    db: AsyncSession = Depends(get_db),
    cfg: AppSettings = Depends(get_config),
    system_state: SystemStateService = Depends(get_system_state),
    mt5_service=Depends(get_mt5_service),
):
    """Place an order via MT5 (post risk check)."""
    # Kill switch gate
    if system_state and system_state.kill_switch_active:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Kill switch active — order blocked.",
        )

    if not mt5_service or not mt5_service.connected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MT5 not connected.",
        )

    now = datetime.now(tz=timezone.utc)
    comment = req.comment or f"{cfg.COMMENT_PREFIX}|{now.strftime('%H%M%S')}"

    # Create order record
    order = Order(
        account_id=req.account_id,
        signal_id=req.signal_id,
        symbol=req.symbol,
        order_type=OrderType.MARKET,
        direction=SignalSide(req.direction.upper()),
        lot_size=Decimal(str(req.lot_size)),
        entry_price=Decimal(str(req.entry_price)),
        stop_loss=Decimal(str(req.stop_loss)),
        take_profit=Decimal(str(req.take_profit)),
        magic_number=req.magic_number,
        comment=comment,
        deviation_points=req.deviation_points,
        risk_check_run_id=req.risk_check_run_id,
        status=OrderStatus.PENDING,
    )
    db.add(order)
    await db.flush()

    # Send to MT5
    try:
        mt5_result = mt5_service.place_order(
            symbol=req.symbol,
            side=req.direction.upper(),
            volume=req.lot_size,
            price=req.entry_price,
            sl=req.stop_loss,
            tp=req.take_profit,
            magic=req.magic_number,
            comment=comment,
            deviation=req.deviation_points,
        )
    except Exception as e:
        order.status = OrderStatus.REJECTED
        order.error_message = str(e)
        await db.commit()
        raise HTTPException(status_code=502, detail=f"MT5 order failed: {e}")

    if mt5_result.get("success"):
        order.mt5_ticket = mt5_result.get("ticket")
        order.status = OrderStatus.FILLED
        order.entry_price = Decimal(str(mt5_result.get("price", req.entry_price)))
        order.slippage_points = mt5_result.get("slippage", 0)
        order.placed_at = now
        order.filled_at = now

        # Update signal status if linked
        if req.signal_id:
            sig_result = await db.execute(
                select(TradeSignal).where(TradeSignal.id == req.signal_id)
            )
            sig = sig_result.scalar_one_or_none()
            if sig:
                sig.status = SignalStatus.EXECUTED
                sig.approved_at = now

        # Create execution record
        execution = Execution(
            order_id=order.id,
            fill_price=order.entry_price,
            fill_lot_size=order.lot_size,
            commission=Decimal("0"),
            swap=Decimal("0"),
            profit=Decimal("0"),
            slippage_points=order.slippage_points,
            opened_at=now,
        )
        db.add(execution)

        await _audit.log_order_event(
            db, AuditEventType.ORDER_FILLED, req.account_id, order.id,
            order.mt5_ticket or 0,
            {"price": float(order.entry_price), "lot": float(order.lot_size),
             "slippage": order.slippage_points},
        )
    else:
        order.status = OrderStatus.REJECTED
        order.error_message = mt5_result.get("comment", "Unknown error")
        await _audit.log_order_event(
            db, AuditEventType.ORDER_REJECTED, req.account_id, order.id, 0,
            {"retcode": mt5_result.get("retcode"), "comment": mt5_result.get("comment")},
        )

    await db.commit()
    await db.refresh(order)
    return order


# ── Close position ─────────────────────────────────────────────────

@router.post("/close/{order_id}", response_model=OrderResponse)
async def close_order(
    order_id: int,
    req: OrderCloseRequest,
    db: AsyncSession = Depends(get_db),
    mt5_service=Depends(get_mt5_service),
):
    """Close an open position by order ID."""
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status not in (OrderStatus.FILLED, OrderStatus.PLACED):
        raise HTTPException(status_code=400, detail=f"Order not closeable (status={order.status.value})")

    if not order.mt5_ticket:
        raise HTTPException(status_code=400, detail="No MT5 ticket linked")

    if not mt5_service or not mt5_service.connected:
        raise HTTPException(status_code=503, detail="MT5 not connected")

    try:
        close_result = mt5_service.close_position(order.mt5_ticket)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"MT5 close failed: {e}")

    now = datetime.now(tz=timezone.utc)
    if close_result.get("success"):
        order.status = OrderStatus.CLOSED
        order.close_price = Decimal(str(close_result.get("price", 0)))
        order.close_reason = req.reason
        order.closed_at = now

        await _audit.log_order_event(
            db, AuditEventType.ORDER_CLOSED, order.account_id, order.id,
            order.mt5_ticket,
            {"close_price": float(order.close_price), "reason": req.reason},
        )
    else:
        raise HTTPException(
            status_code=502,
            detail=f"Close failed: {close_result.get('comment', 'Unknown')}",
        )

    await db.commit()
    await db.refresh(order)
    return order


# ── Live positions from MT5 ───────────────────────────────────────

@router.get("/positions", response_model=List[OpenPositionResponse])
async def get_open_positions(
    symbol: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    mt5_service=Depends(get_mt5_service),
):
    """Get live open positions from MT5."""
    if not mt5_service or not mt5_service.connected:
        return []

    mt5_positions = mt5_service.get_positions(symbol=symbol)

    # Check which tickets exist in DB
    tickets = [p["ticket"] for p in mt5_positions]
    db_tickets = set()
    if tickets:
        result = await db.execute(
            select(Order.mt5_ticket).where(Order.mt5_ticket.in_(tickets))
        )
        db_tickets = {row[0] for row in result.all()}

    return [
        OpenPositionResponse(
            ticket=p["ticket"],
            symbol=p["symbol"],
            side=p["side"],
            volume=p["volume"],
            price_open=p["price_open"],
            current_price=p.get("current_price", 0),
            sl=p["sl"],
            tp=p["tp"],
            floating_pl=p.get("floating_pl", 0),
            magic=p.get("magic", 0),
            comment=p.get("comment", ""),
            time_open=p.get("time_open"),
            in_db=p["ticket"] in db_tickets,
        )
        for p in mt5_positions
    ]


# ── Order history ──────────────────────────────────────────────────

@router.get("/history/{account_id}", response_model=OrderHistoryResponse)
async def get_order_history(
    account_id: int,
    page: int = 1,
    per_page: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Get paginated order history."""
    per_page = min(per_page, 100)
    offset = (page - 1) * per_page

    # Count total
    count_result = await db.execute(
        select(func.count(Order.id)).where(Order.account_id == account_id)
    )
    total = count_result.scalar() or 0

    # Fetch page
    result = await db.execute(
        select(Order)
        .where(Order.account_id == account_id)
        .order_by(desc(Order.created_at))
        .offset(offset)
        .limit(per_page)
    )
    orders = result.scalars().all()

    return OrderHistoryResponse(
        orders=[OrderResponse.model_validate(o) for o in orders],
        total=total,
        page=page,
        per_page=per_page,
    )
