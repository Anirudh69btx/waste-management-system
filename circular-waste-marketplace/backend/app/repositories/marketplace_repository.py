"""Marketplace repository — SQLAlchemy 2.x async."""
from __future__ import annotations

import uuid
from typing import Any
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MarketplaceListing
from app.models.bid import Bid
from app.models.purchase_order import PurchaseOrder


class MarketplaceRepository:
    # --- Listings ---
    @staticmethod
    async def create_listing(session: AsyncSession, **fields) -> MarketplaceListing:
        listing = MarketplaceListing(**fields)
        session.add(listing)
        await session.flush()
        await session.refresh(listing)
        return listing

    @staticmethod
    async def get_listing_by_id(session: AsyncSession, listing_id: uuid.UUID) -> MarketplaceListing | None:
        result = await session.execute(
            select(MarketplaceListing).where(MarketplaceListing.id == listing_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_listings(
        session: AsyncSession,
        filters: dict[str, Any] | None = None,
        pagination: dict[str, int] | None = None,
    ) -> tuple[list[MarketplaceListing], int]:
        query = select(MarketplaceListing)
        if filters:
            if "category_id" in filters and filters["category_id"] is not None:
                query = query.where(MarketplaceListing.category_id == filters["category_id"])
            if "status" in filters and filters["status"] is not None:
                query = query.where(MarketplaceListing.status == filters["status"])
            if "seller_id" in filters and filters["seller_id"] is not None:
                query = query.where(MarketplaceListing.seller_id == filters["seller_id"])
            if "price_min" in filters and filters["price_min"] is not None:
                query = query.where(MarketplaceListing.unit_price_per_kg >= filters["price_min"])
            if "price_max" in filters and filters["price_max"] is not None:
                query = query.where(MarketplaceListing.unit_price_per_kg <= filters["price_max"])

        count_query = select(func.count()).select_from(query.subquery())
        total = (await session.execute(count_query)).scalar_one()

        query = query.order_by(MarketplaceListing.created_at.desc())
        if pagination:
            skip = pagination.get("skip", 0)
            limit = pagination.get("limit", 20)
            query = query.offset(skip).limit(limit)

        result = await session.execute(query)
        return list(result.scalars().all()), total

    @staticmethod
    async def update_listing_status(
        session: AsyncSession, listing_id: uuid.UUID, new_status: str, **extra
    ) -> MarketplaceListing:
        values = {"status": new_status, **extra}
        stmt = (
            update(MarketplaceListing)
            .where(MarketplaceListing.id == listing_id)
            .values(**values)
            .returning(MarketplaceListing)
        )
        result = await session.execute(stmt)
        listing = result.scalar_one()
        await session.flush()
        return listing

    # --- Bids ---
    @staticmethod
    async def create_bid(session: AsyncSession, **fields) -> Bid:
        bid = Bid(**fields)
        session.add(bid)
        await session.flush()
        await session.refresh(bid)
        return bid

    @staticmethod
    async def get_bid_by_id(session: AsyncSession, bid_id: uuid.UUID) -> Bid | None:
        result = await session.execute(select(Bid).where(Bid.id == bid_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def list_bids_for_listing(session: AsyncSession, listing_id: uuid.UUID) -> list[Bid]:
        result = await session.execute(
            select(Bid).where(Bid.listing_id == listing_id).order_by(Bid.bid_price_per_kg.desc(), Bid.created_at.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def update_bid_status(session: AsyncSession, bid_id: uuid.UUID, new_status: str) -> Bid:
        stmt = (
            update(Bid)
            .where(Bid.id == bid_id)
            .values(status=new_status)
            .returning(Bid)
        )
        result = await session.execute(stmt)
        bid = result.scalar_one()
        await session.flush()
        return bid

    # --- Purchase Orders ---
    @staticmethod
    async def create_order(session: AsyncSession, **fields) -> PurchaseOrder:
        order = PurchaseOrder(**fields)
        session.add(order)
        await session.flush()
        await session.refresh(order)
        return order

    @staticmethod
    async def get_order_by_id(session: AsyncSession, order_id: uuid.UUID) -> PurchaseOrder | None:
        result = await session.execute(select(PurchaseOrder).where(PurchaseOrder.id == order_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_order_by_code(session: AsyncSession, code: str) -> PurchaseOrder | None:
        result = await session.execute(select(PurchaseOrder).where(PurchaseOrder.order_code == code))
        return result.scalar_one_or_none()

    @staticmethod
    async def list_orders_for_buyer(
        session: AsyncSession,
        buyer_id: uuid.UUID,
        filters: dict[str, Any] | None = None,
        pagination: dict[str, int] | None = None,
    ) -> tuple[list[PurchaseOrder], int]:
        query = select(PurchaseOrder).where(PurchaseOrder.buyer_user_id == buyer_id)
        if filters and "status" in filters and filters["status"] is not None:
            query = query.where(PurchaseOrder.status == filters["status"])

        count_query = select(func.count()).select_from(query.subquery())
        total = (await session.execute(count_query)).scalar_one()

        query = query.order_by(PurchaseOrder.created_at.desc())
        if pagination:
            skip = pagination.get("skip", 0)
            limit = pagination.get("limit", 20)
            query = query.offset(skip).limit(limit)

        result = await session.execute(query)
        return list(result.scalars().all()), total

    @staticmethod
    async def list_orders_for_seller(
        session: AsyncSession,
        seller_id: uuid.UUID,
        filters: dict[str, Any] | None = None,
        pagination: dict[str, int] | None = None,
    ) -> tuple[list[PurchaseOrder], int]:
        query = select(PurchaseOrder).where(PurchaseOrder.seller_user_id == seller_id)
        if filters and "status" in filters and filters["status"] is not None:
            query = query.where(PurchaseOrder.status == filters["status"])

        count_query = select(func.count()).select_from(query.subquery())
        total = (await session.execute(count_query)).scalar_one()

        query = query.order_by(PurchaseOrder.created_at.desc())
        if pagination:
            skip = pagination.get("skip", 0)
            limit = pagination.get("limit", 20)
            query = query.offset(skip).limit(limit)

        result = await session.execute(query)
        return list(result.scalars().all()), total

    @staticmethod
    async def update_order_status(
        session: AsyncSession, order_id: uuid.UUID, new_status: str, **extra
    ) -> PurchaseOrder:
        values = {"status": new_status, **extra}
        stmt = (
            update(PurchaseOrder)
            .where(PurchaseOrder.id == order_id)
            .values(**values)
            .returning(PurchaseOrder)
        )
        result = await session.execute(stmt)
        order = result.scalar_one()
        await session.flush()
        return order
