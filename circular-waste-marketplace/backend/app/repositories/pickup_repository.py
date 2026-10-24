"""
Circular Waste Marketplace — Pickup Repository
===============================================
Database access layer for PickupRequest entities.
"""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import PickupRequest, PickupStatus, Supplier, WasteIntake


class PickupRepository:
    """Repository managing PickupRequest database persistence and queries."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create(self, pickup: PickupRequest) -> PickupRequest:
        """Add and flush a new PickupRequest."""
        self._db.add(pickup)
        await self._db.flush()
        return pickup

    async def get_by_id(self, pickup_id: uuid.UUID) -> Optional[PickupRequest]:
        """Fetch pickup by primary key with related intake, driver, and supplier."""
        query = (
            select(PickupRequest)
            .where(PickupRequest.id == pickup_id)
            .options(
                selectinload(PickupRequest.intake).selectinload(WasteIntake.category),
                selectinload(PickupRequest.intake).selectinload(WasteIntake.supplier),
                selectinload(PickupRequest.assigned_driver),
                selectinload(PickupRequest.requested_by),
            )
        )
        result = await self._db.execute(query)
        return result.scalar_one_or_none()

    async def get_active_by_intake(self, intake_id: uuid.UUID) -> Optional[PickupRequest]:
        """Find an active (non-terminal) pickup request for a given intake."""
        terminal_statuses = {
            PickupStatus.CANCELLED.value,
            PickupStatus.FAILED.value,
            PickupStatus.COMPLETED.value,
        }
        query = (
            select(PickupRequest)
            .where(
                PickupRequest.intake_id == intake_id,
                PickupRequest.status.not_in(terminal_statuses),
            )
            .options(
                selectinload(PickupRequest.intake).selectinload(WasteIntake.category),
                selectinload(PickupRequest.intake).selectinload(WasteIntake.supplier),
                selectinload(PickupRequest.assigned_driver),
                selectinload(PickupRequest.requested_by),
            )
        )
        result = await self._db.execute(query)
        return result.scalar_one_or_none()

    async def list_for_supplier(
        self,
        supplier_user_id: uuid.UUID,
        status: Optional[str] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[PickupRequest], int]:
        """List pickups for waste consignments submitted by a specific supplier."""
        base_filter = [
            PickupRequest.intake_id == WasteIntake.id,
            WasteIntake.supplier_id == Supplier.id,
            Supplier.user_id == supplier_user_id,
        ]
        if status:
            base_filter.append(PickupRequest.status == status)

        count_query = (
            select(func.count(PickupRequest.id))
            .select_from(PickupRequest)
            .join(WasteIntake, PickupRequest.intake_id == WasteIntake.id)
            .join(Supplier, WasteIntake.supplier_id == Supplier.id)
            .where(*base_filter)
        )
        total = (await self._db.execute(count_query)).scalar() or 0

        items_query = (
            select(PickupRequest)
            .join(WasteIntake, PickupRequest.intake_id == WasteIntake.id)
            .join(Supplier, WasteIntake.supplier_id == Supplier.id)
            .where(*base_filter)
            .options(
                selectinload(PickupRequest.intake).selectinload(WasteIntake.category),
                selectinload(PickupRequest.assigned_driver),
            )
            .order_by(PickupRequest.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        items = list((await self._db.execute(items_query)).scalars().all())
        return items, total

    async def list_for_driver(
        self,
        driver_user_id: uuid.UUID,
        status: Optional[str] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[PickupRequest], int]:
        """List pickups assigned to a specific driver."""
        filters = [PickupRequest.assigned_driver_user_id == driver_user_id]
        if status:
            filters.append(PickupRequest.status == status)

        count_query = select(func.count(PickupRequest.id)).where(*filters)
        total = (await self._db.execute(count_query)).scalar() or 0

        items_query = (
            select(PickupRequest)
            .where(*filters)
            .options(
                selectinload(PickupRequest.intake).selectinload(WasteIntake.category),
                selectinload(PickupRequest.assigned_driver),
            )
            .order_by(PickupRequest.scheduled_start.asc())
            .offset(offset)
            .limit(limit)
        )
        items = list((await self._db.execute(items_query)).scalars().all())
        return items, total

    async def list_all(
        self,
        status: Optional[str] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[PickupRequest], int]:
        """List all pickups across platform (Admin view)."""
        filters = []
        if status:
            filters.append(PickupRequest.status == status)

        count_query = select(func.count(PickupRequest.id))
        if filters:
            count_query = count_query.where(*filters)
        total = (await self._db.execute(count_query)).scalar() or 0

        items_query = select(PickupRequest)
        if filters:
            items_query = items_query.where(*filters)
        items_query = (
            items_query.options(
                selectinload(PickupRequest.intake).selectinload(WasteIntake.category),
                selectinload(PickupRequest.assigned_driver),
            )
            .order_by(PickupRequest.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        items = list((await self._db.execute(items_query)).scalars().all())
        return items, total

    async def update_status(
        self,
        pickup: PickupRequest,
        new_status: str,
        reason: Optional[str] = None,
    ) -> PickupRequest:
        """Update pickup request status and associated reasons."""
        pickup.status = new_status
        if new_status == PickupStatus.CANCELLED.value and reason:
            pickup.cancellation_reason = reason
        elif new_status == PickupStatus.FAILED.value and reason:
            pickup.failure_reason = reason
        await self._db.flush()
        return pickup

    async def assign_driver(
        self,
        pickup: PickupRequest,
        driver_id: uuid.UUID,
    ) -> PickupRequest:
        """Assign driver and transition to accepted status."""
        pickup.assigned_driver_user_id = driver_id
        pickup.status = PickupStatus.ACCEPTED.value
        await self._db.flush()
        return pickup
