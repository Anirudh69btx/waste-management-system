"""Sorting router — /api/v1/sorting/...

Thin HTTP layer delegating sorting runs and inventory lot creation to services.
"""
from __future__ import annotations

import uuid
from typing import Any
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.dependencies.auth import get_current_active_user, require_roles
from app.models import User, WasteIntake
from app.repositories.inventory_repository import InventoryRepository
from app.schemas.sorting_schemas import (
    SortingRecordCreate,
    SortingRecordRead,
    InventoryLotRead,
)
from app.services.sorting_service import SortingService

router = APIRouter(prefix="/sorting", tags=["Sorting"])


@router.post(
    "/process",
    status_code=status.HTTP_201_CREATED,
)
async def create_sorting_record(
    payload: SortingRecordCreate,
    request: Request,
    user: User = Depends(require_roles("RECYCLER", "ADMIN")),
    db: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """Execute sorting run on a weighed consignment and generate certified inventory lots."""
    request_id = request.headers.get("x-request-id")
    record, lots = await SortingService.create_sorting_record(
        user=user,
        payload=payload,
        session=db,
        request_id=request_id,
    )
    return {
        "record": SortingRecordRead.model_validate(record),
        "inventory_lots": [InventoryLotRead.model_validate(lot) for lot in lots],
    }


@router.get("/records")
async def list_sorting_records(
    intake_id: uuid.UUID | None = Query(None),
    sort_grade: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """List sorting audit records."""
    filters = {}
    if intake_id:
        filters["intake_id"] = intake_id
    if sort_grade:
        filters["sort_grade"] = sort_grade

    pagination = {"skip": (page - 1) * page_size, "limit": page_size}
    records, total = await SortingService.list_sorting_records(
        user=user, filters=filters, pagination=pagination, session=db
    )
    return {
        "items": [SortingRecordRead.model_validate(r) for r in records],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/inventory/lots")
async def list_inventory_lots(
    category_id: int | None = Query(None),
    grade: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """List certified inventory lots."""
    filters = {}
    if category_id:
        filters["category_id"] = category_id
    if grade:
        filters["grade"] = grade

    pagination = {"skip": (page - 1) * page_size, "limit": page_size}

    if status_filter and status_filter != "available":
        filters["status"] = status_filter
        lots, total = await InventoryRepository.list_for_seller(
            session=db, seller_user_id=user.id, filters=filters, pagination=pagination
        )
    else:
        lots, total = await InventoryRepository.list_available(
            session=db, filters=filters, pagination=pagination
        )

    return {
        "items": [InventoryLotRead.model_validate(l) for l in lots],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/intakes/unprocessed")
async def list_unprocessed_intakes(
    user: User = Depends(require_roles("RECYCLER", "ADMIN")),
    db: AsyncSession = Depends(get_async_session),
) -> list[dict[str, Any]]:
    """List weighed consignments awaiting physical sorting."""
    stmt = (
        select(WasteIntake)
        .where(WasteIntake.status == "weighed")
        .order_by(WasteIntake.created_at.asc())
        .limit(50)
    )
    result = await db.execute(stmt)
    intakes = result.scalars().all()
    return [
        {
            "id": str(i.id),
            "batch_code": i.batch_code,
            "category_id": i.category_id,
            "purity_grade": str(i.purity_grade.value) if hasattr(i.purity_grade, "value") else str(i.purity_grade),
            "declared_weight_kg": i.declared_weight_kg,
            "verified_weight_kg": i.verified_weight_kg,
            "status": i.status,
            "created_at": i.created_at.isoformat() if i.created_at else None,
        }
        for i in intakes
    ]
