"""Pydantic schemas for the Rewards System (Segment 3.3b)."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WalletRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    points_balance: int
    lifetime_points: int
    streak_days: int
    last_submission_date: date | None
    created_at: datetime | object


class RewardTransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    points_delta: int
    transaction_type: str
    description: str
    reference_type: str | None = None
    reference_id: UUID | None = None
    created_at: datetime | object


class TransactionListResponse(BaseModel):
    items: list[RewardTransactionRead]
    total: int


class EcoProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None
    price: Decimal
    stock_quantity: int
    category: str
    unit: str
    weight_kg: Decimal | None
    points_cost: int
    is_active: bool


class ProductListResponse(BaseModel):
    items: list[EcoProductRead]
    total: int


class RedeemRequest(BaseModel):
    product_id: UUID


class EcoOrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_code: str
    product_id: UUID
    product_title: str
    points_paid: int
    status: str
    created_at: datetime | object


class EcoOrderListResponse(BaseModel):
    items: list[EcoOrderRead]
    total: int


class LeaderboardEntry(BaseModel):
    user_id: UUID
    display_name: str
    points: int
    rank: int


class LeaderboardResponse(BaseModel):
    period: str
    entries: list[LeaderboardEntry]


class AdminAdjustRequest(BaseModel):
    user_id: UUID
    points: int
    reason: str = Field(..., min_length=1, max_length=255)
