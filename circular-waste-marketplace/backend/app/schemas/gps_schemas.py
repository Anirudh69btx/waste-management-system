from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class GpsPingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    vehicle_id: uuid.UUID
    lat: Decimal = Field(..., ge=-90, le=90)
    lng: Decimal = Field(..., ge=-180, le=180)
    speed_kmh: Decimal | None = Field(None, ge=0, le=200)
    heading: Decimal | None = Field(None, ge=0, le=360)
    recorded_at: datetime | None = None
    source: Literal["device", "simulated", "manual"]


class GpsPingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    vehicle_id: uuid.UUID
    trip_id: uuid.UUID | None
    lat: Decimal
    lng: Decimal
    speed_kmh: Decimal | None
    heading: Decimal | None
    source: str
    recorded_at: object


class VehicleLocationRead(BaseModel):
    vehicle_id: uuid.UUID
    plate_number: str
    lat: Decimal | None
    lng: Decimal | None
    speed_kmh: Decimal | None
    heading: Decimal | None
    recorded_at: object | None
    source: str | None
    is_simulated: bool


class VehicleRouteResponse(BaseModel):
    vehicle_id: uuid.UUID
    pings: list[GpsPingRead]
    total_distance_km: float
