"""Weight ticket router — /api/v1/weight-tickets/...

Thin HTTP layer delegating all business logic to WeightService.
Zero business logic here — only DI wiring + schema validation.
"""

import uuid
from typing import List

from fastapi import APIRouter, Depends, File, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_role, TokenPayload
from app.db.session import get_async_session
from app.schemas.weight_ticket_schemas import (
    WeightTicketAcknowledge,
    WeightTicketCreate,
    WeightTicketRead,
)
from app.services.weight_service import WeightService

router = APIRouter(prefix="/weight-tickets", tags=["Weight Tickets"])


@router.post(
    "/{intake_id}",
    response_model=WeightTicketRead,
    status_code=status.HTTP_201_CREATED,
    summary="Record physical scale weight for a picked-up intake consignment",
)
async def record_weight_ticket(
    intake_id: uuid.UUID,
    payload: WeightTicketCreate,
    request: Request,
    photos: List[UploadFile] = File(default=[]),
    token: TokenPayload = Depends(require_role(["LOGISTICS", "RECYCLER", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> WeightTicketRead:
    """Record weighbridge or digital scale measurement. Server computes net = gross - tare."""
    rid = request.headers.get("X-Request-ID")
    return await WeightService(db).record_weight_ticket(
        token, intake_id, payload, photo_files=photos, request_id=rid
    )


@router.post(
    "/{intake_id}/acknowledge",
    response_model=WeightTicketRead,
    summary="Supplier confirms or disputes recorded scale weight",
)
async def acknowledge_weight(
    intake_id: uuid.UUID,
    payload: WeightTicketAcknowledge,
    request: Request,
    token: TokenPayload = Depends(require_role(["GENERATOR", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> WeightTicketRead:
    """Supplier acknowledgment of recorded weight. Confirm or dispute with notes."""
    rid = request.headers.get("X-Request-ID")
    return await WeightService(db).acknowledge_weight(
        token, intake_id, payload, request_id=rid
    )


@router.get(
    "/{intake_id}",
    response_model=WeightTicketRead,
    summary="Get the latest weight ticket for an intake consignment",
)
async def get_weight_ticket(
    intake_id: uuid.UUID,
    token: TokenPayload = Depends(require_role(["GENERATOR", "LOGISTICS", "RECYCLER", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> WeightTicketRead:
    """Fetch latest verified weight ticket for intake consignment."""
    return await WeightService(db).get_weight_ticket(token, intake_id)
