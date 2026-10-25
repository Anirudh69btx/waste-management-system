from __future__ import annotations
import uuid
from decimal import Decimal
from datetime import datetime
from sqlalchemy import Numeric, String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class InventoryLot(Base):
    __tablename__ = "inventory_lots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lot_code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    intake_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("waste_intakes.id", ondelete="RESTRICT"), nullable=False, index=True)
    sorting_record_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sorting_records.id", ondelete="RESTRICT"), nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("waste_categories.id", ondelete="RESTRICT"), nullable=False, index=True)
    quantity_kg: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    available_kg: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    grade: Mapped[str] = mapped_column(String(16), nullable=False)
    contamination_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0"))
    moisture_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="available", index=True)  # available | reserved | sold | archived
    hub_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
