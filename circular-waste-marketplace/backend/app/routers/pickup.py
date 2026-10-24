"""Pickup router — /api/v1/pickups/...

Thin HTTP layer delegating all business logic to PickupService.
Zero business logic here — only DI wiring + schema validation.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.limiter import limiter
from app.core.security import require_role, TokenPayload
from app.db.session import get_async_session
from app.schemas.pickup_schemas import (
    PickupRequestAssign,
    PickupRequestCreate,
    PickupRequestListResponse,
    PickupRequestRead,
    PickupRequestStatusUpdate,
)
from app.services.pickup_service import PickupService

router = APIRouter(prefix="/pickups", tags=["Pickup Requests"])


@router.post(
    "",
    response_model=PickupRequestRead,
    status_code=status.HTTP_201_CREATED,
    summary="Schedule a pickup for a submitted intake consignment",
)
@limiter.limit("20/hour")
async def create_pickup(
    payload: PickupRequestCreate,
    request: Request,
    token: TokenPayload = Depends(require_role(["GENERATOR", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> PickupRequestRead:
    """Create a new pickup request. Only GENERATOR (owner) or ADMIN allowed. Rate limit: 20/hr."""
    rid = request.headers.get("X-Request-ID")
    return await PickupService(db).create_pickup_request(token, payload, request_id=rid)


@router.get(
    "",
    response_model=PickupRequestListResponse,
    summary="List pickup requests (role-filtered, paginated)",
)
@router.get(
    "/",
    response_model=PickupRequestListResponse,
    include_in_schema=False,
)
async def list_pickups(
    status_filter: Optional[str] = Query(None, alias="status"),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    token: TokenPayload = Depends(require_role(["GENERATOR", "LOGISTICS", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> PickupRequestListResponse:
    """Role-filtered paginated list. GENERATOR sees own, LOGISTICS sees assigned, ADMIN sees all."""
    return await PickupService(db).list_pickups(token, status_filter, offset, limit)


@router.get(
    "/{pickup_id}",
    response_model=PickupRequestRead,
    summary="Get pickup request detail",
)
async def get_pickup(
    pickup_id: uuid.UUID,
    token: TokenPayload = Depends(require_role(["GENERATOR", "LOGISTICS", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> PickupRequestRead:
    """Fetch single pickup request with role-aware privacy gating."""
    return await PickupService(db).get_by_id(token, pickup_id)


@router.patch(
    "/{pickup_id}/status",
    response_model=PickupRequestRead,
    summary="Transition pickup status (FSM)",
)
async def update_pickup_status(
    pickup_id: uuid.UUID,
    payload: PickupRequestStatusUpdate,
    request: Request,
    token: TokenPayload = Depends(require_role(["GENERATOR", "LOGISTICS", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> PickupRequestRead:
    """Advance pickup FSM state. Role-specific transitions enforced."""
    rid = request.headers.get("X-Request-ID")
    return await PickupService(db).update_status(token, pickup_id, payload, request_id=rid)


@router.patch(
    "/{pickup_id}/assign",
    response_model=PickupRequestRead,
    summary="Assign logistics driver to pickup (ADMIN only)",
)
@router.post(
    "/{pickup_id}/assign",
    response_model=PickupRequestRead,
    include_in_schema=False,
)
async def assign_driver(
    pickup_id: uuid.UUID,
    payload: PickupRequestAssign,
    request: Request,
    token: TokenPayload = Depends(require_role(["ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> PickupRequestRead:
    """Assign a LOGISTICS driver to a requested pickup consignment."""
    rid = request.headers.get("X-Request-ID")
    return await PickupService(db).assign_driver(
        token, pickup_id, payload.driver_user_id, request_id=rid
    )
