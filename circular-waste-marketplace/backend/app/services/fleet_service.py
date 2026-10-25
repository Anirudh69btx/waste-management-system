"""Fleet service — Vehicle & Trip lifecycle management."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.waste_streams import streams_compatible
from app.models import User, PickupRequest, WeightTicket, WasteIntake
from app.models.vehicle import Vehicle
from app.models.trip import Trip, TripStop
from app.repositories.vehicle_repository import VehicleRepository
from app.repositories.trip_repository import TripRepository
from app.repositories.trip_stop_repository import TripStopRepository
from app.repositories.gps_repository import GpsRepository
from app.schemas.vehicle_schemas import VehicleCreate, VehicleUpdate
from app.schemas.trip_schemas import (
    TripCreate,
    TripEndRequest,
    TripStopCompleteRequest,
    TripStopFailRequest,
)

logger = get_logger(__name__)


class FleetService:
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
    async def create_vehicle(
        cls,
        user: Any,
        payload: VehicleCreate,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> Vehicle:
        if cls._get_role(user) != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can register vehicles.",
            )
        existing = await VehicleRepository.get_by_plate(session, payload.plate_number)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Vehicle with plate '{payload.plate_number}' is already registered.",
            )
        vehicle = await VehicleRepository.create(session, **payload.model_dump())
        await session.commit()
        logger.info(
            "fleet.vehicle_created",
            vehicle_id=str(vehicle.id),
            plate_number=vehicle.plate_number,
            request_id=request_id,
        )
        return vehicle

    @classmethod
    async def update_vehicle(
        cls,
        user: Any,
        vehicle_id: uuid.UUID,
        payload: VehicleUpdate,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> Vehicle:
        if cls._get_role(user) != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can update vehicle details.",
            )
        vehicle = await VehicleRepository.get_by_id(session, vehicle_id)
        if not vehicle:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle not found.",
            )
        update_data = payload.model_dump(exclude_unset=True)
        vehicle = await VehicleRepository.update(session, vehicle, **update_data)
        await session.commit()
        logger.info(
            "fleet.vehicle_updated",
            vehicle_id=str(vehicle.id),
            request_id=request_id,
        )
        return vehicle

    @classmethod
    async def assign_driver(
        cls,
        user: Any,
        vehicle_id: uuid.UUID,
        driver_user_id: uuid.UUID,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> Vehicle:
        if cls._get_role(user) != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can assign drivers to vehicles.",
            )
        vehicle = await VehicleRepository.get_by_id(session, vehicle_id)
        if not vehicle:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle not found.",
            )
        driver = await session.get(User, driver_user_id)
        if not driver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Driver user not found.",
            )
        d_role = cls._get_role(driver)
        if d_role != "LOGISTICS":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Assigned user must have LOGISTICS role.",
            )
        vehicle = await VehicleRepository.assign_driver(session, vehicle, driver_user_id)
        await session.commit()
        logger.info(
            "fleet.vehicle_driver_assigned",
            vehicle_id=str(vehicle.id),
            driver_user_id=str(driver_user_id),
            request_id=request_id,
        )
        return vehicle

    @classmethod
    async def list_vehicles(
        cls,
        user: Any,
        filters: dict[str, Any],
        pagination: tuple[int, int],
        session: AsyncSession,
    ) -> tuple[list[Vehicle], int]:
        role = cls._get_role(user)
        limit, offset = pagination
        if role == "ADMIN":
            return await VehicleRepository.list_all(
                session, status=filters.get("status"), limit=limit, offset=offset
            )
        elif role == "LOGISTICS":
            uid = cls._get_user_id(user)
            q = select(Vehicle).where(Vehicle.assigned_driver_user_id == uid)
            count_q = select(Vehicle.id).where(Vehicle.assigned_driver_user_id == uid)
            if filters.get("status"):
                q = q.where(Vehicle.status == filters["status"])
                count_q = count_q.where(Vehicle.status == filters["status"])
            total_res = await session.execute(count_q)
            total = len(total_res.scalars().all())
            vehicles_res = await session.execute(q.limit(limit).offset(offset))
            return list(vehicles_res.scalars().all()), total
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden for this role.",
            )

    @classmethod
    async def create_trip(
        cls,
        user: Any,
        payload: TripCreate,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> Trip:
        if cls._get_role(user) != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can create trips.",
            )

        vehicle = await VehicleRepository.get_by_id(session, payload.vehicle_id)
        if not vehicle:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle not found.",
            )
        if vehicle.status != "available":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Vehicle is {vehicle.status}, must be available.",
            )

        driver = await session.get(User, payload.driver_user_id)
        if not driver:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Driver not found.",
            )
        if cls._get_role(driver) != "LOGISTICS":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Assigned driver must have LOGISTICS role.",
            )

        active_driver_trip = await TripRepository.get_active_for_driver(
            session, payload.driver_user_id
        )
        if active_driver_trip:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Driver already has an active or planned trip.",
            )

        active_veh_trip = await TripRepository.get_active_for_vehicle(
            session, payload.vehicle_id
        )
        if active_veh_trip:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Vehicle already has an active or planned trip.",
            )

        # Load pickups
        pickups: list[PickupRequest] = []
        for pid in payload.pickup_request_ids:
            p = (
                await session.execute(
                    select(PickupRequest)
                    .options(
                        selectinload(PickupRequest.intake).selectinload(
                            WasteIntake.category
                        )
                    )
                    .where(PickupRequest.id == pid)
                )
            ).scalar_one_or_none()
            pickup = p
            if not pickup:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Pickup request {pid} not found.",
                )
            pickups.append(pickup)

        # Check pickup not already in active stop
        active_stops = (
            await session.execute(
                select(TripStop).where(
                    TripStop.pickup_request_id.in_(payload.pickup_request_ids),
                    TripStop.status.in_(["pending", "en_route", "arrived"]),
                )
            )
        ).scalars().all()
        if active_stops:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="One or more pickup requests are already assigned to an active trip.",
            )

        # Stream compatibility check
        category_ids = [
            p.intake.category_id for p in pickups if p.intake and p.intake.category_id
        ]
        compatible, stream_class = streams_compatible(category_ids)
        if not compatible:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Incompatible waste streams cannot be combined in the same trip.",
            )

        # Capacity check
        total_declared_wt = Decimal("0")
        for p in pickups:
            if p.intake and p.intake.declared_weight_kg:
                total_declared_wt += Decimal(str(p.intake.declared_weight_kg))
        if total_declared_wt > vehicle.capacity_kg:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Total declared weight ({total_declared_wt} kg) exceeds "
                    f"vehicle capacity ({vehicle.capacity_kg} kg)."
                ),
            )

        trip_data = {
            "vehicle_id": payload.vehicle_id,
            "driver_user_id": payload.driver_user_id,
            "status": "planned",
            "notes": payload.notes,
            "request_id_correlation": request_id,
        }
        stops_data = [
            {
                "pickup_request_id": pid,
                "sequence": idx + 1,
                "status": "pending",
            }
            for idx, pid in enumerate(payload.pickup_request_ids)
        ]
        trip = await TripRepository.create(session, trip_data, stops_data)

        # Update vehicle status
        vehicle.status = "in_use"
        session.add(vehicle)

        # Update pickup requests
        for p in pickups:
            if p.status == "requested":
                p.status = "accepted"
            p.assigned_driver_user_id = payload.driver_user_id
            session.add(p)

        await session.commit()
        logger.info(
            "fleet.trip_created",
            trip_id=str(trip.id),
            driver_user_id=str(trip.driver_user_id),
            stop_count=len(trip.stops),
            request_id=request_id,
        )
        return await TripRepository.get_by_id(session, trip.id)

    @classmethod
    async def start_trip(
        cls,
        user: Any,
        trip_id: uuid.UUID,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> Trip:
        trip = await TripRepository.get_by_id(session, trip_id)
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found."
            )
        role = cls._get_role(user)
        uid = cls._get_user_id(user)
        if role != "ADMIN" and trip.driver_user_id != uid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to start this trip.",
            )
        if trip.status != "planned":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot start trip with status '{trip.status}'. Must be 'planned'.",
            )
        if not trip.stops:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Cannot start trip with no stops.",
            )

        trip = await TripRepository.start_trip(session, trip)
        stops = sorted(trip.stops, key=lambda s: s.sequence)
        first_stop = stops[0]
        first_stop.status = "en_route"
        session.add(first_stop)

        p = await session.get(PickupRequest, first_stop.pickup_request_id)
        if p:
            p.status = "en_route"
            session.add(p)

        await session.commit()
        logger.info(
            "fleet.trip_started",
            trip_id=str(trip.id),
            driver_user_id=str(trip.driver_user_id),
            stop_count=len(trip.stops),
            request_id=request_id,
        )
        return await TripRepository.get_by_id(session, trip.id)

    @classmethod
    async def arrive_at_stop(
        cls,
        user: Any,
        trip_id: uuid.UUID,
        stop_id: uuid.UUID,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> TripStop:
        trip = await TripRepository.get_by_id(session, trip_id)
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found."
            )
        role = cls._get_role(user)
        uid = cls._get_user_id(user)
        if role != "ADMIN" and trip.driver_user_id != uid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized for this trip.",
            )
        if trip.status != "in_progress":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Trip is not in progress.",
            )
        stop = await TripStopRepository.get_by_id(session, stop_id)
        if not stop or stop.trip_id != trip.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trip stop not found.",
            )
        if stop.status != "en_route":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Stop status is '{stop.status}', must be 'en_route' to arrive.",
            )

        stop = await TripStopRepository.set_arrived(session, stop)
        p = await session.get(PickupRequest, stop.pickup_request_id)
        if p:
            p.status = "arrived"
            session.add(p)

        await session.commit()
        logger.info(
            "fleet.stop_arrived",
            trip_id=str(trip.id),
            stop_id=str(stop.id),
            request_id=request_id,
        )
        return await TripStopRepository.get_by_id(session, stop.id)

    @classmethod
    async def complete_stop(
        cls,
        user: Any,
        trip_id: uuid.UUID,
        stop_id: uuid.UUID,
        payload: TripStopCompleteRequest,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> TripStop:
        trip = await TripRepository.get_by_id(session, trip_id)
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found."
            )
        role = cls._get_role(user)
        uid = cls._get_user_id(user)
        if role != "ADMIN" and trip.driver_user_id != uid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized for this trip.",
            )
        stop = await TripStopRepository.get_by_id(session, stop_id)
        if not stop or stop.trip_id != trip.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Trip stop not found."
            )
        if stop.status != "arrived":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Stop status is '{stop.status}', must be 'arrived' to complete.",
            )

        p = await session.get(PickupRequest, stop.pickup_request_id)
        if not p:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Pickup request not found."
            )

        # Pre-condition: WeightTicket must exist for this pickup's intake
        wt_result = await session.execute(
            select(WeightTicket)
            .where(WeightTicket.intake_id == p.intake_id)
            .order_by(WeightTicket.created_at.desc())
            .limit(1)
        )
        ticket = wt_result.scalar_one_or_none()
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Record weight before completing stop.",
            )

        stop = await TripStopRepository.set_completed(session, stop)
        if payload and payload.notes:
            stop.notes = payload.notes
            session.add(stop)

        p.status = "picked_up"
        p.actual_pickup_at = datetime.now(timezone.utc)
        session.add(p)

        net_wt = ticket.net_weight_kg or Decimal("0")
        current_wt = trip.total_weight_kg or Decimal("0")
        trip.total_weight_kg = current_wt + net_wt
        session.add(trip)

        # Advance next stop to en_route
        next_stops = (
            await session.execute(
                select(TripStop)
                .where(
                    TripStop.trip_id == trip.id,
                    TripStop.sequence > stop.sequence,
                    TripStop.status == "pending",
                )
                .order_by(TripStop.sequence.asc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if next_stops:
            next_stops.status = "en_route"
            session.add(next_stops)
            next_p = await session.get(PickupRequest, next_stops.pickup_request_id)
            if next_p:
                next_p.status = "en_route"
                session.add(next_p)

        await session.commit()
        logger.info(
            "fleet.stop_completed",
            trip_id=str(trip.id),
            stop_id=str(stop.id),
            request_id=request_id,
        )
        return await TripStopRepository.get_by_id(session, stop.id)

    @classmethod
    async def fail_stop(
        cls,
        user: Any,
        trip_id: uuid.UUID,
        stop_id: uuid.UUID,
        payload: TripStopFailRequest,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> TripStop:
        trip = await TripRepository.get_by_id(session, trip_id)
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found."
            )
        role = cls._get_role(user)
        uid = cls._get_user_id(user)
        if role != "ADMIN" and trip.driver_user_id != uid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized for this trip.",
            )
        stop = await TripStopRepository.get_by_id(session, stop_id)
        if not stop or stop.trip_id != trip.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Trip stop not found."
            )
        if stop.status not in ("en_route", "arrived"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Stop is '{stop.status}', cannot fail unless 'en_route' or 'arrived'.",
            )

        stop = await TripStopRepository.set_failure(session, stop, payload.failure_reason)
        p = await session.get(PickupRequest, stop.pickup_request_id)
        if p:
            p.status = "failed"
            p.failure_reason = payload.failure_reason
            session.add(p)

        # Advance next stop to en_route
        next_stops = (
            await session.execute(
                select(TripStop)
                .where(
                    TripStop.trip_id == trip.id,
                    TripStop.sequence > stop.sequence,
                    TripStop.status == "pending",
                )
                .order_by(TripStop.sequence.asc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if next_stops:
            next_stops.status = "en_route"
            session.add(next_stops)
            next_p = await session.get(PickupRequest, next_stops.pickup_request_id)
            if next_p:
                next_p.status = "en_route"
                session.add(next_p)

        await session.commit()
        logger.info(
            "fleet.stop_failed",
            trip_id=str(trip.id),
            stop_id=str(stop.id),
            reason=payload.failure_reason,
            request_id=request_id,
        )
        return await TripStopRepository.get_by_id(session, stop.id)

    @classmethod
    async def end_trip(
        cls,
        user: Any,
        trip_id: uuid.UUID,
        payload: TripEndRequest | None,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> Trip:
        trip = await TripRepository.get_by_id(session, trip_id)
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found."
            )
        role = cls._get_role(user)
        uid = cls._get_user_id(user)
        if role != "ADMIN" and trip.driver_user_id != uid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized for this trip.",
            )

        incomplete = [s for s in trip.stops if s.status not in ("completed", "failed")]
        if incomplete:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot end trip: {len(incomplete)} stop(s) are not completed or failed.",
            )

        dist = await GpsRepository.compute_distance_km_for_trip(session, trip.id)
        trip = await TripRepository.end_trip(session, trip, Decimal(str(dist)))
        if payload and payload.notes:
            trip.notes = payload.notes
            session.add(trip)

        # Vehicle returns to available
        vehicle = await VehicleRepository.get_by_id(session, trip.vehicle_id)
        if vehicle:
            vehicle.status = "available"
            session.add(vehicle)

        await session.commit()
        logger.info(
            "fleet.trip_ended",
            trip_id=str(trip.id),
            actual_distance_km=float(dist),
            request_id=request_id,
        )
        return await TripRepository.get_by_id(session, trip.id)

    @classmethod
    async def cancel_trip(
        cls,
        user: Any,
        trip_id: uuid.UUID,
        reason: str,
        session: AsyncSession,
        request_id: str | None = None,
    ) -> Trip:
        if cls._get_role(user) != "ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators can cancel trips.",
            )
        trip = await TripRepository.get_by_id(session, trip_id)
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Trip not found."
            )
        if trip.status in ("completed", "cancelled"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot cancel trip with status '{trip.status}'.",
            )

        trip.status = "cancelled"
        trip.notes = f"{trip.notes or ''} [Cancelled: {reason}]".strip()
        session.add(trip)

        for stop in trip.stops:
            if stop.status in ("pending", "en_route", "arrived"):
                stop.status = "failed"
                stop.failure_reason = f"Trip cancelled: {reason}"
                session.add(stop)
                p = await session.get(PickupRequest, stop.pickup_request_id)
                if p and p.status in ("accepted", "en_route", "arrived"):
                    p.status = "requested"
                    p.assigned_driver_user_id = None
                    session.add(p)

        vehicle = await VehicleRepository.get_by_id(session, trip.vehicle_id)
        if vehicle:
            vehicle.status = "available"
            session.add(vehicle)

        await session.commit()
        logger.info(
            "fleet.trip_cancelled",
            trip_id=str(trip.id),
            reason=reason,
            request_id=request_id,
        )
        return await TripRepository.get_by_id(session, trip.id)

    @classmethod
    async def list_trips(
        cls,
        user: Any,
        filters: dict[str, Any],
        pagination: tuple[int, int],
        session: AsyncSession,
    ) -> tuple[list[Trip], int]:
        role = cls._get_role(user)
        limit, offset = pagination
        if role == "ADMIN":
            return await TripRepository.list_all(
                session,
                status=filters.get("status"),
                driver_user_id=filters.get("driver_user_id"),
                vehicle_id=filters.get("vehicle_id"),
                limit=limit,
                offset=offset,
            )
        elif role == "LOGISTICS":
            uid = cls._get_user_id(user)
            return await TripRepository.list_all(
                session,
                status=filters.get("status"),
                driver_user_id=uid,
                vehicle_id=filters.get("vehicle_id"),
                limit=limit,
                offset=offset,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden for this role.",
            )
