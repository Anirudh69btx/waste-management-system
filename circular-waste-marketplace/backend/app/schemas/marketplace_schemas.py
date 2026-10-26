from __future__ import annotations
import uuid
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class ListingCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    inventory_lot_id: uuid.UUID
    title: str = Field(..., min_length=3, max_length=200)
    description: str | None = Field(None, max_length=2000)
    price_per_kg: Decimal = Field(..., gt=0)
    min_bid_kg: Decimal = Field(Decimal("1"), gt=0)


class ListingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    seller_id: uuid.UUID
    category_id: int
    title: str
    description: str | None
    quantity_kg: Decimal
    available_kg: Decimal
    price_per_kg: Decimal
    min_bid_kg: Decimal
    purity_grade: str
    status: str
    created_at: object
    updated_at: object
    inventory_lot_id: uuid.UUID | None


class ListingListResponse(BaseModel):
    items: list[ListingRead]
    total: int


class BidCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    bid_price_per_kg: Decimal = Field(..., gt=0)
    quantity_kg: Decimal = Field(..., gt=0)
    message: str | None = Field(None, max_length=500)


class BidRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    listing_id: uuid.UUID
    buyer_user_id: uuid.UUID
    bid_price_per_kg: Decimal
    quantity_kg: Decimal
    total_amount: Decimal
    message: str | None
    status: str
    created_at: object


class BidAcceptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    bid_id: uuid.UUID


class BuyNowRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    quantity_kg: Decimal = Field(..., gt=0)


class PurchaseOrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    order_code: str
    listing_id: uuid.UUID
    buyer_user_id: uuid.UUID
    seller_user_id: uuid.UUID
    quantity_kg: Decimal
    unit_price: Decimal
    total_amount: Decimal
    currency: str
    status: str
    escrow_held_at: object | None
    completed_at: object | None
    cancellation_reason: str | None
    created_at: object
    updated_at: object


class OrderListResponse(BaseModel):
    items: list[PurchaseOrderRead]
    total: int


class OrderCancelRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(..., min_length=10, max_length=500)


class ConfirmOrderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    note: str | None = Field(None, max_length=500)


# --- Segment 3.2b: seller-side request bodies ---

class BidRejectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    note: str | None = Field(None, max_length=500)


class OrderShipRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tracking_number: str | None = Field(None, max_length=100)
    note: str | None = Field(None, max_length=500)


class OrderDeliverRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    note: str | None = Field(None, max_length=500)


class ListingUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["active", "cancelled"] | None = None
    reason: str | None = Field(None, max_length=500)
