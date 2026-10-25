"""Trip repository — SQLAlchemy 2.x async."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trip import Trip, TripStop


class TripRepository:
    @staticmethod
    async def create(
        session: AsyncSession,
        trip_data: dict,
        stops_data: list[dict],
    ) -> Trip:
        trip = Trip(**trip_data)
        session.add(trip)
        await session.flush()
        for sd in stops_data:
            stop = TripStop(trip_id=trip.id, **sd)
            session.add(stop)
        await session.flush()
        result = await session.execute(
            select(Trip)
            .options(selectinload(Trip.stops), selectinload(Trip.vehicle))
            .where(Trip.id == trip.id)
        )
        return result.scalar_one()

    @staticmethod
    async def get_by_id(session: AsyncSession, trip_id: uuid.UUID) -> Trip | None:
        result = await session.execute(
            select(Trip)
            .options(selectinload(Trip.stops), selectinload(Trip.vehicle))
            .where(Trip.id == trip_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_active_for_driver(
        session: AsyncSession, driver_user_id: uuid.UUID
    ) -> Trip | None:
        result = await session.execute(
            select(Trip)
            .options(selectinload(Trip.stops))
            .where(
                Trip.driver_user_id == driver_user_id,
                Trip.status.in_(["planned", "in_progress"]),
            )
            .limit(1)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_active_for_vehicle(
        session: AsyncSession, vehicle_id: uuid.UUID
    ) -> Trip | None:
        result = await session.execute(
            select(Trip)
            .where(
                Trip.vehicle_id == vehicle_id,
                Trip.status.in_(["planned", "in_progress"]),
            )
            .limit(1)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_all(
        session: AsyncSession,
        status: str | None = None,
        driver_user_id: uuid.UUID | None = None,
        vehicle_id: uuid.UUID | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Trip], int]:
        q = select(Trip).options(selectinload(Trip.stops))
        count_q = select(func.count()).select_from(Trip)
        if status:
            q = q.where(Trip.status == status)
            count_q = count_q.where(Trip.status == status)
        if driver_user_id:
            q = q.where(Trip.driver_user_id == driver_user_id)
            count_q = count_q.where(Trip.driver_user_id == driver_user_id)
        if vehicle_id:
            q = q.where(Trip.vehicle_id == vehicle_id)
            count_q = count_q.where(Trip.vehicle_id == vehicle_id)
        total = (await session.execute(count_q)).scalar_one()
        trips = (await session.execute(q.order_by(Trip.created_at.desc()).limit(limit).offset(offset))).scalars().all()
        return list(trips), total

    @staticmethod
    async def update_status(session: AsyncSession, trip: Trip, new_status: str) -> Trip:
        trip.status = new_status
        session.add(trip)
        await session.flush()
        await session.refresh(trip)
        return trip

    @staticmethod
    async def start_trip(session: AsyncSession, trip: Trip) -> Trip:
        trip.status = "in_progress"
        trip.started_at = datetime.now(timezone.utc)
        session.add(trip)
        await session.flush()
        await session.refresh(trip)
        return trip

    @staticmethod
    async def end_trip(
        session: AsyncSession, trip: Trip, actual_distance_km: Decimal | None = None
    ) -> Trip:
        trip.status = "completed"
        trip.ended_at = datetime.now(timezone.utc)
        if actual_distance_km is not None:
            trip.actual_distance_km = actual_distance_km
        session.add(trip)
        await session.flush()
        await session.refresh(trip)
        return trip

    @staticmethod
    async def update_totals(
        session: AsyncSession, trip: Trip, total_weight_kg: Decimal
    ) -> Trip:
        trip.total_weight_kg = total_weight_kg
        session.add(trip)
        await session.flush()
        await session.refresh(trip)
        return trip
