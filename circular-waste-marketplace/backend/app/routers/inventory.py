"""Inventory router — /api/v1/inventory/...

Seller-scoped view of sorted feedstock lots (Segment 3.2b).
Ownership: a lot belongs to the recycler who sorted it (SortingRecord.sorter_user_id).
ADMIN sees all lots.
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.dependencies.auth import get_current_active_user, require_roles
from app.models import User
from app.models.inventory_lot import InventoryLot
from app.models.sorting_record import SortingRecord
from app.repositories.inventory_repository import InventoryRepository
from app.schemas.sorting_schemas import InventoryLotRead

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/lots")
async def list_my_inventory_lots(
    status_filter: str | None = Query(None, alias="status"),
    category_id: int | None = Query(None),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_roles("RECYCLER", "ADMIN")),
    db: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """List inventory lots owned by the current recycler (ADMIN: all lots)."""
    query = select(InventoryLot)
    if user.role != "ADMIN":
        query = query.join(
            SortingRecord, SortingRecord.id == InventoryLot.sorting_record_id
        ).where(SortingRecord.sorter_user_id == user.id)
    if status_filter:
        query = query.where(InventoryLot.status == status_filter)
    if category_id:
        query = query.where(InventoryLot.category_id == category_id)

    total = (
        await db.execute(select(func.count()).select_from(query.subquery()))
    ).scalar_one()
    result = await db.execute(
        query.order_by(InventoryLot.created_at.desc()).offset(offset).limit(limit)
    )
    lots = list(result.scalars().all())
    return {
        "items": [InventoryLotRead.model_validate(lot) for lot in lots],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/lots/{lot_id}", response_model=InventoryLotRead)
async def get_inventory_lot(
    lot_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> InventoryLotRead:
    """Single lot detail — used by listing pages to resolve intake for traceability."""
    lot = await InventoryRepository.get_by_id(db, lot_id)
    if not lot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory lot not found",
        )
    return InventoryLotRead.model_validate(lot)
