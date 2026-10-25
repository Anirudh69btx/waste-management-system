"""
Pytest configuration and shared test fixtures for Circular Waste Marketplace.
"""
from __future__ import annotations

import os
import uuid
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from unittest.mock import MagicMock

import httpx
from httpx import ASGITransport
import pytest
from starlette.testclient import TestClient

from app.core.limiter import limiter
from app.core.security import create_access_token
from app.db.session import AsyncSessionLocal, get_async_session, get_db
from app.main import app
from app.models import UserRole


class MockAsyncSession:
    """Mock async database session for unit tests without live postgres."""
    async def execute(self, stmt):
        class MockResult:
            def scalar_one_or_none(self):
                m = MagicMock()
                m.code = "ORGANIC_BIOMASS"
                m.base_benchmark_price_per_kg = 3.50
                m.floor_price_per_kg = 1.50
                m.ceiling_price_per_kg = 6.00
                m.moisture_penalty_multiplier = 0.015
                m.contamination_penalty_multiplier = 0.03
                m.effective_from = datetime.now(timezone.utc)
                m.version_num = "0002_auth_refresh_tokens"
                return m
            def scalars(self):
                class MockScalars:
                    def all(self):
                        return []
                return MockScalars()
        return MockResult()

    def add(self, instance):
        pass

    def add_all(self, instances):
        pass

    async def flush(self):
        pass

    async def refresh(self, instance):
        pass

    async def commit(self):
        pass

    async def rollback(self):
        pass

    async def close(self):
        pass


async def override_get_async_session():
    yield MockAsyncSession()


# Default to mock sessions for quick unit testing
app.dependency_overrides[get_async_session] = override_get_async_session
app.dependency_overrides[get_db] = override_get_async_session


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset slowapi rate limiter before and after each test to prevent 429 cross-test flakiness."""
    try:
        limiter.reset()
    except Exception:
        pass
    yield
    try:
        limiter.reset()
    except Exception:
        pass


@pytest.fixture
def override_real_db():
    """Fixture that switches app to real PostgreSQL session during integration tests."""
    async def _real_session():
        async with AsyncSessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_async_session] = _real_session
    app.dependency_overrides[get_db] = _real_session
    yield
    app.dependency_overrides[get_async_session] = override_get_async_session
    app.dependency_overrides[get_db] = override_get_async_session


@pytest.fixture
def client() -> TestClient:
    """Synchronous test client wrapping the FastAPI application with per-test rate limiter reset."""
    try:
        limiter.reset()
    except Exception:
        pass
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture
async def async_client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """Asynchronous test client using httpx with ASGITransport."""
    try:
        limiter.reset()
    except Exception:
        pass
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest.fixture
async def db_session() -> AsyncGenerator:
    """Yield an async database session for transactional testing with rollback."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.rollback()
            await session.close()


TEST_TOKEN_EXPIRE_MINUTES = 60


def _fresh_token(subject: str, role: str, email: str) -> str:
    """Mint a fresh access token per call using a LOCAL settings copy (no global mutation)."""
    from app.core.settings import get_settings
    local_settings = get_settings().model_copy(
        update={"access_token_expire_minutes": TEST_TOKEN_EXPIRE_MINUTES}
    )
    return create_access_token(
        subject=subject,
        role=role,
        email=email,
        is_verified=True,
        settings=local_settings,
    )


@pytest.fixture(scope="function")
def auth_headers() -> dict[str, str]:
    """Default stub auth headers for generic authenticated requests."""
    token = _fresh_token(str(uuid.uuid4()), UserRole.ADMIN.value, "test@test.io")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def admin_headers() -> dict[str, str]:
    token = _fresh_token(str(uuid.uuid4()), UserRole.ADMIN.value, "admin@test.io")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def supplier_headers() -> dict[str, str]:
    token = _fresh_token(str(uuid.uuid4()), UserRole.GENERATOR.value, "supplier@test.io")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def recycler_headers() -> dict[str, str]:
    token = _fresh_token(str(uuid.uuid4()), UserRole.RECYCLER.value, "recycler@test.io")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def driver_headers() -> dict[str, str]:
    token = _fresh_token(str(uuid.uuid4()), UserRole.LOGISTICS.value, "driver@test.io")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def real_user_headers(override_real_db):
    """
    Factory: real DB-backed user for RBAC integration tests.

    Usage: headers = real_user_headers("GENERATOR")  ->  {"Authorization": "Bearer ..."}

    Each call inserts a real row into `users`, mints a token for that row's id,
    and the app is routed to real Postgres (override_real_db), so
    get_current_user loads the genuine record. All created rows are deleted on
    teardown.

    Sync + asyncio.run on a NullPool engine: pytest-asyncio runs in strict mode
    (a plain async fixture would not be awaited), and NullPool avoids sharing a
    pooled asyncpg connection across event loops with TestClient.
    """
    import asyncio

    from sqlalchemy import delete
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.core.security import hash_password
    from app.core.settings import get_settings
    from app.models import User

    created_ids: list[uuid.UUID] = []

    async def _run(op) -> None:
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                await op(session)
                await session.commit()
        finally:
            await engine.dispose()

    def _make(role: str) -> dict[str, str]:
        role_enum = UserRole(role.strip().upper())  # raises ValueError on unknown role
        user_id = uuid.uuid4()
        email = f"real.{role_enum.value.lower()}.{user_id.hex[:8]}@test.local"

        async def _insert(session) -> None:
            session.add(
                User(
                    id=user_id,
                    email=email,
                    hashed_password=hash_password("Test123!@#"),
                    full_name=f"Real {role_enum.value.title()} RBAC",
                    role=role_enum,
                    is_active=True,
                    is_verified=True,
                )
            )

        asyncio.run(_run(_insert))
        created_ids.append(user_id)
        token = _fresh_token(str(user_id), role_enum.value, email)
        return {"Authorization": f"Bearer {token}"}

    yield _make

    if created_ids:
        async def _delete(session) -> None:
            await session.execute(delete(User).where(User.id.in_(created_ids)))

        asyncio.run(_run(_delete))


@pytest.fixture
async def sample_driver_user(db_session):
    from app.models import User, UserRole
    from app.core.security import hash_password
    uid = uuid.uuid4()
    driver = User(
        id=uid,
        email=f"driver_{uid.hex[:8]}@cwm.io",
        hashed_password=hash_password("Password123!"),
        full_name="Fleet Driver",
        role=UserRole.LOGISTICS,
        is_active=True,
        is_verified=True,
    )
    db_session.add(driver)
    await db_session.flush()
    return driver


@pytest.fixture
async def sample_vehicle(db_session, sample_driver_user):
    from decimal import Decimal
    from app.models.vehicle import Vehicle
    plate = f"KA{uuid.uuid4().hex[:6].upper()}"
    vehicle = Vehicle(
        plate_number=plate,
        capacity_kg=Decimal("1500.00"),
        fuel_type="diesel",
        status="available",
        assigned_driver_user_id=sample_driver_user.id,
        current_lat=Decimal("12.9716000"),
        current_lng=Decimal("77.5946000"),
        last_ping_source="device",
    )
    db_session.add(vehicle)
    await db_session.flush()
    return vehicle


@pytest.fixture
async def active_trip(db_session, sample_vehicle, sample_driver_user):
    from decimal import Decimal
    from app.models.trip import Trip, TripStop
    from app.models import PickupRequest, WasteIntake, Supplier
    # Create supplier and intake and pickup
    supp = Supplier(
        user_id=sample_driver_user.id,
        business_name="Test Supplier",
        business_type="individual",
        phone_number="+919876543210",
        address="123 Green Way",
        latitude=Decimal("12.9720000"),
        longitude=Decimal("77.5950000"),
    )
    db_session.add(supp)
    await db_session.flush()

    intake = WasteIntake(
        supplier_id=supp.id,
        category_id=34,
        batch_code=f"INT-{uuid.uuid4().hex[:6].upper()}",
        declared_weight_kg=Decimal("200.000"),
        purity_grade="GRADE_A",
        status="pickup_requested",
    )
    db_session.add(intake)
    await db_session.flush()

    pickup = PickupRequest(
        intake_id=intake.id,
        requested_by_user_id=sample_driver_user.id,
        status="accepted",
        assigned_driver_user_id=sample_driver_user.id,
    )
    db_session.add(pickup)
    await db_session.flush()

    trip = Trip(
        vehicle_id=sample_vehicle.id,
        driver_user_id=sample_driver_user.id,
        status="in_progress",
        planned_distance_km=Decimal("15.50"),
    )
    db_session.add(trip)
    await db_session.flush()

    stop = TripStop(
        trip_id=trip.id,
        pickup_request_id=pickup.id,
        sequence=1,
        status="en_route",
    )
    db_session.add(stop)
    await db_session.flush()
    return trip


@pytest.fixture
async def sample_gps_pings(db_session, sample_vehicle):
    from decimal import Decimal
    from app.models.gps_ping import GpsPing
    p1 = GpsPing(
        vehicle_id=sample_vehicle.id,
        lat=Decimal("12.9716000"),
        lng=Decimal("77.5946000"),
        speed_kmh=Decimal("25.0"),
        heading=Decimal("90.0"),
        source="device",
    )
    p2 = GpsPing(
        vehicle_id=sample_vehicle.id,
        lat=Decimal("12.9730000"),
        lng=Decimal("77.5960000"),
        speed_kmh=Decimal("30.0"),
        heading=Decimal("85.0"),
        source="device",
    )
    db_session.add_all([p1, p2])
    await db_session.flush()
    return [p1, p2]

