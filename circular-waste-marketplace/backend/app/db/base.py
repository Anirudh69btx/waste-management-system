"""
Circular Waste Marketplace — SQLAlchemy Declarative Base
=========================================================
All models must inherit from ``Base``. Import this module in
Alembic's env.py so migrations detect model metadata automatically.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """
    Project-wide declarative base.

    Includes auto-managed ``created_at`` / ``updated_at`` timestamps
    that are inherited by all concrete model classes.
    """
    pass


class TimestampMixin:
    """
    Mixin that adds server-side ``created_at`` and ``updated_at`` columns.

    Uses ``func.now()`` so the database clock governs the timestamps,
    eliminating clock-skew between application servers.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        doc="UTC timestamp when this record was created.",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        default=lambda: datetime.now(timezone.utc),
        onupdate=func.now(),
        nullable=False,
        doc="UTC timestamp of the last modification.",
    )
