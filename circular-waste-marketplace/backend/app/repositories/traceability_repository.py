"""Traceability repository — append-only audit log. No update/delete methods."""
from __future__ import annotations

import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.traceability_event import TraceabilityEvent


class TraceabilityRepository:
    """Append-only repository for traceability events. No update or delete operations allowed."""

    @staticmethod
    async def append(session: AsyncSession, **fields) -> TraceabilityEvent:
        event = TraceabilityEvent(**fields)
        session.add(event)
        await session.flush()
        await session.refresh(event)
        return event

    @staticmethod
    async def list_for_batch(session: AsyncSession, batch_id: uuid.UUID) -> list[TraceabilityEvent]:
        result = await session.execute(
            select(TraceabilityEvent)
            .where(TraceabilityEvent.batch_id == batch_id)
            .order_by(TraceabilityEvent.created_at.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def list_by_type(
        session: AsyncSession, event_type: str, limit: int = 50
    ) -> list[TraceabilityEvent]:
        result = await session.execute(
            select(TraceabilityEvent)
            .where(TraceabilityEvent.event_type == event_type)
            .order_by(TraceabilityEvent.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
