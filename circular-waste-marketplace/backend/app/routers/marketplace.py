"""Marketplace router — /api/v1/marketplace/...

Thin HTTP layer delegating B2B listings, bids, checkout, and escrow orders to services.
"""
from __future__ import annotations

import uuid
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.dependencies.auth import get_current_active_user, require_roles
from app.models import User
from app.repositories.marketplace_repository import MarketplaceRepository
from app.schemas.marketplace_schemas import (
    ListingCreate,
    ListingRead,
    ListingListResponse,
    BidCreate,
    BidRead,
    BidAcceptRequest,
    BuyNowRequest,
    PurchaseOrderRead,
    OrderListResponse,
    OrderCancelRequest,
    ConfirmOrderRequest,
    BidRejectRequest,
    OrderShipRequest,
    OrderDeliverRequest,
    ListingUpdateRequest,
)
from app.services.marketplace_service import MarketplaceService

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])


# --- Listings ---

@router.post(
    "/listings",
    response_model=ListingRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_listing(
    payload: ListingCreate,
    request: Request,
    user: User = Depends(require_roles("RECYCLER", "ADMIN")),
    db: AsyncSession = Depends(get_async_session),
) -> ListingRead:
    """Publish a sorted inventory lot to the B2B marketplace."""
    request_id = request.headers.get("x-request-id")
    listing = await MarketplaceService.create_listing(
        user=user, payload=payload, session=db, request_id=request_id
    )
    return ListingRead.model_validate(listing)


@router.get(
    "/listings",
    response_model=ListingListResponse,
)
async def list_listings(
    category_id: int | None = Query(None),
    status_filter: str | None = Query("active", alias="status"),
    min_price: float | None = Query(None),
    max_price: float | None = Query(None),
    seller_id: str | None = Query(None, description="Seller UUID or 'me'"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> ListingListResponse:
    """Browse marketplace listings with filters."""
    filters: dict[str, Any] = {}
    if category_id:
        filters["category_id"] = category_id
    if status_filter:
        filters["status"] = status_filter
    if min_price is not None:
        filters["price_min"] = min_price
    if max_price is not None:
        filters["price_max"] = max_price
    if seller_id:
        if seller_id == "me":
            filters["seller_id"] = user.id
        else:
            try:
                filters["seller_id"] = uuid.UUID(seller_id)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="seller_id must be a UUID or 'me'",
                )

    pagination = {"skip": (page - 1) * page_size, "limit": page_size}
    listings, total = await MarketplaceService.list_listings(
        user=user, filters=filters, pagination=pagination, session=db
    )
    return ListingListResponse(
        items=[ListingRead.model_validate(l) for l in listings],
        total=total,
    )


@router.get(
    "/listings/{listing_id}",
    response_model=ListingRead,
)
async def get_listing(
    listing_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> ListingRead:
    """Get single listing detail."""
    listing = await MarketplaceRepository.get_listing_by_id(db, listing_id)
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found",
        )
    return ListingRead.model_validate(listing)


# --- Bids ---

@router.post(
    "/listings/{listing_id}/bids",
    response_model=BidRead,
    status_code=status.HTTP_201_CREATED,
)
async def place_bid_for_listing(
    listing_id: uuid.UUID,
    payload: BidCreate,
    request: Request,
    user: User = Depends(require_roles("RECYCLER", "ADMIN")),
    db: AsyncSession = Depends(get_async_session),
) -> BidRead:
    """Place a procurement bid on a listing."""
    request_id = request.headers.get("x-request-id")
    bid = await MarketplaceService.place_bid(
        user=user,
        listing_id=listing_id,
        payload=payload,
        session=db,
        request_id=request_id,
    )
    return BidRead.model_validate(bid)


@router.get(
    "/listings/{listing_id}/bids",
    response_model=list[BidRead],
)
async def list_bids_for_listing(
    listing_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> list[BidRead]:
    """List ranked bids for a listing (listing seller or ADMIN only; others get 404)."""
    bids = await MarketplaceService.list_bids_for_listing(
        user=user, listing_id=listing_id, session=db
    )
    return [BidRead.model_validate(b) for b in bids]


@router.post(
    "/listings/{listing_id}/bids/{bid_id}/accept",
    response_model=PurchaseOrderRead,
)
@router.post(
    "/listings/{listing_id}/bids/accept",
    response_model=PurchaseOrderRead,
)
async def accept_bid(
    listing_id: uuid.UUID,
    payload: BidAcceptRequest | None = None,
    bid_id: uuid.UUID | None = None,
    request: Request = None,
    user: User = Depends(require_roles("RECYCLER", "ADMIN")),
    db: AsyncSession = Depends(get_async_session),
) -> PurchaseOrderRead:
    """Seller accepts a bid and forms a binding purchase order."""
    target_bid_id = bid_id or (payload.bid_id if payload else None)
    if not target_bid_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="bid_id must be provided",
        )
    request_id = request.headers.get("x-request-id") if request else None
    order = await MarketplaceService.accept_bid(
        user=user,
        listing_id=listing_id,
        bid_id=target_bid_id,
        session=db,
        request_id=request_id,
    )
    return PurchaseOrderRead.model_validate(order)


# --- Buy Now & Orders ---

@router.post(
    "/listings/{listing_id}/buy-now",
    response_model=PurchaseOrderRead,
    status_code=status.HTTP_201_CREATED,
)
async def buy_now(
    listing_id: uuid.UUID,
    payload: BuyNowRequest,
    request: Request,
    user: User = Depends(require_roles("RECYCLER", "ADMIN")),
    db: AsyncSession = Depends(get_async_session),
) -> PurchaseOrderRead:
    """Instantly purchase recyclable quantity at ask price."""
    request_id = request.headers.get("x-request-id")
    order = await MarketplaceService.buy_now(
        user=user,
        listing_id=listing_id,
        payload=payload,
        session=db,
        request_id=request_id,
    )
    return PurchaseOrderRead.model_validate(order)


@router.post(
    "/orders/{order_id}/pay",
    response_model=PurchaseOrderRead,
)
@router.post(
    "/orders/{order_id}/confirm-payment",
    response_model=PurchaseOrderRead,
)
async def confirm_payment(
    order_id: uuid.UUID,
    payload: ConfirmOrderRequest | None = None,
    request: Request = None,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> PurchaseOrderRead:
    """Buyer deposits funds into mock escrow."""
    request_id = request.headers.get("x-request-id") if request else None
    order = await MarketplaceService.confirm_payment(
        user=user,
        order_id=order_id,
        payload=payload,
        session=db,
        request_id=request_id,
    )
    return PurchaseOrderRead.model_validate(order)


@router.post(
    "/orders/{order_id}/complete",
    response_model=PurchaseOrderRead,
)
async def complete_order(
    order_id: uuid.UUID,
    request: Request,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> PurchaseOrderRead:
    """Seller or ADMIN confirms delivery and completes order."""
    request_id = request.headers.get("x-request-id")
    order = await MarketplaceService.complete_order(
        user=user,
        order_id=order_id,
        session=db,
        request_id=request_id,
    )
    return PurchaseOrderRead.model_validate(order)


@router.post(
    "/orders/{order_id}/cancel",
    response_model=PurchaseOrderRead,
)
async def cancel_order(
    order_id: uuid.UUID,
    payload: OrderCancelRequest,
    request: Request,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> PurchaseOrderRead:
    """Cancel order and refund escrow."""
    request_id = request.headers.get("x-request-id")
    order = await MarketplaceService.cancel_order(
        user=user,
        order_id=order_id,
        payload=payload,
        session=db,
        request_id=request_id,
    )
    return PurchaseOrderRead.model_validate(order)


@router.get(
    "/orders",
    response_model=OrderListResponse,
)
async def list_orders(
    role_view: str = Query("buyer", regex="^(buyer|seller)$"),
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> OrderListResponse:
    """List purchase orders for current user as buyer or seller."""
    filters = {}
    if status_filter:
        filters["status"] = status_filter

    pagination = {"skip": (page - 1) * page_size, "limit": page_size}

    if role_view == "seller" or user.role == "ADMIN":
        orders, total = await MarketplaceRepository.list_orders_for_seller(
            session=db, seller_id=user.id, filters=filters, pagination=pagination
        )
    else:
        orders, total = await MarketplaceRepository.list_orders_for_buyer(
            session=db, buyer_id=user.id, filters=filters, pagination=pagination
        )

    return OrderListResponse(
        items=[PurchaseOrderRead.model_validate(o) for o in orders],
        total=total,
    )


@router.get(
    "/orders/{order_id}",
    response_model=PurchaseOrderRead,
)
async def get_order(
    order_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> PurchaseOrderRead:
    """Get single purchase order details."""
    order = await MarketplaceRepository.get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    if user.role != "ADMIN" and user.id not in {order.buyer_user_id, order.seller_user_id}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden",
        )
    return PurchaseOrderRead.model_validate(order)


# --- Segment 3.2b: seller-side flows ---

@router.patch(
    "/listings/{listing_id}",
    response_model=ListingRead,
)
async def update_listing(
    listing_id: uuid.UUID,
    payload: ListingUpdateRequest,
    request: Request,
    user: User = Depends(require_roles("RECYCLER", "ADMIN")),
    db: AsyncSession = Depends(get_async_session),
) -> ListingRead:
    """Seller or ADMIN cancels an active listing (only cancel supported)."""
    listing = await MarketplaceService.cancel_listing(
        user=user,
        listing_id=listing_id,
        payload=payload,
        session=db,
        request_id=request.headers.get("x-request-id"),
    )
    return ListingRead.model_validate(listing)


@router.post(
    "/listings/{listing_id}/bids/{bid_id}/reject",
    response_model=BidRead,
)
async def reject_bid(
    listing_id: uuid.UUID,
    bid_id: uuid.UUID,
    request: Request,
    payload: BidRejectRequest | None = None,
    user: User = Depends(require_roles("RECYCLER", "ADMIN")),
    db: AsyncSession = Depends(get_async_session),
) -> BidRead:
    """Seller or ADMIN rejects a pending bid."""
    bid = await MarketplaceService.reject_bid(
        user=user,
        listing_id=listing_id,
        bid_id=bid_id,
        payload=payload,
        session=db,
        request_id=request.headers.get("x-request-id"),
    )
    return BidRead.model_validate(bid)


@router.patch(
    "/orders/{order_id}/ship",
    response_model=PurchaseOrderRead,
)
async def ship_order(
    order_id: uuid.UUID,
    request: Request,
    payload: OrderShipRequest | None = None,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> PurchaseOrderRead:
    """Seller or ADMIN marks an escrow-held order as shipped."""
    order = await MarketplaceService.ship_order(
        user=user,
        order_id=order_id,
        payload=payload,
        session=db,
        request_id=request.headers.get("x-request-id"),
    )
    return PurchaseOrderRead.model_validate(order)


@router.patch(
    "/orders/{order_id}/deliver",
    response_model=PurchaseOrderRead,
)
async def deliver_order(
    order_id: uuid.UUID,
    request: Request,
    payload: OrderDeliverRequest | None = None,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> PurchaseOrderRead:
    """Buyer or ADMIN confirms receipt of a shipped order."""
    order = await MarketplaceService.deliver_order(
        user=user,
        order_id=order_id,
        payload=payload,
        session=db,
        request_id=request.headers.get("x-request-id"),
    )
    return PurchaseOrderRead.model_validate(order)
