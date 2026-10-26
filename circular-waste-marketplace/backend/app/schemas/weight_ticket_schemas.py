"""
Circular Waste Marketplace — Weight Ticket Schemas
===================================================
Pydantic v2 schemas for physical scale weight recording and supplier acknowledgment.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class _Base(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class WeightTicketCreate(BaseModel):
    """
    Payload to record scale weight ticket.
    Strictly forbids client-provided net_weight_kg to prevent fraud.
    """
    model_config = ConfigDict(extra="forbid")

    pickup_request_id: Optional[uuid.UUID] = None
    weight_method: Literal["manual", "demo", "digital_scale", "weighbridge"]
    gross_weight_kg: float = Field(..., gt=0)
    tare_weight_kg: float = Field(..., ge=0)
    scale_id: Optional[str] = None
    scale_calibration_date: Optional[date] = None
    notes: Optional[str] = None


class WeightTicketAcknowledge(_Base):
    """Payload for supplier or admin to confirm or dispute recorded scale weight."""
    confirmed: bool
    dispute_notes: Optional[str] = None


class WeightTicketRead(_Base):
    """Full detail view of a verified weight ticket."""
    id: uuid.UUID
    intake_id: uuid.UUID
    pickup_request_id: Optional[uuid.UUID] = None
    weight_method: str
    gross_weight_kg: float
    tare_weight_kg: float
    net_weight_kg: float
    scale_id: Optional[str] = None
    scale_calibration_date: Optional[date] = None
    photo_urls: list[str] = Field(default_factory=list)
    recorded_by_user_id: uuid.UUID
    recorded_at: datetime
    discrepancy_flag: bool
    discrepancy_notes: Optional[str] = None
    notes: Optional[str] = None
    supplier_confirmed_at: Optional[datetime] = None
    supplier_dispute_notes: Optional[str] = None
    dispute_resolution: Optional[str] = None
    dispute_resolved_by_user_id: Optional[uuid.UUID] = None
    dispute_resolved_at: Optional[datetime] = None
    dispute_resolution_note: Optional[str] = None
    created_at: datetime
    updated_at: datetime
