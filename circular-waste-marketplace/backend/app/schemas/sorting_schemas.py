from __future__ import annotations
import uuid
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class SortingRecordCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    intake_id: uuid.UUID
    input_weight_kg: Decimal = Field(..., gt=0)
    sorted_weight_kg: Decimal = Field(..., gt=0)
    rejected_weight_kg: Decimal = Field(Decimal("0"), ge=0)
    contamination_percent: Decimal = Field(Decimal("0"), ge=0, le=100)
    sort_grade: Literal["GRADE_A", "GRADE_B", "GRADE_C"]
    moisture_percent: Decimal | None = Field(None, ge=0, le=100)
    notes: str | None = Field(None, max_length=1000)
    inventory_lots: list["InventoryLotCreate"] = Field(..., min_length=1)

    @field_validator("sorted_weight_kg")
    @classmethod
    def weight_consistency(cls, v: Decimal, info):
        if "input_weight_kg" in info.data:
            inp = info.data["input_weight_kg"]
            rej = info.data.get("rejected_weight_kg", Decimal("0"))
            if v + rej > inp + Decimal("0.001"):
                raise ValueError("sorted + rejected cannot exceed input weight")
        return v


class InventoryLotCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    category_id: int
    quantity_kg: Decimal = Field(..., gt=0)
    grade: Literal["GRADE_A", "GRADE_B", "GRADE_C"]
    contamination_percent: Decimal = Field(Decimal("0"), ge=0, le=100)
    moisture_percent: Decimal | None = None
    hub_location: str | None = Field(None, max_length=255)


class SortingRecordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    intake_id: uuid.UUID
    sorter_user_id: uuid.UUID
    input_weight_kg: Decimal
    sorted_weight_kg: Decimal
    rejected_weight_kg: Decimal
    contamination_percent: Decimal
    sort_grade: str
    moisture_percent: Decimal | None
    notes: str | None
    photos: list
    created_at: object
    updated_at: object


class InventoryLotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    lot_code: str
    intake_id: uuid.UUID
    sorting_record_id: uuid.UUID
    category_id: int
    quantity_kg: Decimal
    available_kg: Decimal
    grade: str
    contamination_percent: Decimal
    moisture_percent: Decimal | None
    status: str
    hub_location: str | None
    created_at: object
