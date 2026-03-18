"""
Allocation router -- calculate and query profit allocations.
"""

from typing import List
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from core.auth import get_current_user
from models.models import User, TradingAccount, ProfitAllocation
from schemas.schemas import (
    AllocationRunRequest,
    ProfitAllocationRead,
)
from services.allocation_service import allocate_profit

router = APIRouter()


async def _get_active_account(
    db: AsyncSession, user_id: int
) -> TradingAccount:
    """Return the user's first active trading account or raise 400."""
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


# ── POST /run ────────────────────────────────────────────────────────────

@router.post(
    "/run",
    response_model=ProfitAllocationRead,
    status_code=status.HTTP_201_CREATED,
)
async def run_allocation(
    payload: AllocationRunRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Calculate profit allocation for a given period.

    Splits net profit into configurable buckets (e.g. reinvest,
    withdrawal, reserve) and persists the result.
    """

    account = await _get_active_account(db, current_user.id)

    if payload.start_date > payload.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be before or equal to end_date",
        )

    # Check for overlapping allocation
    existing = await db.execute(
        select(ProfitAllocation).where(
            and_(
                ProfitAllocation.account_id == account.id,
                ProfitAllocation.start_date <= payload.end_date,
                ProfitAllocation.end_date >= payload.start_date,
            )
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An allocation already exists for an overlapping period",
        )

    # Run allocation calculation
    try:
        allocation_data = await allocate_profit(
            db=db,
            account_id=account.id,
            start_date=payload.start_date,
            end_date=payload.end_date,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Allocation calculation failed: {str(exc)}",
        )

    allocation = ProfitAllocation(
        account_id=account.id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        gross_profit=allocation_data.get("gross_profit", 0.0),
        net_profit=allocation_data.get("net_profit", 0.0),
        reinvest_amount=allocation_data.get("reinvest_amount", 0.0),
        withdrawal_amount=allocation_data.get("withdrawal_amount", 0.0),
        reserve_amount=allocation_data.get("reserve_amount", 0.0),
        reinvest_pct=allocation_data.get("reinvest_pct", 0.0),
        withdrawal_pct=allocation_data.get("withdrawal_pct", 0.0),
        reserve_pct=allocation_data.get("reserve_pct", 0.0),
    )
    db.add(allocation)
    await db.flush()
    await db.refresh(allocation)

    return allocation


# ── GET /history ─────────────────────────────────────────────────────────

@router.get("/history", response_model=List[ProfitAllocationRead])
async def list_allocations(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List past profit allocations with pagination."""

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
        select(ProfitAllocation)
        .where(ProfitAllocation.account_id.in_(account_ids))
        .order_by(ProfitAllocation.end_date.desc())
        .offset(skip)
        .limit(limit)
    )
    allocations = result.scalars().all()

    return allocations
