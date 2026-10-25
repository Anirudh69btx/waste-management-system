"""GPS Simulation service — Simulates vehicle movement along trip routes."""
from __future__ import annotations

import random
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.geo import bearing_degrees, move_towards
from app.core.logging import get_logger
from app.core.settings import get_settings
from app.models import PickupRequest, WasteIntake
from app.models.trip import Trip, TripStop
from app.models.vehicle import Vehicle
from app.services.gps_service import GpsService

logger = get_logger(__name__)


async def tick_simulation(session: AsyncSession, request_id: str = "sim-tick") -> int:
    settings = get_settings()
    sim_enabled = str(getattr(settings, "GPS_SIMULATION_ENABLED", "false")).lower() == "true"
    if not sim_enabled:
        return 0

    trips_res = await session.execute(
        select(Trip)
        .options(selectinload(Trip.stops), selectinload(Trip.vehicle))
        .where(Trip.status == "in_progress")
    )
    trips = list(trips_res.scalars().all())
    count = 0

    for trip in trips:
        vehicle: Vehicle = trip.vehicle
        if not vehicle or vehicle.status != "in_use":
            continue

        en_route_stops = [s for s in trip.stops if s.status == "en_route"]
        if not en_route_stops:
            continue

        target_stop = sorted(en_route_stops, key=lambda s: s.sequence)[0]
        pickup_res = await session.execute(
            select(PickupRequest)
            .options(selectinload(PickupRequest.intake).selectinload(WasteIntake.supplier))
            .where(PickupRequest.id == target_stop.pickup_request_id)
        )
        pickup = pickup_res.scalar_one_or_none()
        if not pickup or not pickup.intake or not pickup.intake.supplier:
            continue

        supplier = pickup.intake.supplier
        if supplier.latitude is None or supplier.longitude is None:
            continue

        target_lat = float(supplier.latitude)
        target_lng = float(supplier.longitude)

        curr_lat = (
            float(vehicle.current_lat)
            if vehicle.current_lat is not None
            else target_lat - 0.015
        )
        curr_lng = (
            float(vehicle.current_lng)
            if vehicle.current_lng is not None
            else target_lng - 0.015
        )

        step_dist_km = 0.2  # ~200 meters step
        next_lat, next_lng = move_towards(
            curr_lat, curr_lng, target_lat, target_lng, step_dist_km
        )
        heading_val = bearing_degrees(curr_lat, curr_lng, target_lat, target_lng)
        speed_val = random.uniform(15.0, 40.0)

        await GpsService.record_ping_internal(
            session=session,
            vehicle_id=vehicle.id,
            trip_id=trip.id,
            lat=Decimal(str(next_lat)),
            lng=Decimal(str(next_lng)),
            speed_kmh=Decimal(str(round(speed_val, 1))),
            heading=Decimal(str(round(heading_val, 1))),
            source="simulated",
            request_id=request_id,
        )
        count += 1

    if count > 0:
        await session.commit()
        logger.info(
            "gps.simulation_tick",
            updated_count=count,
            request_id=request_id,
        )

    return count
