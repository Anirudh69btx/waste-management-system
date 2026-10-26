"""
Circular Waste Marketplace — WeightTicket Model
================================================
Physical scale weight records and weighbridge manifests for incoming waste.
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models import User, WasteIntake
    from app.models.pickup import PickupRequest


class WeightMethod(str, enum.Enum):
    """Methods used to capture consignments weight."""
    MANUAL = "manual"
    DEMO = "demo"
    DIGITAL_SCALE = "digital_scale"
    WEIGHBRIDGE = "weighbridge"


class WeightTicket(Base, TimestampMixin):
    """Physical scale weight certificate for waste consignments."""
    __tablename__ = "weight_tickets"
    __table_args__ = (
        CheckConstraint(
            "weight_method IN ('manual', 'demo', 'digital_scale', 'weighbridge')",
            name="ck_weight_tickets_method",
        ),
        CheckConstraint("gross_weight_kg > 0", name="ck_weight_tickets_gross_positive"),
        CheckConstraint("tare_weight_kg >= 0", name="ck_weight_tickets_tare_non_negative"),
        CheckConstraint("net_weight_kg > 0", name="ck_weight_tickets_net_positive"),
        CheckConstraint(
            "abs(net_weight_kg - (gross_weight_kg - tare_weight_kg)) < 0.001",
            name="ck_weight_tickets_net_calc",
        ),
        Index("idx_weight_tickets_intake_id", "intake_id"),
        Index("idx_weight_tickets_recorded_at_desc", text("recorded_at DESC")),
        Index("idx_weight_tickets_method", "weight_method"),
        Index("idx_weight_tickets_intake_recorded", "intake_id", text("recorded_at DESC")),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    intake_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("waste_intakes.id", ondelete="RESTRICT"),
        nullable=False,
    )
    pickup_request_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("pickup_requests.id", ondelete="SET NULL"),
        nullable=True,
    )
    weight_method: Mapped[str] = mapped_column(String(32), nullable=False)
    gross_weight_kg: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    tare_weight_kg: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    net_weight_kg: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    scale_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    scale_calibration_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    photo_paths: Mapped[list[str]] = mapped_column(
        JSONB, server_default="[]", default=list, nullable=False
    )
    recorded_by_user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    discrepancy_flag: Mapped[bool] = mapped_column(
        Boolean, server_default="false", default=False, nullable=False
    )
    discrepancy_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    supplier_confirmed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    supplier_dispute_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dispute_resolution: Mapped[str | None] = mapped_column(String(32), nullable=True)  # upheld | rejected
    dispute_resolved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    dispute_resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dispute_resolution_note: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    # Relationships
    intake: Mapped["WasteIntake"] = relationship("WasteIntake", back_populates="weight_tickets")
    pickup_request: Mapped[Optional["PickupRequest"]] = relationship(
        "PickupRequest", back_populates="weight_tickets"
    )
    recorded_by: Mapped["User"] = relationship("User", foreign_keys=[recorded_by_user_id])
