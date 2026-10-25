"""GPS service — Location tracking and ping ingestion."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.geo import haversine_km
from app.core.logging import get_logger
from app.models.gps_ping import GpsPing
from app.repositories.gps_repository import GpsRepository
from app.repositories.trip_repository import TripRepository
from app.repositories.vehicle_repository import VehicleRepository
from app.schemas.gps_schemas import (
    GpsPingCreate,
    GpsPingRead,
    VehicleLocationRead,
    VehicleRouteResponse,
)

logger = get_logger(__name__)


class GpsService:
    @staticmethod
    def _get_role(user: Any) -> str:
        role = getattr(user, "role", None)
        if hasattr(role, "value"):
            return str(role.value).upper()
        return str(role).upper() if role else ""

    @staticmethod
    def _get_user_id(user: Any) -> uuid.UUID:
        uid = getattr(user, "id", None) or getattr(user, "sub", None)
        if isinstance(uid, uuid.UUID):
            return uid
        return uuid.UUID(str(uid))

    @classmethod
    async def record_ping(
        cls,
        user: Any,
        payload: GpsPingCreate,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> GpsPing:
        vehicle = await VehicleRepository.get_by_id(session, payload.vehicle_id)
        if not vehicle:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle not found.",
            )

        role = cls._get_role(user)
        uid = cls._get_user_id(user)

        # Authorization checks per source:
        # device source requires caller = assigned driver or ADMIN
        # simulated source requires ADMIN
        # manual source requires ADMIN or assigned driver
        if payload.source == "simulated":
            if role != "ADMIN":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only administrators can record simulated GPS pings.",
                )
        else:
            if role != "ADMIN" and vehicle.assigned_driver_user_id != uid:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Caller must be the assigned driver or an administrator.",
                )

        active_trip = await TripRepository.get_active_for_vehicle(
            session, payload.vehicle_id
        )
        trip_id = active_trip.id if active_trip else None

        ping = await cls.record_ping_internal(
            session=session,
            vehicle_id=payload.vehicle_id,
            trip_id=trip_id,
            lat=payload.lat,
            lng=payload.lng,
            speed_kmh=payload.speed_kmh,
            heading=payload.heading,
            source=payload.source,
            recorded_at=payload.recorded_at,
            request_id=request_id,
        )
        await session.commit()
        return ping

    @classmethod
    async def record_ping_internal(
        cls,
        session: AsyncSession,
        vehicle_id: uuid.UUID,
        trip_id: uuid.UUID | None,
        lat: Decimal,
        lng: Decimal,
        speed_kmh: Decimal | None,
        heading: Decimal | None,
        source: str,
        recorded_at: datetime | None = None,
        request_id: str | None = None,
    ) -> GpsPing:
        vehicle = await VehicleRepository.get_by_id(session, vehicle_id)
        if not vehicle:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle not found for GPS ping.",
            )

        ping_time = recorded_at or datetime.now(timezone.utc)
        ping = await GpsRepository.create_ping(
            session,
            vehicle_id=vehicle_id,
            trip_id=trip_id,
            lat=lat,
            lng=lng,
            speed_kmh=speed_kmh,
            heading=heading,
            source=source,
            recorded_at=ping_time,
        )

        await VehicleRepository.update_location(
            session,
            vehicle=vehicle,
            lat=lat,
            lng=lng,
            source=source,
        )

        logger.info(
            "gps.ping_recorded",
            vehicle_id=str(vehicle_id),
            source=source,
            request_id=request_id,
        )
        return ping

    @classmethod
    async def get_current_location(
        cls,
        user: Any,
        vehicle_id: uuid.UUID,
        session: AsyncSession,
    ) -> VehicleLocationRead:
        vehicle = await VehicleRepository.get_by_id(session, vehicle_id)
        if not vehicle:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle not found.",
            )

        latest_ping = await GpsRepository.get_latest_for_vehicle(session, vehicle_id)
        return VehicleLocationRead(
            vehicle_id=vehicle.id,
            plate_number=vehicle.plate_number,
            lat=vehicle.current_lat,
            lng=vehicle.current_lng,
            speed_kmh=latest_ping.speed_kmh if latest_ping else None,
            heading=latest_ping.heading if latest_ping else None,
            recorded_at=vehicle.last_ping_at,
            source=vehicle.last_ping_source,
            is_simulated=(vehicle.last_ping_source == "simulated"),
        )

    @classmethod
    async def get_route_history(
        cls,
        user: Any,
        vehicle_id: uuid.UUID,
        limit: int,
        session: AsyncSession,
    ) -> VehicleRouteResponse:
        vehicle = await VehicleRepository.get_by_id(session, vehicle_id)
        if not vehicle:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle not found.",
            )

        pings = await GpsRepository.get_recent_for_vehicle(
            session, vehicle_id, limit=limit
        )
        # Reverse to chronological order (oldest to newest)
        chrono_pings = list(reversed(pings))
        total_dist = 0.0
        for i in range(1, len(chrono_pings)):
            total_dist += haversine_km(
                float(chrono_pings[i - 1].lat),
                float(chrono_pings[i - 1].lng),
                float(chrono_pings[i].lat),
                float(chrono_pings[i].lng),
            )

        pings_read = [GpsPingRead.model_validate(p) for p in chrono_pings]
        return VehicleRouteResponse(
            vehicle_id=vehicle.id,
            pings=pings_read,
            total_distance_km=round(total_dist, 2),
        )
