"""Intake router — /api/v1/intake/..."""
from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_role, TokenPayload
from app.db.session import get_async_session
from app.schemas import (
    QRCodeResponse,
    VerifyWeightRequest,
    VerifyWeightResponse,
    WasteIntakeResponse,
)
from app.services.intake import IntakeService

router = APIRouter(prefix="/intake", tags=["Waste Intake"])


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
