"""
Circular Waste Marketplace — Pickup Schemas
============================================
Pydantic v2 validation and serialization schemas for pickup requests and dispatch.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class _Base(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class PickupRequestCreate(_Base):
    """Payload to request waste consignment pickup."""
    intake_id: uuid.UUID
    scheduled_start: datetime
    scheduled_end: datetime
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_times(self) -> "PickupRequestCreate":
        now = datetime.now(timezone.utc)
        start = self.scheduled_start
        end = self.scheduled_end

        # Ensure timezone-aware comparison
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)

        if end <= start:
            raise ValueError("scheduled_end must be greater than scheduled_start")
        if start <= now:
            raise ValueError("scheduled_start must be in the future")
        if start > now + timedelta(days=30):
            raise ValueError("scheduled_start must be within 30 days")

        return self


class PickupRequestAssign(_Base):
    """Payload for admin to assign driver to pickup request."""
    driver_user_id: uuid.UUID


class PickupRequestStatusUpdate(_Base):
    """Payload to transition pickup request FSM state."""
    new_status: Literal[
        "requested",
        "accepted",
        "en_route",
        "arrived",
        "picked_up",
        "completed",
        "cancelled",
        "failed",
    ]
    reason: Optional[str] = None


class IntakeSummary(_Base):
    id: uuid.UUID
    batch_code: str
    category_name: str


class DriverSummary(_Base):
    id: uuid.UUID
    full_name: str


class PickupRequestRead(_Base):
    """Full detail view of a scheduled pickup consignment."""
    id: uuid.UUID
    intake_id: uuid.UUID
    requested_by_user_id: uuid.UUID
    assigned_driver_user_id: Optional[uuid.UUID] = None
    scheduled_start: datetime
    scheduled_end: datetime
    actual_pickup_at: Optional[datetime] = None
    status: str
    cancellation_reason: Optional[str] = None
    failure_reason: Optional[str] = None
    notes: Optional[str] = None
    request_id_correlation: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    intake_summary: IntakeSummary
    driver_summary: Optional[DriverSummary] = None


class PickupRequestListResponse(_Base):
    """Paginated list of pickup requests."""
    items: list[PickupRequestRead]
    total: int
    limit: int
    offset: int
