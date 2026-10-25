"""Route service — Capacity and stream-aware route suggestion."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.geo import haversine_km
from app.core.logging import get_logger
from app.core.settings import get_settings
from app.core.waste_streams import category_to_stream
from app.models import PickupRequest, WasteIntake
from app.repositories.vehicle_repository import VehicleRepository
from app.schemas.route_schemas import RouteSuggestionRequest, RouteSuggestionResponse

logger = get_logger(__name__)


class RouteService:
    @staticmethod
    def _get_role(user: Any) -> str:
        role = getattr(user, "role", None)
        if hasattr(role, "value"):
            return str(role.value).upper()
        return str(role).upper() if role else ""

    @classmethod
    async def suggest_route(
        cls,
        user: Any,
        payload: RouteSuggestionRequest,
        session: AsyncSession,
    ) -> RouteSuggestionResponse:
        if cls._get_role(user) != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can request route suggestions.",
            )

        vehicle = await VehicleRepository.get_by_id(session, payload.vehicle_id)
        if not vehicle:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle not found.",
            )

        pickups: list[PickupRequest] = []
        for pid in payload.pickup_request_ids:
            res = await session.execute(
                select(PickupRequest)
                .options(
                    selectinload(PickupRequest.intake).selectinload(WasteIntake.supplier),
                    selectinload(PickupRequest.intake).selectinload(WasteIntake.category),
                )
                .where(PickupRequest.id == pid)
            )
            pickup = res.scalar_one_or_none()
            if not pickup:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Pickup request {pid} not found.",
                )
            pickups.append(pickup)

        # Group by stream class
        stream_counts: dict[str, list[PickupRequest]] = {}
        for p in pickups:
            cat_id = p.intake.category_id if p.intake else 0
            stream = category_to_stream(cat_id) or "UNKNOWN"
            stream_counts.setdefault(stream, []).append(p)

        # Dominant stream class
        dominant_stream = max(stream_counts.keys(), key=lambda k: len(stream_counts[k]))
        dominant_pickups = stream_counts[dominant_stream]

        excluded_ids: list[uuid.UUID] = []
        for stream, items in stream_counts.items():
            if stream != dominant_stream:
                for item in items:
                    excluded_ids.append(item.id)

        # Determine start coordinates
        settings = get_settings()
        default_lat = float(getattr(settings, "ROUTE_NEAREST_NEIGHBOR_START_LAT", 12.9716))
        default_lng = float(getattr(settings, "ROUTE_NEAREST_NEIGHBOR_START_LNG", 77.5946))

        start_lat = (
            float(vehicle.current_lat)
            if vehicle.current_lat is not None
            else default_lat
        )
        start_lng = (
            float(vehicle.current_lng)
            if vehicle.current_lng is not None
            else default_lng
        )

        curr_lat, curr_lng = start_lat, start_lng
        rem_capacity = float(vehicle.capacity_kg)
        candidates = list(dominant_pickups)
        ordered_ids: list[uuid.UUID] = []
        total_dist = 0.0
        total_weight = 0.0

        def get_pickup_coords(p: PickupRequest) -> tuple[float, float]:
            if p.intake and p.intake.supplier and p.intake.supplier.latitude is not None and p.intake.supplier.longitude is not None:
                return float(p.intake.supplier.latitude), float(p.intake.supplier.longitude)
            return default_lat, default_lng

        while candidates:
            # Pickups that fit into remaining capacity
            fitting = [
                c
                for c in candidates
                if float(c.intake.declared_weight_kg if c.intake and c.intake.declared_weight_kg else 0)
                <= rem_capacity
            ]
            if not fitting:
                # Exclude remaining because of capacity
                for c in candidates:
                    excluded_ids.append(c.id)
                break

            # Nearest neighbor
            def dist_to(c: PickupRequest) -> float:
                clat, clng = get_pickup_coords(c)
                return haversine_km(curr_lat, curr_lng, clat, clng)

            nearest = min(fitting, key=dist_to)
            step_dist = dist_to(nearest)
            total_dist += step_dist
            declared_wt = float(
                nearest.intake.declared_weight_kg
                if nearest.intake and nearest.intake.declared_weight_kg
                else 0
            )
            rem_capacity -= declared_wt
            total_weight += declared_wt
            ordered_ids.append(nearest.id)
            candidates.remove(nearest)
            curr_lat, curr_lng = get_pickup_coords(nearest)

        reasoning = (
            f"{len(ordered_ids)} pickups, {round(total_dist, 1)}km total, "
            f"{dominant_stream}, fits in {vehicle.capacity_kg}kg vehicle"
        )

        logger.info(
            "fleet.route_suggested",
            vehicle_id=str(vehicle.id),
            ordered_count=len(ordered_ids),
            total_dist=round(total_dist, 2),
            stream_class=dominant_stream,
        )

        return RouteSuggestionResponse(
            ordered_pickup_request_ids=ordered_ids,
            total_distance_km=round(total_dist, 2),
            total_weight_kg=round(total_weight, 2),
            stream_class=dominant_stream,
            excluded_pickup_ids=excluded_ids,
            reasoning=reasoning,
        )
