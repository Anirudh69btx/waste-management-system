from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TripCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    vehicle_id: uuid.UUID
    driver_user_id: uuid.UUID
    pickup_request_ids: list[uuid.UUID] = Field(..., min_length=1, max_length=10)
    notes: str | None = Field(None, max_length=500)

    @field_validator("pickup_request_ids")
    @classmethod
    def unique_ids(cls, v: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(v) != len(set(v)):
            raise ValueError("duplicate pickup_request_ids")
        return v


class TripStopRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    trip_id: uuid.UUID
    pickup_request_id: uuid.UUID
    sequence: int
    status: str
    arrived_at: object | None
    completed_at: object | None
    failure_reason: str | None
    notes: str | None


class TripRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    vehicle_id: uuid.UUID
    driver_user_id: uuid.UUID
    status: str
    planned_distance_km: Decimal | None
    actual_distance_km: Decimal | None
    started_at: object | None
    ended_at: object | None
    total_weight_kg: Decimal | None
    notes: str | None
    created_at: object
    updated_at: object
    stops: list[TripStopRead] = []


class TripListResponse(BaseModel):
    items: list[TripRead]
    total: int


class TripEndRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    notes: str | None = Field(None, max_length=500)


class TripStopArriveResponse(BaseModel):
    stop_id: uuid.UUID
    status: str
    arrived_at: object


class TripStopCompleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    notes: str | None = Field(None, max_length=500)


class TripStopFailRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    failure_reason: str = Field(..., min_length=10, max_length=500)
