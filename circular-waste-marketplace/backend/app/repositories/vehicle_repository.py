"""Vehicle repository — SQLAlchemy 2.x async."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vehicle import Vehicle


class VehicleRepository:
    @staticmethod
    async def create(session: AsyncSession, **fields) -> Vehicle:
        vehicle = Vehicle(**fields)
        session.add(vehicle)
        await session.flush()
        await session.refresh(vehicle)
        return vehicle

    @staticmethod
    async def get_by_id(session: AsyncSession, vehicle_id: uuid.UUID) -> Vehicle | None:
        result = await session.execute(select(Vehicle).where(Vehicle.id == vehicle_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_plate(session: AsyncSession, plate: str) -> Vehicle | None:
        result = await session.execute(
            select(Vehicle).where(Vehicle.plate_number == plate.strip().upper())
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def list_all(
        session: AsyncSession,
        status: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[Vehicle], int]:
        q = select(Vehicle).order_by(Vehicle.created_at.desc())
        count_q = select(func.count()).select_from(Vehicle)
        if status:
            q = q.where(Vehicle.status == status)
            count_q = count_q.where(Vehicle.status == status)
        total = (await session.execute(count_q)).scalar_one()
        vehicles = (await session.execute(q.limit(limit).offset(offset))).scalars().all()
        return list(vehicles), total

    @staticmethod
    async def update(session: AsyncSession, vehicle: Vehicle, **fields) -> Vehicle:
        for k, v in fields.items():
            if v is not None:
                setattr(vehicle, k, v)
        session.add(vehicle)
        await session.flush()
        await session.refresh(vehicle)
        return vehicle

    @staticmethod
    async def assign_driver(
        session: AsyncSession, vehicle: Vehicle, driver_user_id: uuid.UUID
    ) -> Vehicle:
        vehicle.assigned_driver_user_id = driver_user_id
        session.add(vehicle)
        await session.flush()
        await session.refresh(vehicle)
        return vehicle

    @staticmethod
    async def update_location(
        session: AsyncSession,
        vehicle: Vehicle,
        lat: Decimal,
        lng: Decimal,
        source: str,
    ) -> Vehicle:
        now = datetime.now(timezone.utc)
        await session.execute(
            update(Vehicle)
            .where(Vehicle.id == vehicle.id)
            .values(
                current_lat=lat,
                current_lng=lng,
                last_ping_at=now,
                last_ping_source=source,
            )
        )
        await session.refresh(vehicle)
        return vehicle
