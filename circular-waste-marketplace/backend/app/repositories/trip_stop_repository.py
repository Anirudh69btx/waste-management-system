"""TripStop repository — SQLAlchemy 2.x async."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trip import TripStop


class TripStopRepository:
    @staticmethod
    async def get_by_id(session: AsyncSession, stop_id: uuid.UUID) -> TripStop | None:
        result = await session.execute(
            select(TripStop).where(TripStop.id == stop_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_for_trip(session: AsyncSession, trip_id: uuid.UUID) -> list[TripStop]:
        result = await session.execute(
            select(TripStop)
            .where(TripStop.trip_id == trip_id)
            .order_by(TripStop.sequence.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def update_status(
        session: AsyncSession, stop: TripStop, new_status: str
    ) -> TripStop:
        stop.status = new_status
        session.add(stop)
        await session.flush()
        await session.refresh(stop)
        return stop

    @staticmethod
    async def set_arrived(session: AsyncSession, stop: TripStop) -> TripStop:
        stop.status = "arrived"
        stop.arrived_at = datetime.now(timezone.utc)
        session.add(stop)
        await session.flush()
        await session.refresh(stop)
        return stop

    @staticmethod
    async def set_completed(session: AsyncSession, stop: TripStop) -> TripStop:
        stop.status = "completed"
        stop.completed_at = datetime.now(timezone.utc)
        session.add(stop)
        await session.flush()
        await session.refresh(stop)
        return stop

    @staticmethod
    async def set_failure(
        session: AsyncSession, stop: TripStop, reason: str
    ) -> TripStop:
        stop.status = "failed"
        stop.failure_reason = reason
        session.add(stop)
        await session.flush()
        await session.refresh(stop)
        return stop
