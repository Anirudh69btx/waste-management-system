from __future__ import annotations
import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class AdminUserListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    organization_name: str | None
    phone_number: str | None
    is_active: bool
    is_verified: bool
    created_at: datetime
    deactivation_reason: str | None = None
    last_role_change_at: datetime | None = None


class AdminUserListResponse(BaseModel):
    items: list[AdminUserListItem]
    total: int


class AdminRoleChangeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    new_role: Literal["GENERATOR", "RECYCLER", "LOGISTICS", "ADMIN"]
    reason: str = Field(..., min_length=10, max_length=500)


class AdminDeactivateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(..., min_length=10, max_length=500)


class AdminDisputeListItem(BaseModel):
    id: uuid.UUID
    intake_id: uuid.UUID
    batch_code: str
    supplier_email: str
    declared_weight_kg: float
    verified_weight_kg: float
    dispute_notes: str
    weight_method: str
    recorded_at: datetime
    dispute_resolution: str | None = None
    dispute_resolved_at: datetime | None = None


class AdminDisputeListResponse(BaseModel):
    items: list[AdminDisputeListItem]
    total: int


class AdminDisputeResolveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    resolution: Literal["upheld", "rejected"]  # upheld = supplier wins, rejected = original weight stands
    note: str = Field(..., min_length=10, max_length=1000)


class ActivityEvent(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    event_type: str
    batch_id: uuid.UUID
    batch_code: str | None
    actor_user_id: uuid.UUID | None
    actor_name: str | None
    actor_role: str | None
    from_status: str | None
    to_status: str | None
    metadata_json: dict
    created_at: datetime


class ActivityFeedResponse(BaseModel):
    items: list[ActivityEvent]
    total: int
