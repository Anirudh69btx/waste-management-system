"""
Circular Waste Marketplace — Weight Service
============================================
Physical scale weight verification, discrepancy detection, and supplier acknowledgment.
"""
from __future__ import annotations

import asyncio
import hashlib
import io
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.security import TokenPayload
from app.core.settings import get_settings
from app.models import IntakeStatus, UserRole, WeightTicket, WeightMethod
from app.repositories import IntakeRepository, WeightTicketRepository
from app.schemas.weight_ticket_schemas import (
    WeightTicketAcknowledge,
    WeightTicketCreate,
    WeightTicketRead,
)

logger = get_logger(__name__)
settings = get_settings()

_ALLOWED_PHOTO_MIMES = {"image/jpeg", "image/png", "image/webp"}


async def _save_scale_photo(
    intake_id: uuid.UUID,
    raw_bytes: bytes,
    content_hash: str,
    index: int,
) -> str:
    """Save scale photo to storage without EXIF."""
    from PIL import Image as PilImg

    pil = PilImg.open(io.BytesIO(raw_bytes)).convert("RGB")
    clean_buf = io.BytesIO()
    pil.save(clean_buf, format="WEBP", quality=85)
    clean_bytes = clean_buf.getvalue()

    filename = f"scale_{intake_id}_{content_hash[:12]}_{index:02d}.webp"
    upload_dir = Path(settings.local_upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    filepath = upload_dir / filename

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, filepath.write_bytes, clean_bytes)

    return f"/static/uploads/{filename}"


def _to_weight_read(t: WeightTicket) -> WeightTicketRead:
    """Convert WeightTicket SQLAlchemy entity to WeightTicketRead schema."""
    photo_urls = list(t.photo_paths or [])
    return WeightTicketRead(
        id=t.id,
        intake_id=t.intake_id,
        pickup_request_id=t.pickup_request_id,
        weight_method=t.weight_method,
        gross_weight_kg=float(t.gross_weight_kg),
        tare_weight_kg=float(t.tare_weight_kg),
        net_weight_kg=float(t.net_weight_kg),
        scale_id=t.scale_id,
        scale_calibration_date=t.scale_calibration_date,
        photo_urls=photo_urls,
        recorded_by_user_id=t.recorded_by_user_id,
        recorded_at=t.recorded_at,
        discrepancy_flag=t.discrepancy_flag,
        discrepancy_notes=t.discrepancy_notes,
        notes=t.notes,
        supplier_confirmed_at=t.supplier_confirmed_at,
        supplier_dispute_notes=t.supplier_dispute_notes,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


class WeightService:
    """Business logic for physical weight capture and acknowledgment."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._intake_repo = IntakeRepository(db)
        self._weight_repo = WeightTicketRepository(db)

    async def record_weight_ticket(
        self,
        user: TokenPayload,
        intake_id: uuid.UUID,
        payload: WeightTicketCreate,
        photo_files: list[UploadFile],
        request_id: Optional[str] = None,
    ) -> WeightTicketRead:
        """
        Record physical weighbridge or digital scale measurement.
        Server computes net_weight_kg = gross - tare.
        """
        # Authorization: LOGISTICS, RECYCLER, ADMIN allowed. GENERATOR forbidden.
        if user.role not in [UserRole.LOGISTICS.value, UserRole.RECYCLER.value, UserRole.ADMIN.value]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Generators are not authorized to record physical scale weights.",
            )

        intake = await self._intake_repo.get_by_id(intake_id)
        if not intake:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Intake {intake_id} not found.",
            )

        # Intake must be picked_up before weighing
        if intake.status.lower() != IntakeStatus.PICKED_UP.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot record weight for intake in status '{intake.status}'. Must be 'picked_up'.",
            )

        # If user is LOGISTICS driver, verify assignment
        if user.role == UserRole.LOGISTICS.value and intake.pickup_request:
            if (
                intake.pickup_request.assigned_driver_user_id
                and str(intake.pickup_request.assigned_driver_user_id) != str(user.sub)
            ):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the assigned driver can record weight for this consignment.",
                )

        # Compute net weight server-side
        gross = Decimal(str(payload.gross_weight_kg))
        tare = Decimal(str(payload.tare_weight_kg))
        net = gross - tare

        if net <= 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Gross weight must be greater than tare weight (net must be > 0).",
            )

        if abs(net - (gross - tare)) >= Decimal("0.001"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Net weight calculation constraint violated.",
            )

        # Method-specific validation
        if payload.weight_method in [WeightMethod.DIGITAL_SCALE.value, WeightMethod.WEIGHBRIDGE.value]:
            if not payload.scale_id or not payload.scale_id.strip():
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="scale_id is required for digital_scale and weighbridge methods.",
                )
            if not payload.scale_calibration_date:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="scale_calibration_date is required for digital_scale and weighbridge methods.",
                )
            if not photo_files or len(photo_files) < 1:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="At least one scale photo is required for digital_scale and weighbridge.",
                )

        discrepancy_notes = None
        if payload.weight_method in [WeightMethod.MANUAL.value, WeightMethod.DEMO.value]:
            discrepancy_notes = "Unverified weight recorded via manual/demo method."

        # Compute discrepancy flag (>15% difference from declared)
        declared = Decimal(str(intake.declared_weight_kg))
        diff = abs(net - declared)
        diff_pct = (diff / declared) * Decimal("100")
        discrepancy_flag = diff_pct > Decimal("15.0")

        if discrepancy_flag:
            notes_addon = (
                f"Weight discrepancy exceeds 15%: declared {declared:.2f} kg vs "
                f"verified {net:.2f} kg ({diff_pct:.1f}% difference)."
            )
            discrepancy_notes = f"{discrepancy_notes} | {notes_addon}" if discrepancy_notes else notes_addon

        # Process and save scale photos
        photo_paths: list[str] = []
        for idx, upload in enumerate(photo_files):
            raw = await upload.read()
            if len(raw) > settings.max_upload_bytes:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Photo '{upload.filename}' exceeds {settings.max_upload_file_size_mb} MB limit.",
                )
            c_hash = hashlib.sha256(raw).hexdigest()
            path = await _save_scale_photo(intake_id, raw, c_hash, idx)
            photo_paths.append(path)

        pickup_req_id = payload.pickup_request_id
        if not pickup_req_id and intake.pickup_request:
            pickup_req_id = intake.pickup_request.id

        ticket = WeightTicket(
            id=uuid.uuid4(),
            intake_id=intake_id,
            pickup_request_id=pickup_req_id,
            weight_method=payload.weight_method,
            gross_weight_kg=gross,
            tare_weight_kg=tare,
            net_weight_kg=net,
            scale_id=payload.scale_id,
            scale_calibration_date=payload.scale_calibration_date,
            photo_paths=photo_paths,
            recorded_by_user_id=uuid.UUID(user.sub),
            discrepancy_flag=discrepancy_flag,
            discrepancy_notes=discrepancy_notes,
            notes=payload.notes,
        )
        await self._weight_repo.create(ticket)

        # Update intake status and verified weight
        intake.status = IntakeStatus.WEIGHED.value
        intake.verified_weight_kg = float(net)
        intake.weight_discrepancy_kg = float(net - declared)
        intake.verified_at = datetime.now(timezone.utc)
        intake.scale_operator_id = uuid.UUID(user.sub)
        await self._db.flush()

        logger.info(
            "weight.recorded",
            ticket_id=str(ticket.id),
            intake_id=str(intake_id),
            net_weight_kg=float(net),
            recorded_by_user_id=user.sub,
            discrepancy_flag=discrepancy_flag,
            request_id=request_id,
        )
        await self._db.commit()

        from app.services import rewards_service
        await rewards_service.on_intake_weighed(intake, self._db, request_id=request_id)

        loaded = await self._weight_repo.get_by_id(ticket.id)
        return _to_weight_read(loaded or ticket)

    async def acknowledge_weight(
        self,
        user: TokenPayload,
        intake_id: uuid.UUID,
        payload: WeightTicketAcknowledge,
        request_id: Optional[str] = None,
    ) -> WeightTicketRead:
        """
        Supplier confirms or disputes recorded scale weight.
        Allowed roles: GENERATOR (owner) or ADMIN.
        """
        intake = await self._intake_repo.get_by_id(intake_id)
        if not intake:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Intake {intake_id} not found.",
            )

        # Ownership check: 404 for wrong owner to prevent resource discovery
        if user.role == UserRole.GENERATOR.value:
            if not intake.supplier or str(intake.supplier.user_id) != str(user.sub):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Intake {intake_id} not found.",
                )
        elif user.role != UserRole.ADMIN.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only supplier or admin can acknowledge recorded weight.",
            )

        if intake.status.lower() != IntakeStatus.WEIGHED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot acknowledge weight when consignment is in status '{intake.status}'. Must be 'weighed'.",
            )

        ticket = await self._weight_repo.get_by_intake(intake_id)
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No weight ticket found for intake {intake_id}.",
            )

        if payload.confirmed:
            ticket.supplier_confirmed_at = datetime.now(timezone.utc)
        else:
            if not payload.dispute_notes or len(payload.dispute_notes.strip()) < 10:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="dispute_notes must be at least 10 characters long when disputing weight.",
                )
            ticket.supplier_dispute_notes = payload.dispute_notes.strip()

        await self._db.flush()

        logger.info(
            "weight.acknowledged",
            intake_id=str(intake_id),
            ticket_id=str(ticket.id),
            confirmed=payload.confirmed,
            actor_user_id=user.sub,
            request_id=request_id,
        )
        await self._db.commit()

        loaded = await self._weight_repo.get_by_id(ticket.id)
        return _to_weight_read(loaded or ticket)

    async def get_weight_ticket(
        self,
        user: TokenPayload,
        intake_id: uuid.UUID,
    ) -> WeightTicketRead:
        """Fetch latest verified weight ticket for intake consignment."""
        intake = await self._intake_repo.get_by_id(intake_id)
        if not intake:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Intake {intake_id} not found.",
            )

        if user.role == UserRole.GENERATOR.value:
            if not intake.supplier or str(intake.supplier.user_id) != str(user.sub):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Intake {intake_id} not found.",
                )

        ticket = await self._weight_repo.get_by_intake(intake_id)
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No weight ticket found for intake {intake_id}.",
            )

        return _to_weight_read(ticket)
