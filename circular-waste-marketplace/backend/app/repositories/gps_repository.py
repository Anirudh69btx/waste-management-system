"""GPS ping repository — SQLAlchemy 2.x async."""
from __future__ import annotations

import math
import uuid
from datetime import datetime

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gps_ping import GpsPing


class GpsRepository:
    @staticmethod
    async def create_ping(session: AsyncSession, **fields) -> GpsPing:
        ping = GpsPing(**fields)
        session.add(ping)
        await session.flush()
        await session.refresh(ping)
        return ping

    @staticmethod
    async def get_latest_for_vehicle(
        session: AsyncSession, vehicle_id: uuid.UUID
    ) -> GpsPing | None:
        result = await session.execute(
            select(GpsPing)
            .where(GpsPing.vehicle_id == vehicle_id)
            .order_by(GpsPing.recorded_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_recent_for_vehicle(
        session: AsyncSession, vehicle_id: uuid.UUID, limit: int = 50
    ) -> list[GpsPing]:
        result = await session.execute(
            select(GpsPing)
            .where(GpsPing.vehicle_id == vehicle_id)
            .order_by(GpsPing.recorded_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_pings_for_trip(
        session: AsyncSession, trip_id: uuid.UUID, limit: int = 500
    ) -> list[GpsPing]:
        result = await session.execute(
            select(GpsPing)
            .where(GpsPing.trip_id == trip_id)
            .order_by(GpsPing.recorded_at.asc())
            .limit(limit)
        )
        return list(result.scalars().all())

    @staticmethod
    async def delete_older_than(
        session: AsyncSession, cutoff_datetime: datetime
    ) -> int:
        result = await session.execute(
            delete(GpsPing).where(GpsPing.recorded_at < cutoff_datetime)
        )
        return result.rowcount

    @staticmethod
    async def compute_distance_km_for_trip(
        session: AsyncSession, trip_id: uuid.UUID
    ) -> float:
        pings = await GpsRepository.get_pings_for_trip(session, trip_id, limit=5000)
        if len(pings) < 2:
            return 0.0

        r = 6371.0  # Earth's radius in km
        total_dist = 0.0

        for i in range(1, len(pings)):
            lat1 = math.radians(float(pings[i - 1].lat))
            lon1 = math.radians(float(pings[i - 1].lng))
            lat2 = math.radians(float(pings[i].lat))
            lon2 = math.radians(float(pings[i].lng))

            dlat = lat2 - lat1
            dlon = lon2 - lon1

            a = (
                math.sin(dlat / 2) ** 2
                + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
            )
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            total_dist += r * c

        return round(total_dist, 3)
