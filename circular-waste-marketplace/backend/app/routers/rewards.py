"""Rewards router — /api/v1/rewards/... (Segment 3.3b)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import TokenPayload, require_role
from app.db.session import get_async_session
from app.schemas.rewards_schemas import (
    AdminAdjustRequest,
    EcoOrderListResponse,
    EcoOrderRead,
    EcoProductRead,
    LeaderboardEntry,
    LeaderboardResponse,
    ProductListResponse,
    RedeemRequest,
    RewardTransactionRead,
    TransactionListResponse,
    WalletRead,
)
from app.services import leaderboard_service, rewards_service

router = APIRouter(prefix="/rewards", tags=["Rewards"])

_ANY_AUTHED = ["GENERATOR", "RECYCLER", "LOGISTICS", "ADMIN"]


@router.get("/wallet", response_model=WalletRead)
async def get_wallet(
    token: TokenPayload = Depends(require_role(_ANY_AUTHED)),
    db: AsyncSession = Depends(get_async_session),
) -> WalletRead:
    """Retrieve (or auto-create) current user's reward wallet balance."""
    wallet = await rewards_service.get_or_create_wallet(token.sub, db)
    return WalletRead.model_validate(wallet)


@router.get("/transactions", response_model=TransactionListResponse)
async def list_transactions(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    token: TokenPayload = Depends(require_role(_ANY_AUTHED)),
    db: AsyncSession = Depends(get_async_session),
) -> TransactionListResponse:
    """Return paginated reward transaction ledger for the authenticated user."""
    items, total = await rewards_service.list_transactions(
        token.sub, db, limit=limit, offset=offset
    )
    return TransactionListResponse(
        items=[RewardTransactionRead.model_validate(tx) for tx in items],
        total=total,
    )


@router.get("/products", response_model=ProductListResponse)
async def list_products(
    token: TokenPayload = Depends(require_role(_ANY_AUTHED)),
    db: AsyncSession = Depends(get_async_session),
) -> ProductListResponse:
    """Return active voucher catalog."""
    items, total = await rewards_service.list_products(db)
    return ProductListResponse(
        items=[EcoProductRead.model_validate(p) for p in items],
        total=total,
    )


@router.post("/redeem", response_model=EcoOrderRead)
async def redeem_voucher(
    payload: RedeemRequest,
    request: Request,
    token: TokenPayload = Depends(require_role(_ANY_AUTHED)),
    db: AsyncSession = Depends(get_async_session),
) -> EcoOrderRead:
    """Redeem an eco-product voucher using reward points."""
    req_id = request.headers.get("X-Request-ID")
    order = await rewards_service.redeem_voucher(
        token.sub, payload.product_id, db, request_id=req_id
    )
    return EcoOrderRead.model_validate(order)


@router.get("/orders", response_model=EcoOrderListResponse)
async def list_orders(
    token: TokenPayload = Depends(require_role(_ANY_AUTHED)),
    db: AsyncSession = Depends(get_async_session),
) -> EcoOrderListResponse:
    """Return the authenticated user's redeemed voucher orders."""
    items, total = await rewards_service.list_user_orders(token.sub, db)
    return EcoOrderListResponse(
        items=[EcoOrderRead.model_validate(o) for o in items],
        total=total,
    )


@router.get("/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    period: str = Query("week", pattern="^(week|month|all_time)$"),
    token: TokenPayload = Depends(require_role(_ANY_AUTHED)),
    db: AsyncSession = Depends(get_async_session),
) -> LeaderboardResponse:
    """Return top 20 rewards leaderboard with PII masked."""
    entries_raw = await leaderboard_service.get_leaderboard(period=period, session=db)
    return LeaderboardResponse(
        period=period,
        entries=[LeaderboardEntry(**e) for e in entries_raw],
    )


@router.post("/admin/adjust", response_model=RewardTransactionRead)
async def admin_adjust(
    payload: AdminAdjustRequest,
    request: Request,
    token: TokenPayload = Depends(require_role(["ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> RewardTransactionRead:
    """Manual admin adjustment of user reward points."""
    req_id = request.headers.get("X-Request-ID")
    tx = await rewards_service.award_points(
        user_id=payload.user_id,
        points=payload.points,
        transaction_type="admin_adjust",
        description=payload.reason,
        session=db,
        reference_type="manual",
        reference_id=None,
        metadata={"adjusted_by": str(token.sub)},
        request_id=req_id,
    )
    return RewardTransactionRead.model_validate(tx)
