"""Inventory repository — SQLAlchemy 2.x async."""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory_lot import InventoryLot
from app.models import MarketplaceListing


class InventoryRepository:
    @staticmethod
    async def create(session: AsyncSession, **fields) -> InventoryLot:
        lot = InventoryLot(**fields)
        session.add(lot)
        await session.flush()
        await session.refresh(lot)
        return lot

    @staticmethod
    async def get_by_id(session: AsyncSession, lot_id: uuid.UUID) -> InventoryLot | None:
        result = await session.execute(select(InventoryLot).where(InventoryLot.id == lot_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_lot_code(session: AsyncSession, lot_code: str) -> InventoryLot | None:
        result = await session.execute(select(InventoryLot).where(InventoryLot.lot_code == lot_code))
        return result.scalar_one_or_none()

    @staticmethod
    async def list_for_seller(
        session: AsyncSession,
        seller_user_id: uuid.UUID,
        filters: dict[str, Any] | None = None,
        pagination: dict[str, int] | None = None,
    ) -> tuple[list[InventoryLot], int]:
        query = select(InventoryLot).join(
            MarketplaceListing, MarketplaceListing.inventory_lot_id == InventoryLot.id
        ).where(MarketplaceListing.seller_id == seller_user_id)

        if filters:
            if "status" in filters and filters["status"] is not None:
                query = query.where(InventoryLot.status == filters["status"])
            if "category_id" in filters and filters["category_id"] is not None:
                query = query.where(InventoryLot.category_id == filters["category_id"])

        count_query = select(func.count()).select_from(query.subquery())
        total = (await session.execute(count_query)).scalar_one()

        query = query.order_by(InventoryLot.created_at.desc())
        if pagination:
            skip = pagination.get("skip", 0)
            limit = pagination.get("limit", 20)
            query = query.offset(skip).limit(limit)

        result = await session.execute(query)
        return list(result.scalars().all()), total

    @staticmethod
    async def list_available(
        session: AsyncSession,
        filters: dict[str, Any] | None = None,
        pagination: dict[str, int] | None = None,
    ) -> tuple[list[InventoryLot], int]:
        query = select(InventoryLot).where(InventoryLot.status == "available")

        if filters:
            if "category_id" in filters and filters["category_id"] is not None:
                query = query.where(InventoryLot.category_id == filters["category_id"])
            if "grade" in filters and filters["grade"] is not None:
                query = query.where(InventoryLot.grade == filters["grade"])

        count_query = select(func.count()).select_from(query.subquery())
        total = (await session.execute(count_query)).scalar_one()

        query = query.order_by(InventoryLot.created_at.desc())
        if pagination:
            skip = pagination.get("skip", 0)
            limit = pagination.get("limit", 20)
            query = query.offset(skip).limit(limit)

        result = await session.execute(query)
        return list(result.scalars().all()), total

    @staticmethod
    async def update_available(session: AsyncSession, lot_id: uuid.UUID, delta_kg: Decimal) -> InventoryLot:
        stmt = (
            update(InventoryLot)
            .where(InventoryLot.id == lot_id)
            .values(available_kg=InventoryLot.available_kg - delta_kg)
            .returning(InventoryLot)
        )
        result = await session.execute(stmt)
        lot = result.scalar_one()
        await session.flush()
        return lot

    @staticmethod
    async def update_status(session: AsyncSession, lot_id: uuid.UUID, new_status: str) -> InventoryLot:
        stmt = (
            update(InventoryLot)
            .where(InventoryLot.id == lot_id)
            .values(status=new_status)
            .returning(InventoryLot)
        )
        result = await session.execute(stmt)
        lot = result.scalar_one()
        await session.flush()
        return lot
