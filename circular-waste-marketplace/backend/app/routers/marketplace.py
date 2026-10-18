"""Marketplace router — /api/v1/marketplace/..."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import require_role, TokenPayload
from app.db.session import get_async_session
from app.schemas import (
    MarketplaceListingRequest, MarketplaceListingResponse,
    BidRequest, BidResponse, CheckoutRequest, PurchaseOrderResponse,
)
from app.services.marketplace import MarketplaceService

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])

@router.post("/listings", response_model=MarketplaceListingResponse, status_code=status.HTTP_201_CREATED)
async def create_listing(
    payload: MarketplaceListingRequest,
    token: TokenPayload = Depends(require_role(["GENERATOR", "RECYCLER", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> MarketplaceListingResponse:
    """Publish an inventory lot to the B2B marketplace."""
    return await MarketplaceService(db).create_listing(payload, seller_id=token.sub)

@router.get("/listings", response_model=list[MarketplaceListingResponse])
async def list_listings(
    category_id: int | None = Query(None),
    grade: str | None = Query(None),
    min_price: float | None = Query(None),
    max_price: float | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    token: TokenPayload = Depends(require_role(["GENERATOR", "RECYCLER", "LOGISTICS", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> list[MarketplaceListingResponse]:
    """Browse active marketplace listings with filters and pagination."""
    return await MarketplaceService(db).list_active(
        category_id=category_id, grade=grade,
        min_price=min_price, max_price=max_price,
        page=page, page_size=page_size,
    )

@router.post("/bids", response_model=BidResponse, status_code=status.HTTP_201_CREATED)
async def place_bid(
    payload: BidRequest,
    token: TokenPayload = Depends(require_role(["RECYCLER"])),
    db: AsyncSession = Depends(get_async_session),
) -> BidResponse:
    """Submit a procurement bid and reserve inventory allocation."""
    return await MarketplaceService(db).place_bid(payload, buyer_id=token.sub)

@router.post("/orders/checkout", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
async def checkout(
    payload: CheckoutRequest,
    token: TokenPayload = Depends(require_role(["RECYCLER"])),
    db: AsyncSession = Depends(get_async_session),
) -> PurchaseOrderResponse:
    """Create a purchase order and hold inventory in escrow."""
    return await MarketplaceService(db).checkout(payload, buyer_id=token.sub)
