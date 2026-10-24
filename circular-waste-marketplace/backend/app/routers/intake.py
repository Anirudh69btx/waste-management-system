"""Intake router — /api/v1/intake/..."""

import json
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile, status
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.limiter import limiter
from app.core.security import require_role, TokenPayload
from app.db.session import get_async_session
from app.schemas import (
    IntakeListResponse,
    QRCodeResponse,
    VerifyWeightRequest,
    VerifyWeightResponse,
    WasteIntakeResponse,
    WeightTicketAcknowledge,
    WeightTicketCreate,
    WeightTicketRead,
)
from app.services.intake import IntakeService
from app.services.weight_service import WeightService

router = APIRouter(prefix="/intake", tags=["Waste Intake"])


@router.get(
    "",
    response_model=IntakeListResponse,
    summary="List intake consignments (role-filtered, paginated)",
)
@router.get(
    "/",
    response_model=IntakeListResponse,
    include_in_schema=False,
)
async def list_intakes(
    status_filter: Optional[str] = Query(None, alias="status"),
    category_id: Optional[int] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    token: TokenPayload = Depends(require_role(["GENERATOR", "RECYCLER", "LOGISTICS", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> IntakeListResponse:
    """Paginated, role-aware list of waste intake consignments."""
    return await IntakeService(db).list_intakes(
        user=token,
        status_filter=status_filter,
        category_id=category_id,
        offset=offset,
        limit=limit,
    )


@router.post("/create", response_model=WasteIntakeResponse, status_code=status.HTTP_201_CREATED)
async def create_intake(
    category_id: int = Form(...),
    purity_grade: str = Form(...),
    declared_weight_kg: float = Form(..., gt=0),
    notes: str | None = Form(None),
    images: List[UploadFile] = File(default=[]),
    token: TokenPayload = Depends(require_role(["GENERATOR"])),
    db: AsyncSession = Depends(get_async_session),
) -> WasteIntakeResponse:
    """Submit a new waste consignment with photo evidence (multipart/form-data)."""
    return await IntakeService(db).create_intake(
        user_id=token.sub,
        category_id=category_id,
        purity_grade=purity_grade,
        declared_weight_kg=declared_weight_kg,
        notes=notes,
        image_files=images,
    )


@router.get("/{intake_id}", response_model=WasteIntakeResponse)
async def get_intake(
    intake_id: uuid.UUID,
    token: TokenPayload = Depends(require_role(["GENERATOR", "RECYCLER", "LOGISTICS", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> WasteIntakeResponse:
    """Fetch full intake manifest by ID."""
    return await IntakeService(db).get_by_id(intake_id)


@router.get("/{intake_id}/qr", response_model=QRCodeResponse)
async def get_qr_code(
    intake_id: uuid.UUID,
    token: TokenPayload = Depends(require_role(["GENERATOR", "RECYCLER", "LOGISTICS", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> QRCodeResponse:
    """Generate and return QR code data-URL for this intake."""
    return await IntakeService(db).generate_qr(intake_id)


@router.get("/scan/{batch_code}", response_model=WasteIntakeResponse)
async def scan_batch_code(
    batch_code: str,
    token: TokenPayload = Depends(require_role(["LOGISTICS", "RECYCLER", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> WasteIntakeResponse:
    """Look up intake by human-readable batch code (QR scan)."""
    return await IntakeService(db).get_by_batch_code(batch_code)


@router.post("/{intake_id}/verify-weight", response_model=VerifyWeightResponse)
async def verify_weight(
    intake_id: uuid.UUID,
    payload: VerifyWeightRequest,
    token: TokenPayload = Depends(require_role(["RECYCLER", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> VerifyWeightResponse:
    """Record physical scale weight and apply ±5% tolerance FSM transition."""
    return await IntakeService(db).verify_weight(intake_id, payload, operator_id=token.sub)


# ── Segment 2.2a Weight Ticket Endpoints ─────────────────────────────────────


@router.post(
    "/{intake_id}/weight-ticket",
    response_model=WeightTicketRead,
    status_code=status.HTTP_201_CREATED,
    summary="Record physical scale weight for a consignment (multipart or json)",
)
@limiter.limit("30/hour")
async def record_weight_ticket(
    intake_id: uuid.UUID,
    request: Request,
    token: TokenPayload = Depends(require_role(["LOGISTICS", "RECYCLER", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> WeightTicketRead:
    """
    Record weighbridge or digital scale measurement.
    Accepts multipart form with payload JSON string + photos[], or JSON body.
    Server computes net_weight_kg = gross - tare. Client net_weight is forbidden.
    """
    content_type = request.headers.get("content-type", "")
    photos: list[UploadFile] = []

    if "multipart/form-data" in content_type:
        form = await request.form()
        if "payload" in form:
            raw = form["payload"]
            data = json.loads(raw) if isinstance(raw, str) else raw
        else:
            data = {}
            for k, v in form.items():
                if k not in ("photos", "photos[]", "photo"):
                    data[k] = v

        for k in ("photos", "photos[]", "photo"):
            files = form.getlist(k)
            for f in files:
                if isinstance(f, UploadFile):
                    photos.append(f)
    else:
        data = await request.json()

    try:
        payload = WeightTicketCreate.model_validate(data)
    except ValidationError as err:
        raise RequestValidationError(err.errors())

    rid = request.headers.get("X-Request-ID")
    return await WeightService(db).record_weight_ticket(
        token, intake_id, payload, photo_files=photos, request_id=rid
    )


@router.get(
    "/{intake_id}/weight-ticket",
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


@router.post(
    "/{intake_id}/weight-ticket/acknowledge",
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
    """Supplier acknowledgment of recorded weight (confirm or dispute with notes)."""
    rid = request.headers.get("X-Request-ID")
    return await WeightService(db).acknowledge_weight(
        token, intake_id, payload, request_id=rid
    )
