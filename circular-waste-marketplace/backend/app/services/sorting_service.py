"""Sorting service — intake to certified inventory lots."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.waste_streams import category_to_stream
from app.models import WasteIntake, User
from app.models.sorting_record import SortingRecord
from app.models.inventory_lot import InventoryLot
from app.repositories.sorting_repository import SortingRepository
from app.repositories.inventory_repository import InventoryRepository
from app.schemas.sorting_schemas import SortingRecordCreate
from app.services.traceability_service import emit

logger = logging.getLogger(__name__)


class SortingService:
    @staticmethod
    async def create_sorting_record(
        user: User,
        payload: SortingRecordCreate,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> tuple[SortingRecord, list[InventoryLot]]:
        # 1. Assert user role in {RECYCLER, ADMIN}
        if user.role not in {"RECYCLER", "ADMIN"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only RECYCLER or ADMIN can create sorting records",
            )

        # 2. Load intake by payload.intake_id
        result = await session.execute(
            select(WasteIntake).where(WasteIntake.id == payload.intake_id)
        )
        intake = result.scalar_one_or_none()
        if not intake:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Waste intake not found",
            )

        # 3. Assert intake.status == "weighed"
        if intake.status != "weighed":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Intake status must be 'weighed' to sort (current: {intake.status})",
            )

        # 4. Assert no sorting record already exists for intake -> 409
        existing_records = await SortingRepository.get_by_intake(session, intake.id)
        if existing_records:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Sorting record already exists for this intake",
            )

        # 5. Validate weights: sorted + rejected <= input + 0.001
        if payload.sorted_weight_kg + payload.rejected_weight_kg > payload.input_weight_kg + Decimal("0.001"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="sorted_weight_kg + rejected_weight_kg cannot exceed input_weight_kg",
            )

        # 6. Assert sum of inventory_lots[].quantity_kg <= sorted_weight_kg + 0.001
        lots_total_kg = sum(lot.quantity_kg for lot in payload.inventory_lots)
        if lots_total_kg > payload.sorted_weight_kg + Decimal("0.001"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Sum of inventory lots quantity exceeds sorted_weight_kg",
            )

        # 7. Stream compatibility: each inventory lot category_id must belong to the intake's category stream
        intake_stream = category_to_stream(intake.category_id)
        for lot in payload.inventory_lots:
            lot_stream = category_to_stream(lot.category_id)
            if lot_stream != intake_stream:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Lot category {lot.category_id} ({lot_stream}) is incompatible with intake stream ({intake_stream})",
                )

        # 8. Create SortingRecord
        record = await SortingRepository.create(
            session,
            intake_id=intake.id,
            sorter_user_id=user.id,
            input_weight_kg=payload.input_weight_kg,
            sorted_weight_kg=payload.sorted_weight_kg,
            rejected_weight_kg=payload.rejected_weight_kg,
            contamination_percent=payload.contamination_percent,
            sort_grade=payload.sort_grade,
            moisture_percent=payload.moisture_percent,
            notes=payload.notes,
            photos=[],
            request_id_correlation=request_id,
        )

        # 9. Create InventoryLots
        year = datetime.now(timezone.utc).year
        count_res = await session.execute(select(func.count(InventoryLot.id)))
        base_seq = count_res.scalar_one()

        created_lots: list[InventoryLot] = []
        for idx, lot_in in enumerate(payload.inventory_lots, start=1):
            seq = base_seq + idx
            lot_code = f"LOT-{year}-{seq:06d}"
            lot = await InventoryRepository.create(
                session,
                lot_code=lot_code,
                intake_id=intake.id,
                sorting_record_id=record.id,
                category_id=lot_in.category_id,
                quantity_kg=lot_in.quantity_kg,
                available_kg=lot_in.quantity_kg,
                grade=lot_in.grade,
                contamination_percent=lot_in.contamination_percent,
                moisture_percent=lot_in.moisture_percent,
                status="available",
                hub_location=lot_in.hub_location,
            )
            created_lots.append(lot)

        # 10. Update intake.status -> "sorted", intake.metadata["sorting"] = {...}
        from_status = intake.status
        intake.status = "sorted"
        intake_meta = dict(intake.metadata_json or {})
        intake_meta["sorting"] = {
            "sorting_record_id": str(record.id),
            "sorted_at": datetime.now(timezone.utc).isoformat(),
            "sort_grade": payload.sort_grade,
            "lots_count": len(created_lots),
            "sorted_weight_kg": float(payload.sorted_weight_kg),
        }
        intake.metadata_json = intake_meta
        flag_modified(intake, "metadata_json")

        # 11. Emit traceability event sorting.completed
        await emit(
            session,
            batch_id=intake.id,
            event_type="sorting.completed",
            actor=user,
            from_status=from_status,
            to_status="sorted",
            metadata={
                "sorting_record_id": str(record.id),
                "sorted_weight_kg": float(payload.sorted_weight_kg),
                "rejected_weight_kg": float(payload.rejected_weight_kg),
                "sort_grade": payload.sort_grade,
                "lots_count": len(created_lots),
            },
            request_id=request_id,
        )

        await session.commit()
        await session.refresh(record)
        for lot in created_lots:
            await session.refresh(lot)

        logger.info(
            "Sorting completed for intake %s: record=%s, lots=%d",
            intake.id,
            record.id,
            len(created_lots),
            extra={"request_id": request_id},
        )
        return record, created_lots

    @staticmethod
    async def list_sorting_records(
        user: User,
        filters: dict[str, Any] | None,
        pagination: dict[str, int] | None,
        session: AsyncSession,
    ) -> tuple[list[SortingRecord], int]:
        f = dict(filters or {})
        if user.role != "ADMIN":
            f["sorter_user_id"] = user.id
        return await SortingRepository.list_all(session, filters=f, pagination=pagination)
