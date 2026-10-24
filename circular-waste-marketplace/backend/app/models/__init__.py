"""
Circular Waste Marketplace — SQLAlchemy Models
===============================================
All models in a single module so Alembic detects them correctly.
Import from ``app.models`` — never from sub-paths.

Relationships use ``selectinload`` at the query layer to prevent N+1 queries.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import (
    DateTime,
    func,
    BigInteger,
    Boolean,
    CheckConstraint,
    Double,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class UserRole(str, enum.Enum):
    """Platform participant roles. Mapped directly to JWT ``role`` claim."""
    GENERATOR = "GENERATOR"    # Waste supplier / household / industry
    RECYCLER = "RECYCLER"      # Sorter / aggregator / industrial buyer
    LOGISTICS = "LOGISTICS"    # Driver / logistics operator
    ADMIN = "ADMIN"            # Platform administrator


class WastePurityGrade(str, enum.Enum):
    """Standardized material purity grades."""
    GRADE_A = "GRADE_A"
    GRADE_B = "GRADE_B"
    GRADE_C = "GRADE_C"
    CONTAMINATED = "CONTAMINATED"


class IntakeStatus(str, enum.Enum):
    """FSM states for a waste intake consignment."""
    SUBMITTED = "submitted"
    PICKUP_REQUESTED = "pickup_requested"
    PICKUP_ASSIGNED = "pickup_assigned"
    PICKED_UP = "picked_up"
    WEIGHED = "weighed"
    IN_SORTING = "in_sorting"
    SORTED = "sorted"
    LISTED = "listed"
    SOLD = "sold"
    CANCELLED = "cancelled"
    REJECTED = "rejected"

    # Compatibility aliases
    VERIFIED = "weighed"
    FLAGGED_DISCREPANCY = "weighed"


class TransitStatus(str, enum.Enum):
    """FSM states for a waste transit shipment."""
    SCHEDULED = "SCHEDULED"
    IN_TRANSIT = "IN_TRANSIT"
    ARRIVED = "ARRIVED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class InventoryLotStatus(str, enum.Enum):
    """Lifecycle state of a sorted inventory lot."""
    AVAILABLE = "AVAILABLE"
    LISTED = "LISTED"
    ALLOCATED = "ALLOCATED"
    DEPLETED = "DEPLETED"


class ListingType(str, enum.Enum):
    """Marketplace listing offer type."""
    FIXED_PRICE = "FIXED_PRICE"
    AUCTION_BIDDING = "AUCTION_BIDDING"


class ListingStatus(str, enum.Enum):
    """Lifecycle state of a marketplace listing."""
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    RESERVED = "RESERVED"
    SOLD_OUT = "SOLD_OUT"
    CANCELLED = "CANCELLED"


class BidStatus(str, enum.Enum):
    """Status of a procurement bid."""
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    OUTBID = "OUTBID"
    EXPIRED = "EXPIRED"


class PaymentStatus(str, enum.Enum):
    """Payment/escrow lifecycle states."""
    PENDING = "PENDING"
    ESCROW_HELD = "ESCROW_HELD"
    RELEASED = "RELEASED"
    REFUNDED = "REFUNDED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class FulfillmentStatus(str, enum.Enum):
    """Purchase order fulfillment states."""
    PENDING = "PENDING"
    READY_FOR_PICKUP = "READY_FOR_PICKUP"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"
    DISPUTED = "DISPUTED"


class RewardTransactionType(str, enum.Enum):
    """Types of reward ledger entries."""
    INTAKE_CREDIT = "INTAKE_CREDIT"
    STORE_REDEMPTION = "STORE_REDEMPTION"
    BONUS_GRANT = "BONUS_GRANT"
    ADJUSTMENT = "ADJUSTMENT"


class VerificationStatus(str, enum.Enum):
    """KYC verification status for supplier profiles."""
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class EcoProductCategory(str, enum.Enum):
    """B2C Eco-Store product categories."""
    COMPOST = "COMPOST"
    RECYCLED_PLASTIC = "RECYCLED_PLASTIC"
    UPCYCLED_GOODS = "UPCYCLED_GOODS"
    BUILDING_BLOCKS = "BUILDING_BLOCKS"


# ---------------------------------------------------------------------------
# Users & Authentication
# ---------------------------------------------------------------------------

class User(Base, TimestampMixin):
    """Core identity record — authentication + role assignment."""
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, native_enum=False), nullable=False
    )
    organization_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)

    # Property alias for password hash
    @property
    def password_hash(self) -> str:
        return self.hashed_password

    @password_hash.setter
    def password_hash(self, val: str) -> None:
        self.hashed_password = val

    # Relationships
    supplier_profile: Mapped[Optional["Supplier"]] = relationship(
        "Supplier", back_populates="user", uselist=False
    )
    reward_wallet: Mapped[Optional["RewardWallet"]] = relationship(
        "RewardWallet", back_populates="user", uselist=False
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_users_email", "email"),
        Index("idx_users_role", "role"),
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} role={self.role} email=REDACTED>"


class RefreshToken(Base, TimestampMixin):
    """
    DB-backed refresh token for replay defense and session revocation.
    """
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    jti: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    replaced_by_jti: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")

    __table_args__ = (
        Index("idx_refresh_tokens_user_revoked", "user_id", "revoked_at"),
    )

    def __repr__(self) -> str:
        return f"<RefreshToken id={self.id} user_id={self.user_id} jti={self.jti} revoked={self.revoked_at is not None}>"



# ---------------------------------------------------------------------------
# Supplier Profile
# ---------------------------------------------------------------------------

class Supplier(Base, TimestampMixin):
    """KYC profile and geolocation for a registered waste generator."""
    __tablename__ = "suppliers"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        unique=True, nullable=False
    )
    business_name: Mapped[str] = mapped_column(String(255), nullable=False)
    registration_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    facility_address: Mapped[str] = mapped_column(Text, nullable=False)
    latitude: Mapped[float] = mapped_column(Double, nullable=False)
    longitude: Mapped[float] = mapped_column(Double, nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(30), nullable=False)
    verification_status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus, native_enum=False),
        default=VerificationStatus.PENDING, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="supplier_profile")
    waste_intakes: Mapped[list["WasteIntake"]] = relationship(
        "WasteIntake", back_populates="supplier"
    )

    __table_args__ = (
        Index("idx_suppliers_user", "user_id"),
        Index("idx_suppliers_status", "verification_status"),
    )


# ---------------------------------------------------------------------------
# Waste Categories (Reference / Taxonomy)
# ---------------------------------------------------------------------------

class WasteCategory(Base):
    """Normalized material taxonomy with carbon offset factors."""
    __tablename__ = "waste_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    unit_of_measure: Mapped[str] = mapped_column(String(20), default="kg", nullable=False)
    carbon_offset_factor: Mapped[float] = mapped_column(Double, default=1.5, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    waste_intakes: Mapped[list["WasteIntake"]] = relationship(
        "WasteIntake", back_populates="category"
    )
    inventory_lots: Mapped[list["InventoryLot"]] = relationship(
        "InventoryLot", back_populates="category"
    )
    pricing_rules: Mapped[list["PricingRule"]] = relationship(
        "PricingRule", back_populates="category"
    )
    marketplace_listings: Mapped[list["MarketplaceListing"]] = relationship(
        "MarketplaceListing", back_populates="category"
    )


# ---------------------------------------------------------------------------
# Waste Intakes
# ---------------------------------------------------------------------------

class WasteIntake(Base, TimestampMixin):
    """Consignment manifest for waste entering the marketplace pipeline."""
    __tablename__ = "waste_intakes"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    batch_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    supplier_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False
    )
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("waste_categories.id", ondelete="RESTRICT"), nullable=False
    )
    purity_grade: Mapped[WastePurityGrade] = mapped_column(
        Enum(WastePurityGrade, native_enum=False), nullable=False
    )
    declared_weight_kg: Mapped[float] = mapped_column(Double, nullable=False)
    verified_weight_kg: Mapped[Optional[float]] = mapped_column(Double, nullable=True)
    weight_discrepancy_kg: Mapped[Optional[float]] = mapped_column(Double, nullable=True)
    status: Mapped[str] = mapped_column(
        String(32), default=IntakeStatus.SUBMITTED.value, nullable=False
    )
    qr_code_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    image_paths: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    scale_operator_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="waste_intakes")
    category: Mapped["WasteCategory"] = relationship("WasteCategory", back_populates="waste_intakes")
    assessment: Mapped[Optional["WasteAssessment"]] = relationship(
        "WasteAssessment", back_populates="intake", uselist=False
    )
    transits: Mapped[list["WasteTransit"]] = relationship("WasteTransit", back_populates="intake")
    sorting_records: Mapped[list["SortingRecord"]] = relationship(
        "SortingRecord", back_populates="intake"
    )
    pickup_request: Mapped[Optional["PickupRequest"]] = relationship(
        "PickupRequest", back_populates="intake", uselist=False
    )
    weight_tickets: Mapped[list["WeightTicket"]] = relationship(
        "WeightTicket", back_populates="intake"
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('submitted', 'pickup_requested', 'pickup_assigned', 'picked_up', 'weighed', "
            "'in_sorting', 'sorted', 'listed', 'sold', 'cancelled', 'rejected')",
            name="ck_waste_intakes_status",
        ),
        Index("idx_waste_intakes_batch", "batch_code"),
        Index("idx_waste_intakes_supplier", "supplier_id"),
        Index("idx_waste_intakes_status", "status"),
    )


# ---------------------------------------------------------------------------
# Waste Assessments (AI output)
# ---------------------------------------------------------------------------

class WasteAssessment(Base):
    """AI quality assessment output linked to a waste intake."""
    __tablename__ = "waste_assessments"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    intake_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("waste_intakes.id", ondelete="CASCADE"),
        unique=True, nullable=False
    )
    detected_category: Mapped[str] = mapped_column(String(100), nullable=False)
    confidence_score: Mapped[float] = mapped_column(Double, nullable=False)
    estimated_purity_percentage: Mapped[float] = mapped_column(Double, nullable=False)
    contamination_detected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    contamination_details: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    suggested_purity_grade: Mapped[str] = mapped_column(String(20), nullable=False)
    raw_ai_response: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    model_version: Mapped[str] = mapped_column(String(50), default="gemini-1.5-flash", nullable=False)
    input_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256 of input images
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    intake: Mapped["WasteIntake"] = relationship("WasteIntake", back_populates="assessment")

    __table_args__ = (
        Index("idx_assessments_intake", "intake_id"),
        Index("idx_assessments_contamination", "contamination_detected"),
    )


# ---------------------------------------------------------------------------
# Transit & GPS Telemetry
# ---------------------------------------------------------------------------

class WasteTransit(Base):
    """Logistics shipment record linking intake to a delivery route."""
    __tablename__ = "waste_transits"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    intake_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("waste_intakes.id", ondelete="RESTRICT"), nullable=False
    )
    logistics_provider_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    origin_facility_address: Mapped[str] = mapped_column(Text, nullable=False)
    origin_lat: Mapped[float] = mapped_column(Double, nullable=False)
    origin_lon: Mapped[float] = mapped_column(Double, nullable=False)
    destination_facility_address: Mapped[str] = mapped_column(Text, nullable=False)
    destination_lat: Mapped[float] = mapped_column(Double, nullable=False)
    destination_lon: Mapped[float] = mapped_column(Double, nullable=False)
    status: Mapped[TransitStatus] = mapped_column(
        Enum(TransitStatus, native_enum=False), default=TransitStatus.SCHEDULED, nullable=False
    )
    departed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    arrived_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    intake: Mapped["WasteIntake"] = relationship("WasteIntake", back_populates="transits")
    telemetry_pings: Mapped[list["VehicleTelemetry"]] = relationship(
        "VehicleTelemetry", back_populates="transit"
    )

    __table_args__ = (
        Index("idx_transits_intake", "intake_id"),
        Index("idx_transits_status", "status"),
    )


class VehicleTelemetry(Base):
    """GPS breadcrumb ping for a transit shipment."""
    __tablename__ = "vehicle_telemetry"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    transit_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("waste_transits.id", ondelete="CASCADE"), nullable=False
    )
    latitude: Mapped[float] = mapped_column(Double, nullable=False)
    longitude: Mapped[float] = mapped_column(Double, nullable=False)
    altitude_meters: Mapped[Optional[float]] = mapped_column(Double, nullable=True)
    speed_kmh: Mapped[Optional[float]] = mapped_column(Double, nullable=True)
    heading_degrees: Mapped[Optional[float]] = mapped_column(Double, nullable=True)
    battery_level: Mapped[Optional[float]] = mapped_column(Double, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    transit: Mapped["WasteTransit"] = relationship("WasteTransit", back_populates="telemetry_pings")

    __table_args__ = (
        Index("idx_telemetry_transit_time", "transit_id", "recorded_at"),
    )


# ---------------------------------------------------------------------------
# Sorting & Inventory
# ---------------------------------------------------------------------------

class SortingRecord(Base):
    """Audit log of a physical sorting/decontamination run."""
    __tablename__ = "sorting_records"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    intake_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("waste_intakes.id", ondelete="RESTRICT"), nullable=False
    )
    facility_location: Mapped[str] = mapped_column(String(255), nullable=False)
    input_weight_kg: Mapped[float] = mapped_column(Double, nullable=False)
    sorted_yield_kg: Mapped[float] = mapped_column(Double, nullable=False)
    contamination_removed_kg: Mapped[float] = mapped_column(Double, nullable=False)
    sorting_efficiency_percent: Mapped[float] = mapped_column(Double, nullable=False)
    sorter_operator_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    intake: Mapped["WasteIntake"] = relationship("WasteIntake", back_populates="sorting_records")
    inventory_lots: Mapped[list["InventoryLot"]] = relationship(
        "InventoryLot", back_populates="sorting_record"
    )

    __table_args__ = (
        Index("idx_sorting_intake", "intake_id"),
        Index("idx_sorting_completed", "completed_at"),
    )


class InventoryLot(Base, TimestampMixin):
    """Standardized certified inventory lot ready for B2B marketplace trading."""
    __tablename__ = "inventory_lots"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lot_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    sorting_record_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("sorting_records.id", ondelete="RESTRICT"), nullable=False
    )
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("waste_categories.id", ondelete="RESTRICT"), nullable=False
    )
    purity_grade: Mapped[WastePurityGrade] = mapped_column(
        Enum(WastePurityGrade, native_enum=False), nullable=False
    )
    moisture_content_percent: Mapped[float] = mapped_column(Double, default=0.0, nullable=False)
    initial_quantity_kg: Mapped[float] = mapped_column(Double, nullable=False)
    available_quantity_kg: Mapped[float] = mapped_column(Double, nullable=False)
    reserved_quantity_kg: Mapped[float] = mapped_column(Double, default=0.0, nullable=False)
    warehouse_location: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[InventoryLotStatus] = mapped_column(
        Enum(InventoryLotStatus, native_enum=False),
        default=InventoryLotStatus.AVAILABLE, nullable=False
    )

    sorting_record: Mapped["SortingRecord"] = relationship(
        "SortingRecord", back_populates="inventory_lots"
    )
    category: Mapped["WasteCategory"] = relationship("WasteCategory", back_populates="inventory_lots")
    marketplace_listings: Mapped[list["MarketplaceListing"]] = relationship(
        "MarketplaceListing", back_populates="inventory_lot"
    )

    __table_args__ = (
        Index("idx_inventory_lot_code", "lot_code"),
        Index("idx_inventory_category_grade", "category_id", "purity_grade", "status"),
        CheckConstraint(
            "initial_quantity_kg > 0 AND available_quantity_kg >= 0 AND reserved_quantity_kg >= 0",
            name="chk_inventory_qty_positive"
        ),
    )


# ---------------------------------------------------------------------------
# Pricing Rules
# ---------------------------------------------------------------------------

class PricingRule(Base):
    """Dynamic pricing rules per material category and grade."""
    __tablename__ = "pricing_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("waste_categories.id", ondelete="RESTRICT"), nullable=False
    )
    purity_grade: Mapped[WastePurityGrade] = mapped_column(
        Enum(WastePurityGrade, native_enum=False), nullable=False
    )
    base_benchmark_price_per_kg: Mapped[float] = mapped_column(Double, nullable=False)
    floor_price_per_kg: Mapped[float] = mapped_column(Double, nullable=False)
    ceiling_price_per_kg: Mapped[float] = mapped_column(Double, nullable=False)
    moisture_penalty_multiplier: Mapped[float] = mapped_column(Double, default=0.02, nullable=False)
    contamination_penalty_multiplier: Mapped[float] = mapped_column(Double, default=0.05, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    effective_to: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    category: Mapped["WasteCategory"] = relationship("WasteCategory", back_populates="pricing_rules")


# ---------------------------------------------------------------------------
# Marketplace Listings
# ---------------------------------------------------------------------------

class MarketplaceListing(Base, TimestampMixin):
    """Commercial offer for a sorted recyclable lot."""
    __tablename__ = "marketplace_listings"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    listing_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    seller_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    inventory_lot_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("inventory_lots.id", ondelete="RESTRICT"), nullable=False
    )
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("waste_categories.id", ondelete="RESTRICT"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    purity_grade: Mapped[WastePurityGrade] = mapped_column(
        Enum(WastePurityGrade, native_enum=False), nullable=False
    )
    listing_type: Mapped[ListingType] = mapped_column(
        Enum(ListingType, native_enum=False), default=ListingType.FIXED_PRICE, nullable=False
    )
    available_quantity_kg: Mapped[float] = mapped_column(Double, nullable=False)
    min_order_quantity_kg: Mapped[float] = mapped_column(Double, default=100.0, nullable=False)
    unit_price_per_kg: Mapped[float] = mapped_column(Double, nullable=False)
    calculated_floor_price: Mapped[float] = mapped_column(Double, nullable=False)
    estimated_co2_offset_total: Mapped[float] = mapped_column(Double, nullable=False)
    status: Mapped[ListingStatus] = mapped_column(
        Enum(ListingStatus, native_enum=False), default=ListingStatus.ACTIVE, nullable=False
    )
    auction_ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    inventory_lot: Mapped["InventoryLot"] = relationship(
        "InventoryLot", back_populates="marketplace_listings"
    )
    category: Mapped["WasteCategory"] = relationship(
        "WasteCategory", back_populates="marketplace_listings"
    )
    bids: Mapped[list["Bid"]] = relationship("Bid", back_populates="listing")
    purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(
        "PurchaseOrder", back_populates="listing"
    )

    __table_args__ = (
        Index("idx_listings_catalog_search", "category_id", "status", "unit_price_per_kg"),
        Index("idx_listings_seller", "seller_id", "status"),
        CheckConstraint(
            "available_quantity_kg > 0 AND min_order_quantity_kg > 0",
            name="chk_listing_quantities"
        ),
        CheckConstraint(
            "unit_price_per_kg > 0 AND unit_price_per_kg >= calculated_floor_price",
            name="chk_listing_unit_price"
        ),
    )


# ---------------------------------------------------------------------------
# Bids
# ---------------------------------------------------------------------------

class Bid(Base, TimestampMixin):
    """B2B procurement bid placed by a certified buyer."""
    __tablename__ = "bids"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    listing_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("marketplace_listings.id", ondelete="RESTRICT"), nullable=False
    )
    buyer_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    bid_price_per_kg: Mapped[float] = mapped_column(Double, nullable=False)
    requested_quantity_kg: Mapped[float] = mapped_column(Double, nullable=False)
    total_bid_amount: Mapped[float] = mapped_column(Double, nullable=False)
    status: Mapped[BidStatus] = mapped_column(
        Enum(BidStatus, native_enum=False), default=BidStatus.PENDING, nullable=False
    )
    valid_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    listing: Mapped["MarketplaceListing"] = relationship("MarketplaceListing", back_populates="bids")

    __table_args__ = (
        Index("idx_bids_listing_rank", "listing_id", "bid_price_per_kg", "created_at"),
        Index("idx_bids_buyer", "buyer_id", "status"),
        CheckConstraint(
            "bid_price_per_kg > 0 AND requested_quantity_kg > 0 AND total_bid_amount > 0",
            name="chk_bid_values"
        ),
    )


# ---------------------------------------------------------------------------
# Purchase Orders
# ---------------------------------------------------------------------------

class PurchaseOrder(Base, TimestampMixin):
    """Binding commercial contract between buyer and seller with escrow."""
    __tablename__ = "purchase_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    listing_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("marketplace_listings.id", ondelete="RESTRICT"), nullable=False
    )
    buyer_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    seller_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    accepted_bid_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("bids.id", ondelete="SET NULL"), nullable=True
    )
    quantity_kg: Mapped[float] = mapped_column(Double, nullable=False)
    unit_price_per_kg: Mapped[float] = mapped_column(Double, nullable=False)
    subtotal_amount: Mapped[float] = mapped_column(Double, nullable=False)
    platform_fee_amount: Mapped[float] = mapped_column(Double, nullable=False)
    total_gross_amount: Mapped[float] = mapped_column(Double, nullable=False)
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, native_enum=False), default=PaymentStatus.PENDING, nullable=False
    )
    fulfillment_status: Mapped[FulfillmentStatus] = mapped_column(
        Enum(FulfillmentStatus, native_enum=False), default=FulfillmentStatus.PENDING, nullable=False
    )
    payment_gateway_ref: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    listing: Mapped["MarketplaceListing"] = relationship(
        "MarketplaceListing", back_populates="purchase_orders"
    )

    __table_args__ = (
        Index("idx_po_number", "order_number"),
        Index("idx_po_buyer", "buyer_id", "fulfillment_status"),
        Index("idx_po_seller", "seller_id", "fulfillment_status"),
        CheckConstraint(
            "quantity_kg > 0 AND unit_price_per_kg > 0 AND total_gross_amount > 0",
            name="chk_po_amounts"
        ),
    )


# ---------------------------------------------------------------------------
# Reward Wallets & Transactions
# ---------------------------------------------------------------------------

class RewardWallet(Base):
    """Green points balance for a user — one-to-one with User."""
    __tablename__ = "reward_wallets"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        unique=True, nullable=False
    )
    available_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    lifetime_earned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    lifetime_redeemed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="reward_wallet")
    transactions: Mapped[list["RewardTransaction"]] = relationship(
        "RewardTransaction", back_populates="wallet"
    )

    __table_args__ = (Index("idx_reward_wallet_user", "user_id"),)


class RewardTransaction(Base):
    """Immutable reward ledger entry — append-only, never updated."""
    __tablename__ = "reward_transactions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    wallet_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("reward_wallets.id", ondelete="RESTRICT"), nullable=False
    )
    intake_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("waste_intakes.id", ondelete="SET NULL"), nullable=True
    )
    order_id: Mapped[Optional[uuid.UUID]] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    points_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    transaction_type: Mapped[RewardTransactionType] = mapped_column(
        Enum(RewardTransactionType, native_enum=False), nullable=False
    )
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    wallet: Mapped["RewardWallet"] = relationship("RewardWallet", back_populates="transactions")

    __table_args__ = (Index("idx_reward_tx_wallet", "wallet_id", "created_at"),)


# ---------------------------------------------------------------------------
# B2C Eco-Store
# ---------------------------------------------------------------------------

class EcoProduct(Base):
    """Upcycled / recycled consumer product in the B2C Eco-Store."""
    __tablename__ = "eco_products"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[EcoProductCategory] = mapped_column(
        Enum(EcoProductCategory, native_enum=False), nullable=False
    )
    price_fiat: Mapped[float] = mapped_column(Double, nullable=False)
    max_points_discount_percent: Mapped[float] = mapped_column(Double, default=50.0, nullable=False)
    stock_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    carbon_offset_kg: Mapped[float] = mapped_column(Double, default=0.0, nullable=False)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (Index("idx_eco_products_cat_stock", "category", "stock_quantity"),)


class EcoOrder(Base):
    """Consumer order placed through the B2C Eco-Store."""
    __tablename__ = "eco_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    gross_amount: Mapped[float] = mapped_column(Double, nullable=False)
    points_redeemed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    points_discount_amount: Mapped[float] = mapped_column(Double, default=0.0, nullable=False)
    net_payable_amount: Mapped[float] = mapped_column(Double, nullable=False)
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, native_enum=False), default=PaymentStatus.PENDING, nullable=False
    )
    payment_gateway_ref: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    shipping_address: Mapped[str] = mapped_column(Text, nullable=False)
    items_snapshot: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (Index("idx_eco_orders_user", "user_id", "created_at"),)


# Segment 2.2a models
from app.models.pickup import PickupRequest, PickupStatus
from app.models.weight_ticket import WeightTicket, WeightMethod
