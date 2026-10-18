"""Sorting router — /api/v1/sorting/..."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import require_role, TokenPayload
from app.db.session import get_async_session
from app.schemas import SortingRecordRequest, SortingRecordResponse, InventoryLotResponse
from app.services.sorting import SortingService

router = APIRouter(prefix="/sorting", tags=["Sorting"])

@router.post("/process", response_model=SortingRecordResponse, status_code=status.HTTP_201_CREATED)
async def process_sorting(
    payload: SortingRecordRequest,
    token: TokenPayload = Depends(require_role(["RECYCLER", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> SortingRecordResponse:
    """Log a sorting run and compute yield efficiency."""
    return await SortingService(db).record_sorting(payload, operator_id=token.sub)

@router.get("/inventory/lots", response_model=list[InventoryLotResponse])
async def list_inventory_lots(
    category_id: int | None = None,
    status: str | None = None,
    token: TokenPayload = Depends(require_role(["GENERATOR", "RECYCLER", "LOGISTICS", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> list[InventoryLotResponse]:
    """List certified inventory lots with optional filtering."""
    return await SortingService(db).list_lots(category_id=category_id, status_filter=status)
