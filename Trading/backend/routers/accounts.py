"""
Accounts router -- connect MT5 accounts, fetch snapshots, list accounts.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from core.auth import get_current_user
from models.models import User, TradingAccount, AccountSnapshot
from schemas.schemas import (
    TradingAccountCreate,
    TradingAccountRead,
    AccountSnapshotRead,
)
from services.mt5_service import MT5Service

router = APIRouter()


# ── POST /connect-mt5 ───────────────────────────────────────────────────

@router.post(
    "/connect-mt5",
    response_model=TradingAccountRead,
    status_code=status.HTTP_201_CREATED,
)
async def connect_mt5(
    payload: TradingAccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save MT5 account credentials and verify the connection."""

    mt5 = MT5Service()

    # Test connection before saving
    try:
        connected = await mt5.test_connection(
            login=payload.mt5_login,
            password=payload.mt5_password,
            server=payload.mt5_server,
        )
        if not connected:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not connect to MT5 with the provided credentials",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"MT5 connection error: {str(exc)}",
        )

    # Check if this MT5 login is already linked
    existing = await db.execute(
        select(TradingAccount).where(
            TradingAccount.user_id == current_user.id,
            TradingAccount.mt5_login == payload.mt5_login,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This MT5 account is already connected",
        )

    account = TradingAccount(
        user_id=current_user.id,
        mt5_login=payload.mt5_login,
        mt5_password=payload.mt5_password,
        mt5_server=payload.mt5_server,
        account_name=payload.account_name,
        is_active=True,
    )
    db.add(account)
    await db.flush()
    await db.refresh(account)

    return account


# ── GET /{id}/snapshot ───────────────────────────────────────────────────

@router.get("/{account_id}/snapshot", response_model=AccountSnapshotRead)
async def get_account_snapshot(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch current balance, equity, margin, and free margin from MT5."""

    result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == account_id,
            TradingAccount.user_id == current_user.id,
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trading account not found",
        )

    mt5 = MT5Service()
    try:
        info = await mt5.get_account_info(
            login=account.mt5_login,
            password=account.mt5_password,
            server=account.mt5_server,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch account info from MT5: {str(exc)}",
        )

    # Persist snapshot
    snapshot = AccountSnapshot(
        account_id=account.id,
        balance=info["balance"],
        equity=info["equity"],
        margin=info.get("margin", 0.0),
        free_margin=info.get("free_margin", 0.0),
        margin_level=info.get("margin_level", 0.0),
    )
    db.add(snapshot)
    await db.flush()
    await db.refresh(snapshot)

    return snapshot


# ── GET /me ──────────────────────────────────────────────────────────────

@router.get("/me", response_model=List[TradingAccountRead])
async def list_my_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all trading accounts belonging to the authenticated user."""

    result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.user_id == current_user.id,
        ).order_by(TradingAccount.id)
    )
    accounts = result.scalars().all()

    return accounts
