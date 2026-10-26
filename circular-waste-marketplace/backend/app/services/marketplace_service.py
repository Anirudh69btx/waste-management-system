"""Marketplace service — B2B recyclable trading with escrow and bidding."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MarketplaceListing, User
from app.models.bid import Bid
from app.models.inventory_lot import InventoryLot
from app.models.purchase_order import PurchaseOrder
from app.repositories.inventory_repository import InventoryRepository
from app.repositories.marketplace_repository import MarketplaceRepository
from app.schemas.marketplace_schemas import (
    ListingCreate,
    BidCreate,
    BuyNowRequest,
    OrderCancelRequest,
    ConfirmOrderRequest,
    BidRejectRequest,
    OrderShipRequest,
    OrderDeliverRequest,
    ListingUpdateRequest,
)
from app.services.traceability_service import emit

logger = logging.getLogger(__name__)


class MarketplaceService:
    @staticmethod
    async def create_listing(
        user: User,
        payload: ListingCreate,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> MarketplaceListing:
        # 1. Assert user.role in {RECYCLER, ADMIN}
        if user.role not in {"RECYCLER", "ADMIN"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only RECYCLER or ADMIN can create marketplace listings",
            )

        # 2. Load InventoryLot
        lot = await InventoryRepository.get_by_id(session, payload.inventory_lot_id)
        if not lot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventory lot not found",
            )

        if lot.status != "available":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Inventory lot is not available (current status: {lot.status})",
            )

        available_kg = lot.available_kg
        if available_kg <= 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Inventory lot has no available quantity",
            )

        year = datetime.now(timezone.utc).year
        count_res = await session.execute(select(func.count(MarketplaceListing.id)))
        seq = count_res.scalar_one() + 1
        listing_code = f"LST-{year}-{seq:06d}"

        # 3. Create MarketplaceListing
        listing = await MarketplaceRepository.create_listing(
            session,
            listing_code=listing_code,
            seller_id=user.id,
            inventory_lot_id=lot.id,
            category_id=lot.category_id,
            title=payload.title,
            description=payload.description,
            purity_grade=lot.grade,
            listing_type="FIXED_PRICE",
            available_quantity_kg=float(available_kg),
            min_order_quantity_kg=float(payload.min_bid_kg),
            unit_price_per_kg=float(payload.price_per_kg),
            calculated_floor_price=float(payload.price_per_kg),
            estimated_co2_offset_total=float(available_kg) * 1.5,
            status="active",
        )

        # 4. Update InventoryLot.status -> "reserved"
        await InventoryRepository.update_status(session, lot.id, "reserved")

        # 5. Emit listing.created traceability event
        await emit(
            session,
            batch_id=lot.intake_id,
            event_type="listing.created",
            actor=user,
            from_status=lot.status,
            to_status="reserved",
            metadata={
                "listing_id": str(listing.id),
                "listing_code": listing_code,
                "inventory_lot_id": str(lot.id),
                "quantity_kg": float(available_kg),
                "price_per_kg": float(payload.price_per_kg),
            },
            request_id=request_id,
        )

        await session.commit()
        await session.refresh(listing)
        logger.info(
            "Listing created: id=%s code=%s by seller=%s",
            listing.id,
            listing_code,
            user.id,
            extra={"request_id": request_id},
        )
        return listing

    @staticmethod
    async def list_listings(
        user: User | None,
        filters: dict[str, Any] | None,
        pagination: dict[str, int] | None,
        session: AsyncSession,
    ) -> tuple[list[MarketplaceListing], int]:
        f = dict(filters or {})
        if "status" not in f or f["status"] is None:
            f["status"] = "active"
        return await MarketplaceRepository.list_listings(session, filters=f, pagination=pagination)

    @staticmethod
    async def place_bid(
        user: User,
        listing_id: uuid.UUID,
        payload: BidCreate,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> Bid:
        # 1. Assert user.role in {RECYCLER, ADMIN}
        if user.role not in {"RECYCLER", "ADMIN"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only RECYCLER or ADMIN can place bids",
            )

        # 2. Load listing. Assert status == "active"
        listing = await MarketplaceRepository.get_listing_by_id(session, listing_id)
        if not listing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Marketplace listing not found",
            )

        if listing.status != "active":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Listing is not active (current status: {listing.status})",
            )

        # 3. Assert self-bid blocked
        if listing.seller_id == user.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Seller cannot bid on own listing",
            )

        # 4. Assert bid.price_per_kg >= listing.price_per_kg * 0.7
        min_allowed_price = Decimal(str(listing.unit_price_per_kg)) * Decimal("0.7")
        if payload.bid_price_per_kg < min_allowed_price:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Bid price must be at least 70% of ask price ({min_allowed_price:.2f})",
            )

        # 5. Assert bid.quantity_kg <= listing.available_kg
        available_kg = Decimal(str(listing.available_quantity_kg))
        if payload.quantity_kg > available_kg:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Requested quantity ({payload.quantity_kg} kg) exceeds available quantity ({available_kg} kg)",
            )

        # 6. Create Bid
        total_amount = payload.bid_price_per_kg * payload.quantity_kg
        bid = await MarketplaceRepository.create_bid(
            session,
            listing_id=listing.id,
            buyer_user_id=user.id,
            bid_price_per_kg=payload.bid_price_per_kg,
            quantity_kg=payload.quantity_kg,
            total_amount=total_amount,
            message=payload.message,
            status="pending",
        )

        # Load lot for batch_id
        lot = await InventoryRepository.get_by_id(session, listing.inventory_lot_id)
        batch_id = lot.intake_id if lot else listing.id

        # 7. Emit bid.placed event
        await emit(
            session,
            batch_id=batch_id,
            event_type="bid.placed",
            actor=user,
            from_status=None,
            to_status="pending",
            metadata={
                "bid_id": str(bid.id),
                "listing_id": str(listing.id),
                "price_per_kg": float(payload.bid_price_per_kg),
                "quantity_kg": float(payload.quantity_kg),
                "total_amount": float(total_amount),
            },
            request_id=request_id,
        )

        await session.commit()
        await session.refresh(bid)
        logger.info(
            "Bid placed: id=%s on listing=%s by buyer=%s",
            bid.id,
            listing.id,
            user.id,
            extra={"request_id": request_id},
        )
        return bid

    @staticmethod
    async def accept_bid(
        user: User,
        listing_id: uuid.UUID,
        bid_id: uuid.UUID,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> PurchaseOrder:
        # 1. Assert user role and seller ownership
        listing = await MarketplaceRepository.get_listing_by_id(session, listing_id)
        if not listing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Listing not found",
            )

        if user.role != "ADMIN" and listing.seller_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only listing seller or ADMIN can accept bids",
            )

        # 2. Load bid. Assert pending
        bid = await MarketplaceRepository.get_bid_by_id(session, bid_id)
        if not bid or bid.listing_id != listing.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bid not found for listing",
            )

        if bid.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Bid status must be 'pending' (current: {bid.status})",
            )

        available_kg = Decimal(str(listing.available_quantity_kg))
        if bid.quantity_kg > available_kg:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Bid quantity exceeds currently available listing quantity",
            )

        year = datetime.now(timezone.utc).year
        count_res = await session.execute(select(func.count(PurchaseOrder.id)))
        seq = count_res.scalar_one() + 1
        order_code = f"PO-{year}-{seq:06d}"

        # 3. Create PurchaseOrder
        order = await MarketplaceRepository.create_order(
            session,
            order_code=order_code,
            listing_id=listing.id,
            buyer_user_id=bid.buyer_user_id,
            seller_user_id=listing.seller_id,
            quantity_kg=bid.quantity_kg,
            unit_price=bid.bid_price_per_kg,
            total_amount=bid.total_amount,
            currency="INR",
            status="pending_payment",
            request_id_correlation=request_id,
        )

        # 4. Update bid status -> accepted
        await MarketplaceRepository.update_bid_status(session, bid.id, "accepted")

        # 5. Update listing available_kg
        new_avail = available_kg - bid.quantity_kg
        listing.available_quantity_kg = float(new_avail)
        if new_avail <= 0:
            listing.status = "sold"

        # Load lot for batch_id
        lot = await InventoryRepository.get_by_id(session, listing.inventory_lot_id)
        batch_id = lot.intake_id if lot else listing.id

        # 6. Emit order.created_from_bid event
        await emit(
            session,
            batch_id=batch_id,
            event_type="order.created_from_bid",
            actor=user,
            from_status="pending",
            to_status="pending_payment",
            metadata={
                "order_id": str(order.id),
                "order_code": order_code,
                "bid_id": str(bid.id),
                "quantity_kg": float(bid.quantity_kg),
                "total_amount": float(bid.total_amount),
            },
            request_id=request_id,
        )

        await session.commit()
        await session.refresh(order)
        logger.info(
            "Order created from bid: order=%s bid=%s",
            order.id,
            bid.id,
            extra={"request_id": request_id},
        )
        return order

    @staticmethod
    async def buy_now(
        user: User,
        listing_id: uuid.UUID,
        payload: BuyNowRequest,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> PurchaseOrder:
        # 1. Assert user role
        if user.role not in {"RECYCLER", "ADMIN"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only RECYCLER or ADMIN can purchase listings",
            )

        # 2. Load listing
        listing = await MarketplaceRepository.get_listing_by_id(session, listing_id)
        if not listing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Listing not found",
            )

        if listing.status != "active":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Listing is not active (current: {listing.status})",
            )

        if listing.seller_id == user.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Seller cannot purchase own listing",
            )

        available_kg = Decimal(str(listing.available_quantity_kg))
        if payload.quantity_kg > available_kg:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Requested quantity ({payload.quantity_kg} kg) exceeds available ({available_kg} kg)",
            )

        unit_price = Decimal(str(listing.unit_price_per_kg))
        total_amount = unit_price * payload.quantity_kg

        year = datetime.now(timezone.utc).year
        count_res = await session.execute(select(func.count(PurchaseOrder.id)))
        seq = count_res.scalar_one() + 1
        order_code = f"PO-{year}-{seq:06d}"

        # 3. Create PurchaseOrder
        order = await MarketplaceRepository.create_order(
            session,
            order_code=order_code,
            listing_id=listing.id,
            buyer_user_id=user.id,
            seller_user_id=listing.seller_id,
            quantity_kg=payload.quantity_kg,
            unit_price=unit_price,
            total_amount=total_amount,
            currency="INR",
            status="pending_payment",
            request_id_correlation=request_id,
        )

        # 4. Update listing available_kg
        new_avail = available_kg - payload.quantity_kg
        listing.available_quantity_kg = float(new_avail)
        if new_avail <= 0:
            listing.status = "sold"

        # Load lot for batch_id
        lot = await InventoryRepository.get_by_id(session, listing.inventory_lot_id)
        batch_id = lot.intake_id if lot else listing.id

        # 5. Emit order.created_buy_now event
        await emit(
            session,
            batch_id=batch_id,
            event_type="order.created_buy_now",
            actor=user,
            from_status=None,
            to_status="pending_payment",
            metadata={
                "order_id": str(order.id),
                "order_code": order_code,
                "quantity_kg": float(payload.quantity_kg),
                "total_amount": float(total_amount),
            },
            request_id=request_id,
        )

        await session.commit()
        await session.refresh(order)
        logger.info(
            "Buy now order created: order=%s code=%s",
            order.id,
            order_code,
            extra={"request_id": request_id},
        )
        return order

    @staticmethod
    async def confirm_payment(
        user: User,
        order_id: uuid.UUID,
        payload: ConfirmOrderRequest | None,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> PurchaseOrder:
        order = await MarketplaceRepository.get_order_by_id(session, order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )

        if user.role != "ADMIN" and order.buyer_user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only buyer or ADMIN can confirm payment",
            )

        if order.status != "pending_payment":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Order status must be 'pending_payment' (current: {order.status})",
            )

        # Mock escrow transition
        now = datetime.now(timezone.utc)
        order.status = "escrow_held"
        order.escrow_held_at = now

        listing = await MarketplaceRepository.get_listing_by_id(session, order.listing_id)
        lot = await InventoryRepository.get_by_id(session, listing.inventory_lot_id) if listing else None
        batch_id = lot.intake_id if lot else order.listing_id

        await emit(
            session,
            batch_id=batch_id,
            event_type="order.escrow_held",
            actor=user,
            from_status="pending_payment",
            to_status="escrow_held",
            metadata={
                "order_id": str(order.id),
                "order_code": order.order_code,
                "escrow_held_at": now.isoformat(),
            },
            request_id=request_id,
        )

        await session.commit()
        await session.refresh(order)
        return order

    @staticmethod
    async def complete_order(
        user: User,
        order_id: uuid.UUID,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> PurchaseOrder:
        order = await MarketplaceRepository.get_order_by_id(session, order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )

        if user.role != "ADMIN" and order.seller_user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only seller or ADMIN can complete order",
            )

        if order.status not in {"escrow_held", "shipped", "delivered"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Order must be in escrow_held, shipped or delivered to complete (current: {order.status})",
            )

        now = datetime.now(timezone.utc)
        from_status = order.status
        order.status = "completed"
        order.completed_at = now

        # Update InventoryLot status to 'sold' if available_kg reaches 0
        listing = await MarketplaceRepository.get_listing_by_id(session, order.listing_id)
        batch_id = order.listing_id
        if listing:
            lot = await InventoryRepository.get_by_id(session, listing.inventory_lot_id)
            if lot:
                batch_id = lot.intake_id
                if lot.available_kg <= 0:
                    await InventoryRepository.update_status(session, lot.id, "sold")

        await emit(
            session,
            batch_id=batch_id,
            event_type="order.completed",
            actor=user,
            from_status=from_status,
            to_status="completed",
            metadata={
                "order_id": str(order.id),
                "order_code": order.order_code,
                "completed_at": now.isoformat(),
            },
            request_id=request_id,
        )

        await session.commit()
        await session.refresh(order)

        from app.services import rewards_service
        await rewards_service.on_order_completed(order, session, request_id=request_id)

        return order

    @staticmethod
    async def cancel_order(
        user: User,
        order_id: uuid.UUID,
        payload: OrderCancelRequest,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> PurchaseOrder:
        order = await MarketplaceRepository.get_order_by_id(session, order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )

        if user.role != "ADMIN" and user.id not in {order.buyer_user_id, order.seller_user_id}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only buyer, seller, or ADMIN can cancel order",
            )

        if order.status not in {"pending_payment", "escrow_held"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Order cannot be cancelled in status '{order.status}'",
            )

        from_status = order.status
        order.status = "cancelled"
        order.cancellation_reason = payload.reason

        # Restore listing available_kg
        listing = await MarketplaceRepository.get_listing_by_id(session, order.listing_id)
        batch_id = order.listing_id
        if listing:
            listing.available_quantity_kg += float(order.quantity_kg)
            if listing.status == "sold":
                listing.status = "active"

            lot = await InventoryRepository.get_by_id(session, listing.inventory_lot_id)
            if lot:
                batch_id = lot.intake_id

        await emit(
            session,
            batch_id=batch_id,
            event_type="order.cancelled",
            actor=user,
            from_status=from_status,
            to_status="cancelled",
            metadata={
                "order_id": str(order.id),
                "order_code": order.order_code,
                "reason": payload.reason,
            },
            request_id=request_id,
        )

        await session.commit()
        await session.refresh(order)
        return order

    # ------------------------------------------------------------------
    # Segment 3.2b — seller-side flows
    # ------------------------------------------------------------------

    @staticmethod
    async def _batch_id_for_listing(
        session: AsyncSession, listing: MarketplaceListing | None, fallback: uuid.UUID
    ) -> uuid.UUID:
        if listing is None or listing.inventory_lot_id is None:
            return fallback
        lot = await InventoryRepository.get_by_id(session, listing.inventory_lot_id)
        return lot.intake_id if lot else fallback

    @staticmethod
    async def _get_owned_listing(
        user: User, listing_id: uuid.UUID, session: AsyncSession
    ) -> MarketplaceListing:
        """Load listing; non-owners (except ADMIN) get 404 to avoid existence leaks."""
        listing = await MarketplaceRepository.get_listing_by_id(session, listing_id)
        if not listing or (user.role != "ADMIN" and listing.seller_id != user.id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Listing not found",
            )
        return listing

    @staticmethod
    async def list_bids_for_listing(
        user: User, listing_id: uuid.UUID, session: AsyncSession
    ) -> list[Bid]:
        listing = await MarketplaceService._get_owned_listing(user, listing_id, session)
        return await MarketplaceRepository.list_bids_for_listing(session, listing.id)

    @staticmethod
    async def reject_bid(
        user: User,
        listing_id: uuid.UUID,
        bid_id: uuid.UUID,
        payload: BidRejectRequest | None,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> Bid:
        listing = await MarketplaceService._get_owned_listing(user, listing_id, session)

        bid = await MarketplaceRepository.get_bid_by_id(session, bid_id)
        if not bid or bid.listing_id != listing.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Bid not found for listing",
            )
        if bid.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Bid status must be 'pending' (current: {bid.status})",
            )

        bid = await MarketplaceRepository.update_bid_status(session, bid.id, "rejected")

        batch_id = await MarketplaceService._batch_id_for_listing(session, listing, listing.id)
        await emit(
            session,
            batch_id=batch_id,
            event_type="bid.rejected",
            actor=user,
            from_status="pending",
            to_status="rejected",
            metadata={
                "bid_id": str(bid.id),
                "listing_id": str(listing.id),
                "note": payload.note if payload else None,
            },
            request_id=request_id,
        )

        await session.commit()
        await session.refresh(bid)
        return bid

    @staticmethod
    async def ship_order(
        user: User,
        order_id: uuid.UUID,
        payload: OrderShipRequest | None,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> PurchaseOrder:
        order = await MarketplaceRepository.get_order_by_id(session, order_id)
        if not order or (user.role != "ADMIN" and order.seller_user_id != user.id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )
        if order.status not in {"escrow_held", "confirmed"}:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Order must be escrow_held or confirmed to ship (current: {order.status})",
            )

        from_status = order.status
        order.status = "shipped"

        listing = await MarketplaceRepository.get_listing_by_id(session, order.listing_id)
        batch_id = await MarketplaceService._batch_id_for_listing(session, listing, order.listing_id)
        await emit(
            session,
            batch_id=batch_id,
            event_type="order.shipped",
            actor=user,
            from_status=from_status,
            to_status="shipped",
            metadata={
                "order_id": str(order.id),
                "order_code": order.order_code,
                "tracking_number": payload.tracking_number if payload else None,
                "note": payload.note if payload else None,
            },
            request_id=request_id,
        )

        await session.commit()
        await session.refresh(order)
        return order

    @staticmethod
    async def deliver_order(
        user: User,
        order_id: uuid.UUID,
        payload: OrderDeliverRequest | None,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> PurchaseOrder:
        order = await MarketplaceRepository.get_order_by_id(session, order_id)
        if not order or (
            user.role != "ADMIN" and user.id not in {order.buyer_user_id, order.seller_user_id}
        ):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found",
            )
        if user.role != "ADMIN" and order.buyer_user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only buyer or ADMIN can confirm delivery",
            )
        if order.status != "shipped":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Order must be shipped to mark delivered (current: {order.status})",
            )

        order.status = "delivered"

        listing = await MarketplaceRepository.get_listing_by_id(session, order.listing_id)
        batch_id = await MarketplaceService._batch_id_for_listing(session, listing, order.listing_id)
        await emit(
            session,
            batch_id=batch_id,
            event_type="order.delivered",
            actor=user,
            from_status="shipped",
            to_status="delivered",
            metadata={
                "order_id": str(order.id),
                "order_code": order.order_code,
                "note": payload.note if payload else None,
            },
            request_id=request_id,
        )

        await session.commit()
        await session.refresh(order)
        return order

    @staticmethod
    async def cancel_listing(
        user: User,
        listing_id: uuid.UUID,
        payload: ListingUpdateRequest,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> MarketplaceListing:
        listing = await MarketplaceService._get_owned_listing(user, listing_id, session)

        if payload.status != "cancelled":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Only status='cancelled' is supported",
            )
        if listing.status != "active":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Only active listings can be cancelled (current: {listing.status})",
            )

        listing.status = "cancelled"

        # Reject outstanding bids so buyers are not left hanging
        rejected_bid_ids: list[str] = []
        for bid in await MarketplaceRepository.list_bids_for_listing(session, listing.id):
            if bid.status == "pending":
                await MarketplaceRepository.update_bid_status(session, bid.id, "rejected")
                rejected_bid_ids.append(str(bid.id))

        batch_id: uuid.UUID = listing.id
        lot_from_status: str | None = None
        if listing.inventory_lot_id is not None:
            lot = await InventoryRepository.get_by_id(session, listing.inventory_lot_id)
            if lot:
                batch_id = lot.intake_id
                lot_from_status = lot.status
                if lot.status == "reserved":
                    await InventoryRepository.update_status(session, lot.id, "available")

        await emit(
            session,
            batch_id=batch_id,
            event_type="listing.cancelled",
            actor=user,
            from_status="active",
            to_status="cancelled",
            metadata={
                "listing_id": str(listing.id),
                "inventory_lot_id": str(listing.inventory_lot_id) if listing.inventory_lot_id else None,
                "lot_from_status": lot_from_status,
                "rejected_bid_ids": rejected_bid_ids,
                "reason": payload.reason,
            },
            request_id=request_id,
        )

        await session.commit()
        await session.refresh(listing)
        return listing
