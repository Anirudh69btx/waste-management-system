"""
Circular Waste Marketplace — Pickup Service
============================================
Business logic for scheduling, dispatching, and managing waste collection pickups.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.security import TokenPayload
from app.models import PickupRequest, PickupStatus, IntakeStatus, UserRole
from app.repositories import IntakeRepository, PickupRepository, UserRepository
from app.schemas.pickup_schemas import (
    DriverSummary,
    IntakeSummary,
    PickupRequestCreate,
    PickupRequestListResponse,
    PickupRequestRead,
    PickupRequestStatusUpdate,
)

logger = get_logger(__name__)

# Valid state machine transitions
_ALLOWED_TRANSITIONS: dict[str, list[str]] = {
    PickupStatus.REQUESTED.value: [
        PickupStatus.ACCEPTED.value,
        PickupStatus.CANCELLED.value,
        PickupStatus.FAILED.value,
    ],
    PickupStatus.ACCEPTED.value: [
        PickupStatus.EN_ROUTE.value,
        PickupStatus.CANCELLED.value,
        PickupStatus.FAILED.value,
    ],
    PickupStatus.EN_ROUTE.value: [
        PickupStatus.ARRIVED.value,
        PickupStatus.FAILED.value,
    ],
    PickupStatus.ARRIVED.value: [
        PickupStatus.PICKED_UP.value,
        PickupStatus.FAILED.value,
    ],
    PickupStatus.PICKED_UP.value: [
        PickupStatus.COMPLETED.value,
    ],
    PickupStatus.COMPLETED.value: [],
    PickupStatus.CANCELLED.value: [],
    PickupStatus.FAILED.value: [],
}


def _to_pickup_read(p: PickupRequest) -> PickupRequestRead:
    """Format SQLAlchemy PickupRequest entity to Pydantic read schema."""
    category_name = "Unknown"
    batch_code = "Unknown"
    intake_id = p.intake_id
    if p.intake:
        intake_id = p.intake.id
        batch_code = p.intake.batch_code
        if p.intake.category:
            category_name = p.intake.category.name

    intake_summary = IntakeSummary(
        id=intake_id,
        batch_code=batch_code,
        category_name=category_name,
    )

    driver_summary = None
    if p.assigned_driver:
        driver_summary = DriverSummary(
            id=p.assigned_driver.id,
            full_name=p.assigned_driver.full_name or p.assigned_driver.email,
        )

    return PickupRequestRead(
        id=p.id,
        intake_id=p.intake_id,
        requested_by_user_id=p.requested_by_user_id,
        assigned_driver_user_id=p.assigned_driver_user_id,
        scheduled_start=p.scheduled_start,
        scheduled_end=p.scheduled_end,
        actual_pickup_at=p.actual_pickup_at,
        status=p.status,
        cancellation_reason=p.cancellation_reason,
        failure_reason=p.failure_reason,
        notes=p.notes,
        request_id_correlation=p.request_id_correlation,
        created_at=p.created_at,
        updated_at=p.updated_at,
        intake_summary=intake_summary,
        driver_summary=driver_summary,
    )


class PickupService:
    """Service layer coordinating pickup request operations and lifecycle."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._pickup_repo = PickupRepository(db)
        self._intake_repo = IntakeRepository(db)
        self._user_repo = UserRepository(db)

    async def create_pickup_request(
        self,
        user: TokenPayload,
        payload: PickupRequestCreate,
        request_id: Optional[str] = None,
    ) -> PickupRequestRead:
        """
        Create a new pickup request for a submitted intake consignment.
        Allowed roles: GENERATOR, ADMIN.
        """
        if user.role not in [UserRole.GENERATOR.value, UserRole.ADMIN.value]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only GENERATOR or ADMIN can schedule a pickup.",
            )

        intake = await self._intake_repo.get_by_id(payload.intake_id)
        if not intake:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Intake {payload.intake_id} not found.",
            )

        # Ownership check: GENERATOR can only schedule their own intake
        if user.role == UserRole.GENERATOR.value:
            if not intake.supplier or str(intake.supplier.user_id) != str(user.sub):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Intake {payload.intake_id} not found.",
                )

        # Check intake status
        if intake.status.lower() != IntakeStatus.SUBMITTED.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot schedule pickup for intake in status '{intake.status}'. Must be 'submitted'.",
            )

        # Check for active pickup
        existing = await self._pickup_repo.get_active_by_intake(payload.intake_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A pickup request already exists for this intake.",
            )

        pickup = PickupRequest(
            id=uuid.uuid4(),
            intake_id=payload.intake_id,
            requested_by_user_id=uuid.UUID(user.sub),
            scheduled_start=payload.scheduled_start,
            scheduled_end=payload.scheduled_end,
            notes=payload.notes,
            status=PickupStatus.REQUESTED.value,
            request_id_correlation=request_id,
        )
        await self._pickup_repo.create(pickup)

        intake.status = IntakeStatus.PICKUP_REQUESTED.value
        await self._db.flush()

        logger.info(
            "pickup.created",
            pickup_id=str(pickup.id),
            intake_id=str(intake.id),
            requested_by_user_id=user.sub,
            actor_role=user.role,
            request_id=request_id,
        )
        await self._db.commit()

        loaded = await self._pickup_repo.get_by_id(pickup.id)
        return _to_pickup_read(loaded or pickup)

    async def assign_driver(
        self,
        user: TokenPayload,
        pickup_id: uuid.UUID,
        driver_id: uuid.UUID,
        request_id: Optional[str] = None,
    ) -> PickupRequestRead:
        """
        Assign a logistics driver to a requested pickup consignment.
        Allowed roles: ADMIN only.
        """
        if user.role != UserRole.ADMIN.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only ADMIN can assign drivers to pickups.",
            )

        pickup = await self._pickup_repo.get_by_id(pickup_id)
        if not pickup:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pickup {pickup_id} not found.",
            )

        if pickup.status != PickupStatus.REQUESTED.value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Pickup is in status '{pickup.status}', cannot assign.",
            )

        driver = await self._user_repo.get_by_id(driver_id)
        if not driver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Driver user {driver_id} not found.",
            )

        if driver.role != UserRole.LOGISTICS.value:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Assigned user must have LOGISTICS role.",
            )

        await self._pickup_repo.assign_driver(pickup, driver_id)
        if pickup.intake:
            pickup.intake.status = IntakeStatus.PICKUP_ASSIGNED.value
        await self._db.flush()

        logger.info(
            "pickup.status_changed",
            pickup_id=str(pickup.id),
            intake_id=str(pickup.intake_id),
            from_status=PickupStatus.REQUESTED.value,
            to_status=PickupStatus.ACCEPTED.value,
            actor_user_id=user.sub,
            actor_role=user.role,
            request_id=request_id,
        )
        await self._db.commit()

        loaded = await self._pickup_repo.get_by_id(pickup.id)
        return _to_pickup_read(loaded or pickup)

    async def update_status(
        self,
        user: TokenPayload,
        pickup_id: uuid.UUID,
        payload: PickupRequestStatusUpdate,
        request_id: Optional[str] = None,
    ) -> PickupRequestRead:
        """
        Transition pickup request along FSM.
        Strict role and ownership authorization checks enforced.
        """
        pickup = await self._pickup_repo.get_by_id(pickup_id)
        if not pickup:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pickup {pickup_id} not found.",
            )

        is_admin = user.role == UserRole.ADMIN.value
        is_assigned_driver = (
            user.role == UserRole.LOGISTICS.value
            and pickup.assigned_driver_user_id is not None
            and str(pickup.assigned_driver_user_id) == str(user.sub)
        )
        is_owner_supplier = (
            user.role == UserRole.GENERATOR.value
            and pickup.intake is not None
            and pickup.intake.supplier is not None
            and str(pickup.intake.supplier.user_id) == str(user.sub)
        )

        # RECYCLER role has zero permissions
        if user.role == UserRole.RECYCLER.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Recyclers cannot update pickup status.",
            )

        # Driver role attempting to update someone else's pickup
        if user.role == UserRole.LOGISTICS.value and not is_assigned_driver:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the assigned driver can update this pickup.",
            )

        # Supplier attempting to cancel after driver started transit or finished
        if is_owner_supplier:
            if payload.new_status != PickupStatus.CANCELLED.value:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Suppliers can only cancel pickup requests.",
                )
            if pickup.status not in [PickupStatus.REQUESTED.value, PickupStatus.ACCEPTED.value]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot cancel pickup after driver is en route or picked up.",
                )

        if not (is_admin or is_assigned_driver or is_owner_supplier):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this pickup status.",
            )

        # Enforce state machine transitions
        allowed_next = _ALLOWED_TRANSITIONS.get(pickup.status, [])
        if payload.new_status not in allowed_next:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Invalid status transition from '{pickup.status}' to '{payload.new_status}'.",
            )

        # Transition specific requirements
        if payload.new_status == PickupStatus.PICKED_UP.value:
            pickup.actual_pickup_at = datetime.now(timezone.utc)
            if pickup.intake:
                pickup.intake.status = IntakeStatus.PICKED_UP.value

        elif payload.new_status == PickupStatus.CANCELLED.value:
            if not payload.reason or not payload.reason.strip():
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Cancellation reason is required.",
                )
            if pickup.intake:
                pickup.intake.status = IntakeStatus.CANCELLED.value

        elif payload.new_status == PickupStatus.FAILED.value:
            if not payload.reason or not payload.reason.strip():
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Failure reason is required.",
                )
            # Revert intake back to submitted so generator can re-schedule
            if pickup.intake:
                pickup.intake.status = IntakeStatus.SUBMITTED.value

        from_status = pickup.status
        await self._pickup_repo.update_status(pickup, payload.new_status, reason=payload.reason)
        await self._db.flush()

        logger.info(
            "pickup.status_changed",
            pickup_id=str(pickup.id),
            intake_id=str(pickup.intake_id),
            from_status=from_status,
            to_status=payload.new_status,
            actor_user_id=user.sub,
            actor_role=user.role,
            request_id=request_id,
        )
        await self._db.commit()

        loaded = await self._pickup_repo.get_by_id(pickup.id)
        return _to_pickup_read(loaded or pickup)

    async def get_by_id(
        self,
        user: TokenPayload,
        pickup_id: uuid.UUID,
    ) -> PickupRequestRead:
        """Fetch single pickup request with role-aware privacy gating (404 on unowned)."""
        pickup = await self._pickup_repo.get_by_id(pickup_id)
        if not pickup:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pickup {pickup_id} not found.",
            )

        if user.role == UserRole.GENERATOR.value:
            if not pickup.intake or not pickup.intake.supplier or str(pickup.intake.supplier.user_id) != str(user.sub):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Pickup {pickup_id} not found.",
                )
        elif user.role == UserRole.LOGISTICS.value:
            if not pickup.assigned_driver_user_id or str(pickup.assigned_driver_user_id) != str(user.sub):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Pickup {pickup_id} not found.",
                )
        elif user.role == UserRole.RECYCLER.value:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pickup {pickup_id} not found.",
            )

        return _to_pickup_read(pickup)

    async def list_pickups(
        self,
        user: TokenPayload,
        status_filter: Optional[str] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> PickupRequestListResponse:
        """Role-filtered paginated list of pickup requests."""
        if user.role == UserRole.GENERATOR.value:
            items, total = await self._pickup_repo.list_for_supplier(
                uuid.UUID(user.sub), status_filter, offset, limit
            )
        elif user.role == UserRole.LOGISTICS.value:
            items, total = await self._pickup_repo.list_for_driver(
                uuid.UUID(user.sub), status_filter, offset, limit
            )
        elif user.role == UserRole.ADMIN.value:
            items, total = await self._pickup_repo.list_all(
                status_filter, offset, limit
            )
        else:
            return PickupRequestListResponse(items=[], total=0, limit=limit, offset=offset)

        read_items = [_to_pickup_read(p) for p in items]
        return PickupRequestListResponse(
            items=read_items,
            total=total,
            limit=limit,
            offset=offset,
        )
