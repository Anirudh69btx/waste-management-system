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


@pytest.fixture
def auth_headers() -> dict[str, str]:
    """Default stub auth headers for generic authenticated requests."""
    token = create_access_token(
        subject=str(uuid.uuid4()),
        role=UserRole.ADMIN.value,
        email="test@test.io",
        is_verified=True,
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers() -> dict[str, str]:
    token = create_access_token(
        subject=str(uuid.uuid4()),
        role=UserRole.ADMIN.value,
        email="admin@test.io",
        is_verified=True,
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def supplier_headers() -> dict[str, str]:
    token = create_access_token(
        subject=str(uuid.uuid4()),
        role=UserRole.GENERATOR.value,
        email="supplier@test.io",
        is_verified=True,
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def recycler_headers() -> dict[str, str]:
    token = create_access_token(
        subject=str(uuid.uuid4()),
        role=UserRole.RECYCLER.value,
        email="recycler@test.io",
        is_verified=True,
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def driver_headers() -> dict[str, str]:
    token = create_access_token(
        subject=str(uuid.uuid4()),
        role=UserRole.LOGISTICS.value,
        email="driver@test.io",
        is_verified=True,
    )
    return {"Authorization": f"Bearer {token}"}
