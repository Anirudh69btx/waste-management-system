"""
Circular Waste Marketplace — Pydantic v2 Schemas
=================================================
All request/response schemas. Models are separated from API schemas
to allow independent evolution. Never return SQLAlchemy model objects
directly from routes — always serialize via these schemas.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Shared base config
# ---------------------------------------------------------------------------

class _Base(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ---------------------------------------------------------------------------
# Auth (delegated to app.schemas.auth)
# ---------------------------------------------------------------------------
from app.schemas.auth import (
    AccessTokenResponse,
    ChangePasswordRequest,
    RefreshRequest,
    RefreshTokenRequest,
    RegisterResponse,
    TokenPairResponse,
    TokenResponse,
    UserLoginRequest,
    UserReadResponse,
    UserRegisterRequest,
    UserResponse,
    UserUpdateRequest,
)


# ---------------------------------------------------------------------------
# Supplier
# ---------------------------------------------------------------------------

class SupplierProfileRequest(_Base):
    """Request body to create/update a supplier KYC profile."""
    business_name: str = Field(..., max_length=255)
    registration_number: str = Field(..., max_length=100)
    facility_address: str
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    contact_phone: str = Field(..., max_length=30)


class SupplierResponse(_Base):
    """Supplier profile response."""
    id: uuid.UUID
    user_id: uuid.UUID
    business_name: str
    registration_number: str
    facility_address: str
    latitude: float
    longitude: float
    contact_phone: str
    verification_status: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Waste Intake
# ---------------------------------------------------------------------------

class WasteCategoryResponse(_Base):
    id: int
    code: str
    name: str
    unit_of_measure: str
    carbon_offset_factor: float


class WasteIntakeResponse(_Base):
    """Full intake manifest response."""
    id: uuid.UUID
    batch_code: str
    supplier_id: uuid.UUID
    category: WasteCategoryResponse
    purity_grade: str
    declared_weight_kg: float
    verified_weight_kg: Optional[float]
    weight_discrepancy_kg: Optional[float]
    status: str
    qr_code_hash: str
    image_paths: list[str]
    notes: Optional[str]
    scale_operator_id: Optional[uuid.UUID]
    verified_at: Optional[datetime]
    created_at: datetime


class VerifyWeightRequest(_Base):
    """Request body for POST /api/v1/intake/{id}/verify-weight."""
    verified_weight_kg: float = Field(..., gt=0)
    scale_identifier: str = Field(..., max_length=100)
    scale_operator_notes: Optional[str] = None


class VerifyWeightResponse(_Base):
    intake_id: uuid.UUID
    batch_code: str
    declared_weight_kg: float
    verified_weight_kg: float
    weight_discrepancy_kg: float
    discrepancy_percentage: float
    status: str
    scale_operator_id: Optional[uuid.UUID]
    verified_at: Optional[datetime]


class QRCodeResponse(_Base):
    intake_id: uuid.UUID
    batch_code: str
    qr_code_data_url: str  # base64 PNG data URL
    manifest_signature: str
    verification_url: str


class IntakeListResponse(_Base):
    """Paginated list of waste intake consignments."""
    items: list[WasteIntakeResponse]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------------------
# AI Assessment
# ---------------------------------------------------------------------------

class WasteAssessmentResponse(_Base):
    id: uuid.UUID
    intake_id: uuid.UUID
    detected_category: str
    confidence_score: float
    estimated_purity_percentage: float
    contamination_detected: bool
    contamination_details: list[str]
    suggested_purity_grade: str
    model_version: str
    latency_ms: Optional[int]
    created_at: datetime


# ---------------------------------------------------------------------------
# Transit & Tracking
# ---------------------------------------------------------------------------

class TrackingPingRequest(_Base):
    """GPS ping submitted by a driver device."""
    transit_id: uuid.UUID
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    altitude_meters: Optional[float] = None
    speed_kmh: Optional[float] = Field(None, ge=0)
    heading_degrees: Optional[float] = Field(None, ge=0, le=360)
    battery_level: Optional[float] = Field(None, ge=0, le=100)


class TelemetryPingResponse(_Base):
    id: int
    transit_id: uuid.UUID
    latitude: float
    longitude: float
    recorded_at: datetime


class TransitTrailResponse(_Base):
    transit_id: uuid.UUID
    status: str
    pings: list[TelemetryPingResponse]


# ---------------------------------------------------------------------------
# Sorting
# ---------------------------------------------------------------------------

class SortingRecordRequest(_Base):
    """Request body for POST /api/v1/sorting/process."""
    intake_id: uuid.UUID
    facility_location: str = Field(..., max_length=255)
    input_weight_kg: float = Field(..., gt=0)
    sorted_yield_kg: float = Field(..., gt=0)
    contamination_removed_kg: float = Field(..., ge=0)
    started_at: datetime
    completed_at: datetime


class SortingRecordResponse(_Base):
    id: uuid.UUID
    intake_id: uuid.UUID
    facility_location: str
    input_weight_kg: float
    sorted_yield_kg: float
    contamination_removed_kg: float
    sorting_efficiency_percent: float
    sorter_operator_id: uuid.UUID
    started_at: datetime
    completed_at: datetime
    created_at: datetime


class InventoryLotResponse(_Base):
    id: uuid.UUID
    lot_code: str
    sorting_record_id: uuid.UUID
    category: WasteCategoryResponse
    purity_grade: str
    moisture_content_percent: float
    initial_quantity_kg: float
    available_quantity_kg: float
    reserved_quantity_kg: float
    warehouse_location: str
    status: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Marketplace
# ---------------------------------------------------------------------------

class MarketplaceListingRequest(_Base):
    """Request body for POST /api/v1/marketplace/listings."""
    inventory_lot_id: uuid.UUID
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    listing_type: str = Field(default="FIXED_PRICE", pattern=r"^(FIXED_PRICE|AUCTION_BIDDING)$")
    available_quantity_kg: float = Field(..., gt=0)
    min_order_quantity_kg: float = Field(default=100.0, gt=0)
    unit_price_per_kg: float = Field(..., gt=0)
    auction_ends_at: Optional[datetime] = None


class MarketplaceListingResponse(_Base):
    id: uuid.UUID
    listing_code: str
    seller_id: uuid.UUID
    inventory_lot_id: uuid.UUID
    category: WasteCategoryResponse
    title: str
    description: Optional[str]
    purity_grade: str
    listing_type: str
    available_quantity_kg: float
    min_order_quantity_kg: float
    unit_price_per_kg: float
    calculated_floor_price: float
    estimated_co2_offset_total: float
    status: str
    auction_ends_at: Optional[datetime]
    created_at: datetime


class BidRequest(_Base):
    """Request body for POST /api/v1/marketplace/bids."""
    listing_id: uuid.UUID
    bid_price_per_kg: float = Field(..., gt=0)
    requested_quantity_kg: float = Field(..., gt=0)
    valid_until: datetime


class BidResponse(_Base):
    id: uuid.UUID
    listing_id: uuid.UUID
    buyer_id: uuid.UUID
    bid_price_per_kg: float
    requested_quantity_kg: float
    total_bid_amount: float
    status: str
    valid_until: datetime
    created_at: datetime


class CheckoutRequest(_Base):
    """Request body for POST /api/v1/marketplace/orders/checkout."""
    listing_id: uuid.UUID
    quantity_kg: float = Field(..., gt=0)
    bid_id: Optional[uuid.UUID] = None  # Populate if converting from accepted bid


class PurchaseOrderResponse(_Base):
    id: uuid.UUID
    order_number: str
    listing_id: uuid.UUID
    buyer_id: uuid.UUID
    seller_id: uuid.UUID
    quantity_kg: float
    unit_price_per_kg: float
    subtotal_amount: float
    platform_fee_amount: float
    total_gross_amount: float
    payment_status: str
    fulfillment_status: str
    payment_gateway_ref: Optional[str]
    created_at: datetime


# ---------------------------------------------------------------------------
# Pricing
# ---------------------------------------------------------------------------

class PricingQuoteResponse(_Base):
    category_code: str
    purity_grade: str
    base_benchmark_price_per_kg: float
    floor_price_per_kg: float
    ceiling_price_per_kg: float
    moisture_penalty_applied: float
    contamination_penalty_applied: float
    effective_price_per_kg: float
    effective_from: datetime


# ---------------------------------------------------------------------------
# Rewards
# ---------------------------------------------------------------------------

class RewardWalletResponse(_Base):
    id: uuid.UUID
    user_id: uuid.UUID
    available_points: int
    lifetime_earned: int
    lifetime_redeemed: int
    updated_at: datetime


class RewardTransactionResponse(_Base):
    id: int
    wallet_id: uuid.UUID
    intake_id: Optional[uuid.UUID]
    order_id: Optional[uuid.UUID]
    points_delta: int
    transaction_type: str
    description: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Eco-Store
# ---------------------------------------------------------------------------

class EcoProductResponse(_Base):
    id: uuid.UUID
    title: str
    slug: str
    description: str
    category: str
    price_fiat: float
    max_points_discount_percent: float
    stock_quantity: int
    carbon_offset_kg: float
    image_url: str
    is_featured: bool
    created_at: datetime


class CartItem(_Base):
    product_id: uuid.UUID
    quantity: int = Field(..., ge=1)


class CartValidateRequest(_Base):
    items: list[CartItem]
    points_to_redeem: int = Field(default=0, ge=0)


class CartValidateResponse(_Base):
    items: list[dict[str, Any]]
    gross_amount: float
    points_to_redeem: int
    points_discount_amount: float
    net_payable_amount: float
    max_redeemable_points: int


class EcoCheckoutRequest(_Base):
    items: list[CartItem]
    points_to_redeem: int = Field(default=0, ge=0)
    shipping_address: str


class EcoOrderResponse(_Base):
    id: uuid.UUID
    order_number: str
    user_id: uuid.UUID
    gross_amount: float
    points_redeemed: int
    points_discount_amount: float
    net_payable_amount: float
    payment_status: str
    payment_gateway_ref: Optional[str]
    shipping_address: str
    items_snapshot: list[dict[str, Any]]
    created_at: datetime


# ---------------------------------------------------------------------------
# Analytics / Metrics
# ---------------------------------------------------------------------------

class PublicImpactMetrics(_Base):
    """Public aggregate metrics for the landing page."""
    total_waste_diverted_tonnes: float
    total_co2_saved_kg: float
    total_supplier_payouts: float
    active_suppliers: int
    active_listings: int


class SupplierDashboardResponse(_Base):
    total_intakes: int
    total_kg_submitted: float
    total_kg_verified: float
    total_co2_saved_kg: float
    intake_status_counts: dict[str, int]
    reward_points_available: int
    reward_lifetime_earned: int


class RecyclerDashboardResponse(_Base):
    active_bids: int
    total_purchased_kg: float
    escrow_held_amount: float
    total_spent_amount: float
    active_transits: int


class AdminDashboardResponse(_Base):
    platform_gmv: float
    total_waste_processed_tonnes: float
    active_transit_count: int
    flagged_intakes: int
    total_registered_users: int
    total_suppliers: int


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------

class MockWebhookRequest(_Base):
    """Simulate gateway payment success/failure callback."""
    order_id: uuid.UUID
    order_type: str = Field(..., pattern=r"^(purchase_order|eco_order)$")
    event: str = Field(..., pattern=r"^(PAYMENT_AUTHORIZED|PAYMENT_FAILED|PAYMENT_REFUNDED)$")
    utr_reference: Optional[str] = None


class MockWebhookResponse(_Base):
    order_id: uuid.UUID
    previous_status: str
    new_status: str
    message: str


# ---------------------------------------------------------------------------
# Health / Readiness
# ---------------------------------------------------------------------------

class HealthResponse(_Base):
    status: str
    version: str
    environment: str
    database: str = "ok"
    latency_ms: Optional[float] = None
    timestamp: str


class ReadinessResponse(_Base):
    status: str
    database: str
    redis: str
    storage: str
    migrations: str = "applied"
    alembic_version: Optional[str] = None


# ---------------------------------------------------------------------------
# Error (RFC-7807 problem+json)
# ---------------------------------------------------------------------------

class ProblemDetail(_Base):
    """RFC-7807 Problem Details response schema."""
    type: str = "about:blank"
    title: str
    status: int
    detail: str
    instance: Optional[str] = None
    request_id: Optional[str] = None
    errors: Optional[list[dict[str, Any]]] = None


# Segment 2.2a schemas
from app.schemas.pickup_schemas import (
    DriverSummary,
    IntakeSummary,
    PickupRequestAssign,
    PickupRequestCreate,
    PickupRequestListResponse,
    PickupRequestRead,
    PickupRequestStatusUpdate,
)
from app.schemas.weight_ticket_schemas import (
    WeightTicketAcknowledge,
    WeightTicketCreate,
    WeightTicketRead,
)

# Segment 3.2 schemas
from app.schemas.sorting_schemas import (
    SortingRecordCreate,
    InventoryLotCreate,
    SortingRecordRead,
    InventoryLotRead,
)
from app.schemas.marketplace_schemas import (
    ListingCreate,
    ListingRead,
    ListingListResponse,
    BidCreate,
    BidRead,
    BidAcceptRequest,
    BuyNowRequest,
    PurchaseOrderRead,
    OrderListResponse,
    OrderCancelRequest,
    ConfirmOrderRequest,
)
from app.schemas.traceability_schemas import (
    TraceabilityEventRead,
    TraceabilityTimelineResponse,
)
