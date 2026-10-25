from __future__ import annotations
import uuid
from decimal import Decimal
from datetime import datetime
from sqlalchemy import Numeric, String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class SortingRecord(Base):
    __tablename__ = "sorting_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    intake_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("waste_intakes.id", ondelete="RESTRICT"), nullable=False, index=True)
    sorter_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    input_weight_kg: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    sorted_weight_kg: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False)
    rejected_weight_kg: Mapped[Decimal] = mapped_column(Numeric(10, 3), nullable=False, default=Decimal("0"))
    contamination_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False, default=Decimal("0"))
    sort_grade: Mapped[str] = mapped_column(String(16), nullable=False)  # GRADE_A | GRADE_B | GRADE_C
    moisture_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    photos: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    request_id_correlation: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
