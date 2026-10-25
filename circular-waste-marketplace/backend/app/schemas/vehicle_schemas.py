from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class VehicleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    plate_number: str = Field(..., min_length=3, max_length=20)
    capacity_kg: Decimal = Field(..., gt=0, le=50000, ge=50)
    fuel_type: Literal["petrol", "diesel", "electric", "cng", "hybrid"] = "diesel"
    notes: str | None = Field(None, max_length=500)

    @field_validator("plate_number")
    @classmethod
    def normalize_plate(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("plate_number cannot be empty")
        return v


class VehicleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    capacity_kg: Decimal | None = Field(None, gt=0, le=50000)
    fuel_type: Literal["petrol", "diesel", "electric", "cng", "hybrid"] | None = None
    status: Literal["available", "in_use", "maintenance", "inactive"] | None = None
    notes: str | None = Field(None, max_length=500)


class VehicleAssignDriver(BaseModel):
    model_config = ConfigDict(extra="forbid")
    driver_user_id: uuid.UUID


class VehicleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    plate_number: str
    capacity_kg: Decimal
    fuel_type: str
    status: str
    assigned_driver_user_id: uuid.UUID | None
    current_lat: Decimal | None
    current_lng: Decimal | None
    last_ping_at: object | None
    last_ping_source: str | None
    notes: str | None
    created_at: object
    updated_at: object


class VehicleListResponse(BaseModel):
    items: list[VehicleRead]
    total: int
