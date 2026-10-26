from __future__ import annotations
import uuid
from decimal import Decimal
from datetime import date
from pydantic import BaseModel, ConfigDict


class TimeSeriesPoint(BaseModel):
    date: date
    value: float


class CategoryBreakdown(BaseModel):
    category_id: int
    category_name: str
    quantity_kg: float
    count: int


class StatusBreakdown(BaseModel):
    status: str
    count: int


class SupplierAnalyticsResponse(BaseModel):
    period_start: date
    period_end: date
    total_batches: int
    total_declared_kg: float
    total_verified_kg: float
    total_estimated_earnings: float
    total_actual_earnings: float
    total_co2e_saved_kg: float
    avg_kg_per_batch: float
    rejection_rate: float
    submission_streak_days: int
    kg_by_day: list[TimeSeriesPoint]
    batches_by_status: list[StatusBreakdown]
    kg_by_category: list[CategoryBreakdown]


class SellerAnalyticsResponse(BaseModel):
    period_start: date
    period_end: date
    total_lots_created: int
    available_kg: float
    reserved_kg: float
    sold_kg: float
    total_revenue: float
    revenue_this_period: float
    avg_sale_price_per_kg: float
    bid_acceptance_rate: float
    pending_bids: int
    open_orders: int
    revenue_by_day: list[TimeSeriesPoint]
    kg_sold_by_category: list[CategoryBreakdown]
    orders_by_status: list[StatusBreakdown]


class AdminAnalyticsResponse(BaseModel):
    period_start: date
    period_end: date
    total_intakes: int
    total_kg_diverted: float
    total_co2e_saved_kg: float
    total_gmv: float
    active_users: int
    active_suppliers: int
    active_recyclers: int
    total_households_served: int
    kg_by_day: list[TimeSeriesPoint]
    gmv_by_day: list[TimeSeriesPoint]
    kg_by_category: list[CategoryBreakdown]
    users_by_role: list[StatusBreakdown]
    intakes_by_status: list[StatusBreakdown]
    top_suppliers: list[dict]
    top_sellers: list[dict]
