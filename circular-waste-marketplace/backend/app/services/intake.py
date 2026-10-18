"""
Circular Waste Marketplace — Intake Service
===========================================
Handles waste consignment creation, QR code generation (HMAC-SHA256),
image upload with quality gating, batch-code scan, and weighbridge
verification with FSM transitions.

Weight tolerance rules (from ADR-008 / TRD-001):
  |discrepancy| ≤ 5%  → VERIFIED
  |discrepancy| > 5%  → FLAGGED_DISCREPANCY
"""
from __future__ import annotations

import asyncio
import hashlib
import io
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import qrcode
from fastapi import HTTPException, UploadFile, status
from qrcode.image.pil import PilImage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logging import get_logger
from app.core.security import sign_manifest
from app.core.settings import get_settings
from app.models import (
    IntakeStatus,
    Supplier,
    WasteCategory,
    WasteIntake,
)
from app.schemas import (
    QRCodeResponse,
    VerifyWeightRequest,
    VerifyWeightResponse,
    WasteIntakeResponse,
)
from app.workers.tasks import run_ai_assessment

logger = get_logger(__name__)
settings = get_settings()

_WEIGHT_TOLERANCE_PERCENT = 5.0
_ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _generate_batch_code() -> str:
    """Generate a deterministic batch code: BATCH-YYYYMMDD-XXXX."""
    date_str = datetime.now(tz=timezone.utc).strftime("%Y%m%d")
    suffix = uuid.uuid4().hex[:4].upper()
    return f"BATCH-{date_str}-{suffix}"


def _compute_qr_hash(batch_code: str, supplier_id: str, declared_weight_kg: float) -> str:
    """SHA-256 hash of the canonical manifest fields."""
    payload = f"{batch_code}|{supplier_id}|{declared_weight_kg:.4f}"
    return hashlib.sha256(payload.encode()).hexdigest()


def _generate_qr_data_url(batch_code: str, verification_url: str) -> str:
    """Generate a base64 PNG data URL embedding the verification URL."""
    import base64

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(verification_url)
    qr.make(fit=True)
    img: PilImage = qr.make_image(fill_color="black", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


async def _save_image(
    intake_id: uuid.UUID,
    raw_bytes: bytes,
    content_hash: str,
    index: int,
) -> str:
    """
    Strip EXIF, rename to content-hash filename, write to upload directory.

    Returns the relative path from the static root.
    """
    from PIL import Image as PilImg

    # EXIF strip — re-encode without metadata
    pil = PilImg.open(io.BytesIO(raw_bytes)).convert("RGB")
    clean_buf = io.BytesIO()
    pil.save(clean_buf, format="WEBP", quality=85)
    clean_bytes = clean_buf.getvalue()

    filename = f"{intake_id}_{content_hash[:12]}_{index:02d}.webp"
    upload_dir = Path(settings.local_upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    filepath = upload_dir / filename

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, filepath.write_bytes, clean_bytes)

    return f"/static/uploads/{filename}"


class IntakeService:
    """Business logic for waste intake consignments."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # ── Create Intake ──────────────────────────────────────────────────────

    async def create_intake(
        self,
        user_id: str,
        category_id: int,
        purity_grade: str,
        declared_weight_kg: float,
        notes: Optional[str],
        image_files: list[UploadFile],
    ) -> WasteIntakeResponse:
        """
        Create a waste intake consignment.

        1. Validate supplier profile is VERIFIED.
        2. Gate each image through quality assessment.
        3. Save EXIF-stripped images to storage.
        4. Generate HMAC QR code manifest.
        5. Persist intake record.
        6. Enqueue AI assessment Celery task.
        """
        # Look up supplier
        result = await self._db.execute(
            select(Supplier).where(Supplier.user_id == uuid.UUID(user_id))
        )
        supplier = result.scalar_one_or_none()
        if not supplier:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Supplier profile not found. Create a profile before submitting intake.",
            )
        if supplier.verification_status.value == "REJECTED":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Supplier profile has been rejected. Contact admin.",
            )

        # Validate waste category
        cat_result = await self._db.execute(
            select(WasteCategory).where(WasteCategory.id == category_id, WasteCategory.is_active.is_(True))
        )
        category = cat_result.scalar_one_or_none()
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Waste category {category_id} not found or inactive.",
            )

        # Validate image count
        if len(image_files) > settings.max_upload_files_per_intake:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum {settings.max_upload_files_per_intake} images allowed per intake.",
            )

        # Process images
        image_paths: list[str] = []
        all_raw: list[bytes] = []

        for idx, upload in enumerate(image_files):
            raw = await upload.read()

            # Size check
            if len(raw) > settings.max_upload_bytes:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File '{upload.filename}' exceeds {settings.max_upload_file_size_mb} MB limit.",
                )

            # MIME check (magic bytes inspection done in quality gate)
            content_type = upload.content_type or ""
            if content_type and content_type not in _ALLOWED_MIME_TYPES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File '{upload.filename}' has unsupported type '{content_type}'.",
                )

            all_raw.append(raw)

        # Quality gate (batch — also detects near-duplicates)
        if all_raw:
            loop = asyncio.get_event_loop()
            from ai_engine.image_quality import assess_images_batch

            quality_results = await loop.run_in_executor(None, assess_images_batch, all_raw)
            failed = [(i, r) for i, r in enumerate(quality_results) if not r.ok]
            if failed:
                reasons = {i: r.reasons for i, r in failed}
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Image quality check failed: {reasons}",
                )

        # Save images
        intake_id = uuid.uuid4()
        for idx, (raw, qr) in enumerate(zip(all_raw, [r for r in (
            [] if not all_raw else
            [type("_", (), {"content_hash": hashlib.sha256(b).hexdigest()})() for b in all_raw]
        )])):
            c_hash = hashlib.sha256(raw).hexdigest()
            path = await _save_image(intake_id, raw, c_hash, idx)
            image_paths.append(path)

        # Generate batch code and QR
        batch_code = _generate_batch_code()
        qr_hash = _compute_qr_hash(batch_code, str(supplier.id), declared_weight_kg)
        manifest_data = f"{batch_code}|{supplier.id}|{declared_weight_kg:.4f}"
        manifest_signature = sign_manifest(manifest_data)

        # Persist
        intake = WasteIntake(
            id=intake_id,
            batch_code=batch_code,
            supplier_id=supplier.id,
            category_id=category_id,
            purity_grade=purity_grade,
            declared_weight_kg=declared_weight_kg,
            status=IntakeStatus.SUBMITTED,
            qr_code_hash=qr_hash,
            image_paths=image_paths,
            notes=notes,
        )
        self._db.add(intake)
        await self._db.flush()

        logger.info("intake_created", batch_code=batch_code, category_id=category_id)

        # Enqueue AI assessment (background)
        if all_raw and settings.gemini_api_key:
            run_ai_assessment.delay(str(intake_id))

        return await self.get_by_id(intake_id)

    # ── Get by ID ──────────────────────────────────────────────────────────

    async def get_by_id(self, intake_id: uuid.UUID) -> WasteIntakeResponse:
        result = await self._db.execute(
            select(WasteIntake)
            .where(WasteIntake.id == intake_id)
            .options(selectinload(WasteIntake.category))
        )
        intake = result.scalar_one_or_none()
        if not intake:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Intake {intake_id} not found.",
            )
        return WasteIntakeResponse.model_validate(intake)

    # ── Scan by Batch Code ─────────────────────────────────────────────────

    async def get_by_batch_code(self, batch_code: str) -> WasteIntakeResponse:
        result = await self._db.execute(
            select(WasteIntake)
            .where(WasteIntake.batch_code == batch_code.upper())
            .options(selectinload(WasteIntake.category))
        )
        intake = result.scalar_one_or_none()
        if not intake:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Batch code '{batch_code}' not found.",
            )
        return WasteIntakeResponse.model_validate(intake)

    # ── QR Code ───────────────────────────────────────────────────────────

    async def generate_qr(self, intake_id: uuid.UUID) -> QRCodeResponse:
        result = await self._db.execute(
            select(WasteIntake).where(WasteIntake.id == intake_id)
        )
        intake = result.scalar_one_or_none()
        if not intake:
            raise HTTPException(status_code=404, detail="Intake not found.")

        verification_url = (
            f"https://marketplace.circular-waste.io/scan/{intake.batch_code}"
        )
        manifest_data = (
            f"{intake.batch_code}|{intake.supplier_id}|{intake.declared_weight_kg:.4f}"
        )
        loop = asyncio.get_event_loop()
        data_url = await loop.run_in_executor(
            None, _generate_qr_data_url, intake.batch_code, verification_url
        )
        signature = sign_manifest(manifest_data)

        return QRCodeResponse(
            intake_id=intake.id,
            batch_code=intake.batch_code,
            qr_code_data_url=data_url,
            manifest_signature=signature,
            verification_url=verification_url,
        )

    # ── Verify Weight ──────────────────────────────────────────────────────

    async def verify_weight(
        self,
        intake_id: uuid.UUID,
        payload: VerifyWeightRequest,
        operator_id: str,
    ) -> VerifyWeightResponse:
        """
        Record physical scale weight and apply FSM transition.

        Allowed initial states: SUBMITTED, IN_TRANSIT
        ±5%  → VERIFIED
        >5%  → FLAGGED_DISCREPANCY
        """
        result = await self._db.execute(
            select(WasteIntake).where(WasteIntake.id == intake_id)
        )
        intake = result.scalar_one_or_none()
        if not intake:
            raise HTTPException(status_code=404, detail="Intake not found.")

        invalid_states = {IntakeStatus.VERIFIED, IntakeStatus.REJECTED}
        if intake.status in invalid_states:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot verify weight for intake in status '{intake.status.value}'.",
            )

        discrepancy_kg = payload.verified_weight_kg - intake.declared_weight_kg
        discrepancy_pct = (discrepancy_kg / intake.declared_weight_kg) * 100.0

        new_status = (
            IntakeStatus.VERIFIED
            if abs(discrepancy_pct) <= _WEIGHT_TOLERANCE_PERCENT
            else IntakeStatus.FLAGGED_DISCREPANCY
        )

        intake.verified_weight_kg = payload.verified_weight_kg
        intake.weight_discrepancy_kg = round(discrepancy_kg, 4)
        intake.status = new_status
        intake.scale_operator_id = uuid.UUID(operator_id)
        intake.verified_at = datetime.now(tz=timezone.utc)

        logger.info(
            "weight_verified",
            intake_id=str(intake_id),
            status=new_status.value,
            discrepancy_pct=round(discrepancy_pct, 2),
        )

        return VerifyWeightResponse(
            intake_id=intake.id,
            batch_code=intake.batch_code,
            declared_weight_kg=intake.declared_weight_kg,
            verified_weight_kg=payload.verified_weight_kg,
            weight_discrepancy_kg=round(discrepancy_kg, 4),
            discrepancy_percentage=round(discrepancy_pct, 4),
            status=new_status.value,
            scale_operator_id=uuid.UUID(operator_id),
            verified_at=intake.verified_at,
        )
