"""
Circular Waste Marketplace — PickupRequest Model
=================================================
Manages supplier pickup scheduling, logistics dispatch, and transit lifecycle.
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models import User, WasteIntake
    from app.models.weight_ticket import WeightTicket


class PickupStatus(str, enum.Enum):
    """FSM states for a waste pickup request."""
    REQUESTED = "requested"
    ACCEPTED = "accepted"
    EN_ROUTE = "en_route"
    ARRIVED = "arrived"
    PICKED_UP = "picked_up"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class PickupRequest(Base, TimestampMixin):
    """Pickup request coordinating driver collection of a submitted waste consignment."""
    __tablename__ = "pickup_requests"
    __table_args__ = (
        CheckConstraint(
            "status IN ('requested', 'accepted', 'en_route', 'arrived', 'picked_up', 'completed', 'cancelled', 'failed')",
            name="ck_pickup_requests_status",
        ),
        Index("idx_pickup_requests_intake_id", "intake_id", unique=True),
        Index("idx_pickup_requests_driver", "assigned_driver_user_id"),
        Index("idx_pickup_requests_status", "status"),
        Index("idx_pickup_requests_sched_start", "scheduled_start"),
        Index(
            "idx_pickup_requests_driver_status_start",
            "assigned_driver_user_id",
            "status",
            "scheduled_start",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    intake_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("waste_intakes.id", ondelete="RESTRICT"),
        nullable=False,
    )
    requested_by_user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    assigned_driver_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    scheduled_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    scheduled_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    actual_pickup_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(32), server_default="requested", nullable=False, default=PickupStatus.REQUESTED.value
    )
    cancellation_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    request_id_correlation: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True
    )

    # Relationships
    intake: Mapped["WasteIntake"] = relationship("WasteIntake", back_populates="pickup_request")
    requested_by: Mapped["User"] = relationship("User", foreign_keys=[requested_by_user_id])
    assigned_driver: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[assigned_driver_user_id]
    )
    weight_tickets: Mapped[list["WeightTicket"]] = relationship(
        "WeightTicket", back_populates="pickup_request"
    )
