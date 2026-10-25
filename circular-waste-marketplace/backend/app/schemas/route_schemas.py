from __future__ import annotations

import uuid
from pydantic import BaseModel, ConfigDict, Field


class RouteSuggestionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    driver_user_id: uuid.UUID
    vehicle_id: uuid.UUID
    pickup_request_ids: list[uuid.UUID] = Field(..., min_length=1, max_length=20)


class RouteSuggestionResponse(BaseModel):
    ordered_pickup_request_ids: list[uuid.UUID]
    total_distance_km: float
    total_weight_kg: float
    stream_class: str
    excluded_pickup_ids: list[uuid.UUID]
    reasoning: str
