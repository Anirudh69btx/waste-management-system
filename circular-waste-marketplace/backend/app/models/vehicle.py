from __future__ import annotations

import uuid
from decimal import Decimal
from datetime import datetime

from sqlalchemy import Numeric, String, DateTime, Boolean, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plate_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    capacity_kg: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    fuel_type: Mapped[str] = mapped_column(String(32), nullable=False, default="diesel")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="available", index=True)
    assigned_driver_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    current_lat: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    current_lng: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    last_ping_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_ping_source: Mapped[str | None] = mapped_column(String(16), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    trips: Mapped[list["Trip"]] = relationship("Trip", back_populates="vehicle")
