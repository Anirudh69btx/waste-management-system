from __future__ import annotations
import uuid
from pydantic import BaseModel, ConfigDict


class TraceabilityEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    batch_id: uuid.UUID
    event_type: str
    from_status: str | None
    to_status: str | None
    actor_user_id: uuid.UUID | None
    actor_role: str | None
    metadata_json: dict
    request_id: str | None
    created_at: object


class TraceabilityTimelineResponse(BaseModel):
    batch_id: uuid.UUID
    events: list[TraceabilityEventRead]
