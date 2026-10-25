"""Traceability router — /api/v1/traceability/...

Public and authenticated access to the immutable audit timeline for waste consignments.
"""
from __future__ import annotations

import uuid
from typing import Any
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.repositories.traceability_repository import TraceabilityRepository
from app.schemas.traceability_schemas import (
    TraceabilityEventRead,
    TraceabilityTimelineResponse,
)

router = APIRouter(prefix="/traceability", tags=["Traceability"])


@router.get(
    "/{batch_id}",
    response_model=TraceabilityTimelineResponse,
)
async def get_batch_timeline(
    batch_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
) -> TraceabilityTimelineResponse:
    """Retrieve full chronological append-only audit trail for an intake consignment."""
    events = await TraceabilityRepository.list_for_batch(db, batch_id)
    return TraceabilityTimelineResponse(
        batch_id=batch_id,
        events=[TraceabilityEventRead.model_validate(e) for e in events],
    )


@router.get(
    "/events/recent",
    response_model=list[TraceabilityEventRead],
)
async def list_recent_events(
    event_type: str = Query("sorting.completed"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_async_session),
) -> list[TraceabilityEventRead]:
    """List recent events by type."""
    events = await TraceabilityRepository.list_by_type(db, event_type, limit=limit)
    return [TraceabilityEventRead.model_validate(e) for e in events]
