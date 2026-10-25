"""Fleet router — /api/v1/fleet/...

Thin HTTP layer delegating fleet, trip, and GPS tracking operations to services.
Zero business logic — DI wiring + schema validation + rate limiting.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.limiter import limiter
from app.dependencies.auth import get_current_active_user
from app.db.session import get_async_session
from app.models import User
from app.repositories.trip_repository import TripRepository
from app.schemas.vehicle_schemas import (
    VehicleAssignDriver,
    VehicleCreate,
    VehicleListResponse,
    VehicleRead,
    VehicleUpdate,
)
from app.schemas.trip_schemas import (
    TripCreate,
    TripEndRequest,
    TripListResponse,
    TripRead,
    TripStopArriveResponse,
    TripStopCompleteRequest,
    TripStopFailRequest,
    TripStopRead,
)
from app.schemas.gps_schemas import (
    GpsPingCreate,
    GpsPingRead,
    VehicleLocationRead,
    VehicleRouteResponse,
)
from app.schemas.route_schemas import (
    RouteSuggestionRequest,
    RouteSuggestionResponse,
)
from app.services.fleet_service import FleetService
from app.services.gps_service import GpsService
from app.services.route_service import RouteService

router = APIRouter(prefix="/fleet", tags=["Fleet & Dispatch"])


# ── Vehicle Endpoints ────────────────────────────────────────────────────────

@router.get(
    "/vehicles",
    response_model=VehicleListResponse,
    summary="List vehicles (role-filtered, paginated)",
)
async def list_vehicles(
    status_filter: Optional[str] = Query(None, alias="status"),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> VehicleListResponse:
    vehicles, total = await FleetService.list_vehicles(
        user, {"status": status_filter}, (limit, offset), db
    )
    return VehicleListResponse(
        items=[VehicleRead.model_validate(v) for v in vehicles],
        total=total,
    )


@router.post(
    "/vehicles",
    response_model=VehicleRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new fleet vehicle",
)
@limiter.limit("20/hour")
async def create_vehicle(
    payload: VehicleCreate,
    request: Request,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> VehicleRead:
    rid = request.headers.get("X-Request-ID")
    vehicle = await FleetService.create_vehicle(user, payload, db, request_id=rid)
    return VehicleRead.model_validate(vehicle)


@router.patch(
    "/vehicles/{id}",
    response_model=VehicleRead,
    summary="Update vehicle details",
)
async def update_vehicle(
    id: uuid.UUID,
    payload: VehicleUpdate,
    request: Request,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> VehicleRead:
    rid = request.headers.get("X-Request-ID")
    vehicle = await FleetService.update_vehicle(user, id, payload, db, request_id=rid)
    return VehicleRead.model_validate(vehicle)


@router.patch(
    "/vehicles/{id}/assign-driver",
    response_model=VehicleRead,
    summary="Assign a driver to a vehicle",
)
async def assign_driver(
    id: uuid.UUID,
    payload: VehicleAssignDriver,
    request: Request,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> VehicleRead:
    rid = request.headers.get("X-Request-ID")
    vehicle = await FleetService.assign_driver(
        user, id, payload.driver_user_id, db, request_id=rid
    )
    return VehicleRead.model_validate(vehicle)


@router.get(
    "/vehicles/{id}/location",
    response_model=VehicleLocationRead,
    summary="Get current location and telemetry for a vehicle",
)
async def get_vehicle_location(
    id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> VehicleLocationRead:
    return await GpsService.get_current_location(user, id, db)


@router.get(
    "/vehicles/{id}/route",
    response_model=VehicleRouteResponse,
    summary="Get recent route history pings for a vehicle",
)
async def get_vehicle_route(
    id: uuid.UUID,
    limit: int = Query(50, ge=1, le=500),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> VehicleRouteResponse:
    return await GpsService.get_route_history(user, id, limit, db)


@router.post(
    "/vehicles/{id}/ping",
    response_model=GpsPingRead,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest a GPS location ping for a vehicle",
)
@limiter.limit("300/hour")
async def record_vehicle_ping(
    id: uuid.UUID,
    payload: GpsPingCreate,
    request: Request,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> GpsPingRead:
    if payload.vehicle_id != id:
        payload = payload.model_copy(update={"vehicle_id": id})
    rid = request.headers.get("X-Request-ID")
    ping = await GpsService.record_ping(user, payload, db, request_id=rid)
    return GpsPingRead.model_validate(ping)


# ── Trip Endpoints ───────────────────────────────────────────────────────────

@router.get(
    "/trips",
    response_model=TripListResponse,
    summary="List collection trips (role-filtered, paginated)",
)
async def list_trips(
    status_filter: Optional[str] = Query(None, alias="status"),
    driver_user_id: Optional[uuid.UUID] = Query(None),
    vehicle_id: Optional[uuid.UUID] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> TripListResponse:
    trips, total = await FleetService.list_trips(
        user,
        {
            "status": status_filter,
            "driver_user_id": driver_user_id,
            "vehicle_id": vehicle_id,
        },
        (limit, offset),
        db,
    )
    return TripListResponse(
        items=[TripRead.model_validate(t) for t in trips],
        total=total,
    )


@router.post(
    "/trips",
    response_model=TripRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new collection trip and stops",
)
@limiter.limit("30/hour")
async def create_trip(
    payload: TripCreate,
    request: Request,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> TripRead:
    rid = request.headers.get("X-Request-ID")
    trip = await FleetService.create_trip(user, payload, db, request_id=rid)
    return TripRead.model_validate(trip)


@router.get(
    "/trips/{id}",
    response_model=TripRead,
    summary="Get details of a single collection trip",
)
async def get_trip(
    id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> TripRead:
    trip = await TripRepository.get_by_id(db, id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found.",
        )
    role = (user.role.value if hasattr(user.role, "value") else str(user.role)).upper()
    if role != "ADMIN" and trip.driver_user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trip not found.",
        )
    return TripRead.model_validate(trip)


@router.patch(
    "/trips/{id}/start",
    response_model=TripRead,
    summary="Start a planned trip",
)
async def start_trip(
    id: uuid.UUID,
    request: Request,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> TripRead:
    rid = request.headers.get("X-Request-ID")
    trip = await FleetService.start_trip(user, id, db, request_id=rid)
    return TripRead.model_validate(trip)


@router.patch(
    "/trips/{id}/end",
    response_model=TripRead,
    summary="End an in-progress trip",
)
async def end_trip(
    id: uuid.UUID,
    request: Request,
    payload: Optional[TripEndRequest] = None,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> TripRead:
    rid = request.headers.get("X-Request-ID")
    trip = await FleetService.end_trip(user, id, payload, db, request_id=rid)
    return TripRead.model_validate(trip)


@router.patch(
    "/trips/{id}/cancel",
    response_model=TripRead,
    summary="Cancel a trip (Admin only)",
)
async def cancel_trip(
    id: uuid.UUID,
    request: Request,
    reason: str = Query("Admin cancellation", max_length=500),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> TripRead:
    rid = request.headers.get("X-Request-ID")
    trip = await FleetService.cancel_trip(user, id, reason, db, request_id=rid)
    return TripRead.model_validate(trip)


@router.patch(
    "/trips/{id}/stops/{stop_id}/arrive",
    response_model=TripStopArriveResponse,
    summary="Mark arrival at a trip stop",
)
async def arrive_stop(
    id: uuid.UUID,
    stop_id: uuid.UUID,
    request: Request,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> TripStopArriveResponse:
    rid = request.headers.get("X-Request-ID")
    stop = await FleetService.arrive_at_stop(user, id, stop_id, db, request_id=rid)
    return TripStopArriveResponse(
        stop_id=stop.id,
        status=stop.status,
        arrived_at=stop.arrived_at,
    )


@router.patch(
    "/trips/{id}/stops/{stop_id}/complete",
    response_model=TripStopRead,
    summary="Complete a trip stop (requires recorded weight ticket)",
)
async def complete_stop(
    id: uuid.UUID,
    stop_id: uuid.UUID,
    request: Request,
    payload: Optional[TripStopCompleteRequest] = None,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> TripStopRead:
    rid = request.headers.get("X-Request-ID")
    stop = await FleetService.complete_stop(
        user, id, stop_id, payload or TripStopCompleteRequest(), db, request_id=rid
    )
    return TripStopRead.model_validate(stop)


@router.patch(
    "/trips/{id}/stops/{stop_id}/fail",
    response_model=TripStopRead,
    summary="Mark a trip stop as failed",
)
async def fail_stop(
    id: uuid.UUID,
    stop_id: uuid.UUID,
    payload: TripStopFailRequest,
    request: Request,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> TripStopRead:
    rid = request.headers.get("X-Request-ID")
    stop = await FleetService.fail_stop(user, id, stop_id, payload, db, request_id=rid)
    return TripStopRead.model_validate(stop)


@router.post(
    "/trips/suggest",
    response_model=RouteSuggestionResponse,
    summary="Suggest an optimized route for pickups (Admin only)",
)
@limiter.limit("20/hour")
async def suggest_route(
    payload: RouteSuggestionRequest,
    request: Request,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_session),
) -> RouteSuggestionResponse:
    return await RouteService.suggest_route(user, payload, db)
