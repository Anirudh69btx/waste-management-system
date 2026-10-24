"""
Circular Waste Marketplace — Intake List Schemas
=================================================
Pagination and list schemas for waste intake consignments.
"""
from __future__ import annotations

from typing import TYPE_CHECKING
from pydantic import BaseModel, ConfigDict

if TYPE_CHECKING:
    from app.schemas import WasteIntakeResponse


class _Base(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class IntakeListResponse(_Base):
    """Paginated list of waste intake consignments."""
    items: list[WasteIntakeResponse]
    total: int
    limit: int
    offset: int
