"""
Circular Waste Marketplace — Intake Repository
===============================================
Database access layer for WasteIntake consignments and paginated role queries.
"""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import PickupRequest, Supplier, WasteCategory, WasteIntake


class IntakeRepository:
    """Repository managing WasteIntake database persistence and queries."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_id(self, intake_id: uuid.UUID) -> Optional[WasteIntake]:
        """Fetch single intake with category and supplier."""
        query = (
            select(WasteIntake)
            .where(WasteIntake.id == intake_id)
            .options(
                selectinload(WasteIntake.category),
                selectinload(WasteIntake.supplier),
                selectinload(WasteIntake.pickup_request),
                selectinload(WasteIntake.weight_tickets),
            )
        )
        result = await self._db.execute(query)
        return result.scalar_one_or_none()

    async def list_for_supplier(
        self,
        supplier_user_id: uuid.UUID,
        status: Optional[str] = None,
        category_id: Optional[int] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[WasteIntake], int]:
        """List intakes submitted by a specific supplier."""
        filters = [Supplier.user_id == supplier_user_id]
        if status:
            filters.append(func.lower(WasteIntake.status) == status.lower())
        if category_id:
            filters.append(WasteIntake.category_id == category_id)

        count_query = (
            select(func.count(WasteIntake.id))
            .select_from(WasteIntake)
            .join(Supplier, WasteIntake.supplier_id == Supplier.id)
            .where(*filters)
        )
        total = (await self._db.execute(count_query)).scalar() or 0

        items_query = (
            select(WasteIntake)
            .join(Supplier, WasteIntake.supplier_id == Supplier.id)
            .where(*filters)
            .options(
                selectinload(WasteIntake.category),
                selectinload(WasteIntake.supplier),
            )
            .order_by(WasteIntake.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        items = list((await self._db.execute(items_query)).scalars().all())
        return items, total

    async def list_for_recycler(
        self,
        status: Optional[str] = None,
        category_id: Optional[int] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[WasteIntake], int]:
        """List intakes available for processing/sorting (weighed, in_sorting, sorted, listed, sold)."""
        allowed_statuses = {"weighed", "in_sorting", "sorted", "listed", "sold"}
        filters = []
        if status:
            if status.lower() in allowed_statuses:
                filters.append(func.lower(WasteIntake.status) == status.lower())
            else:
                return [], 0
        else:
            filters.append(func.lower(WasteIntake.status).in_(allowed_statuses))

        if category_id:
            filters.append(WasteIntake.category_id == category_id)

        count_query = select(func.count(WasteIntake.id)).where(*filters)
        total = (await self._db.execute(count_query)).scalar() or 0

        items_query = (
            select(WasteIntake)
            .where(*filters)
            .options(
                selectinload(WasteIntake.category),
                selectinload(WasteIntake.supplier),
            )
            .order_by(WasteIntake.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        items = list((await self._db.execute(items_query)).scalars().all())
        return items, total

    async def list_for_logistics(
        self,
        driver_user_id: uuid.UUID,
        status: Optional[str] = None,
        category_id: Optional[int] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[WasteIntake], int]:
        """List intakes assigned to driver via pickup request."""
        filters = [PickupRequest.assigned_driver_user_id == driver_user_id]
        if status:
            filters.append(func.lower(WasteIntake.status) == status.lower())
        if category_id:
            filters.append(WasteIntake.category_id == category_id)

        count_query = (
            select(func.count(WasteIntake.id))
            .select_from(WasteIntake)
            .join(PickupRequest, WasteIntake.id == PickupRequest.intake_id)
            .where(*filters)
        )
        total = (await self._db.execute(count_query)).scalar() or 0

        items_query = (
            select(WasteIntake)
            .join(PickupRequest, WasteIntake.id == PickupRequest.intake_id)
            .where(*filters)
            .options(
                selectinload(WasteIntake.category),
                selectinload(WasteIntake.supplier),
            )
            .order_by(WasteIntake.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        items = list((await self._db.execute(items_query)).scalars().all())
        return items, total

    async def list_all(
        self,
        status: Optional[str] = None,
        category_id: Optional[int] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[WasteIntake], int]:
        """List all intakes across platform (Admin view)."""
        filters = []
        if status:
            filters.append(func.lower(WasteIntake.status) == status.lower())
        if category_id:
            filters.append(WasteIntake.category_id == category_id)

        count_query = select(func.count(WasteIntake.id))
        if filters:
            count_query = count_query.where(*filters)
        total = (await self._db.execute(count_query)).scalar() or 0

        items_query = select(WasteIntake)
        if filters:
            items_query = items_query.where(*filters)
        items_query = (
            items_query.options(
                selectinload(WasteIntake.category),
                selectinload(WasteIntake.supplier),
            )
            .order_by(WasteIntake.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        items = list((await self._db.execute(items_query)).scalars().all())
        return items, total

    async def update_status(self, intake: WasteIntake, new_status: str) -> WasteIntake:
        """Update intake status."""
        intake.status = new_status
        await self._db.flush()
        return intake
