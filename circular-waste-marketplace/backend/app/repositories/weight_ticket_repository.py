"""
Circular Waste Marketplace — Weight Ticket Repository
======================================================
Database access layer for WeightTicket physical weight records.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import WeightTicket


class WeightTicketRepository:
    """Repository managing WeightTicket database persistence and queries."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create(self, ticket: WeightTicket) -> WeightTicket:
        """Add and flush a new WeightTicket."""
        self._db.add(ticket)
        await self._db.flush()
        return ticket

    async def get_by_id(self, ticket_id: uuid.UUID) -> Optional[WeightTicket]:
        """Fetch weight ticket by primary key with relations."""
        query = (
            select(WeightTicket)
            .where(WeightTicket.id == ticket_id)
            .options(
                selectinload(WeightTicket.intake),
                selectinload(WeightTicket.pickup_request),
                selectinload(WeightTicket.recorded_by),
            )
        )
        result = await self._db.execute(query)
        return result.scalar_one_or_none()

    async def get_by_intake(self, intake_id: uuid.UUID) -> Optional[WeightTicket]:
        """Fetch the latest weight ticket recorded for a specific intake."""
        query = (
            select(WeightTicket)
            .where(WeightTicket.intake_id == intake_id)
            .order_by(WeightTicket.recorded_at.desc())
            .options(
                selectinload(WeightTicket.intake),
                selectinload(WeightTicket.pickup_request),
                selectinload(WeightTicket.recorded_by),
            )
        )
        result = await self._db.execute(query)
        return result.scalar_one_or_none()

    async def list_by_method_in_range(
        self,
        method: str,
        start: datetime,
        end: datetime,
    ) -> list[WeightTicket]:
        """List weight tickets for a specific method within a recorded_at timestamp range."""
        query = (
            select(WeightTicket)
            .where(
                WeightTicket.weight_method == method,
                WeightTicket.recorded_at >= start,
                WeightTicket.recorded_at <= end,
            )
            .order_by(WeightTicket.recorded_at.asc())
        )
        result = await self._db.execute(query)
        return list(result.scalars().all())
