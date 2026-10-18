"""Rewards router — /api/v1/rewards/..."""
from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import require_role, TokenPayload
from app.db.session import get_async_session
from app.schemas import RewardWalletResponse, RewardTransactionResponse
from app.services.rewards import RewardService

router = APIRouter(prefix="/rewards", tags=["Rewards"])

@router.get("/wallet", response_model=RewardWalletResponse)
async def get_wallet(
    token: TokenPayload = Depends(require_role(["GENERATOR", "RECYCLER", "LOGISTICS", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> RewardWalletResponse:
    """Retrieve current reward wallet balance."""
    return await RewardService(db).get_wallet(token.sub)

@router.get("/transactions", response_model=list[RewardTransactionResponse])
async def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    token: TokenPayload = Depends(require_role(["GENERATOR", "RECYCLER", "LOGISTICS", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> list[RewardTransactionResponse]:
    """Return paginated reward transaction ledger."""
    return await RewardService(db).list_transactions(token.sub, page=page, page_size=page_size)
