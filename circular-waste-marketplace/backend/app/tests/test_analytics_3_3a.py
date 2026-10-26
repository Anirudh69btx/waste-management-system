"""Segment 3.3a — Backend analytics integration tests (8 tests)."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.settings import get_settings
from app.models import Supplier, User, UserRole, WasteIntake
from app.tests.conftest import _fresh_token


@pytest.fixture(scope="function")
def seeded_generator_headers(override_real_db) -> dict[str, str]:
    """Return Bearer headers for an existing GENERATOR user with seeded intakes."""
    async def _fetch_user() -> tuple[str, str, str]:
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                stmt = (
                    select(User)
                    .join(Supplier, Supplier.user_id == User.id)
                    .join(WasteIntake, WasteIntake.supplier_id == Supplier.id)
                    .where(
                        User.role == UserRole.GENERATOR,
                        User.is_active.is_(True),
                        WasteIntake.verified_weight_kg.isnot(None),
                    )
                    .limit(1)
                )
                user = (await session.execute(stmt)).scalar_one()
                role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
                return str(user.id), role_val, user.email
        finally:
            await engine.dispose()

    uid, role_val, email = asyncio.run(_fetch_user())
    token = _fresh_token(uid, role_val, email)
    return {"Authorization": f"Bearer {token}"}


def test_supplier_analytics_returns_200_for_generator(client, seeded_generator_headers):
    res = client.get("/api/v1/analytics/supplier", headers=seeded_generator_headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["total_batches"] > 0
    assert data["total_verified_kg"] > 0
    assert "kg_by_day" in data
    assert "batches_by_status" in data
    assert "kg_by_category" in data


def test_supplier_analytics_403_for_recycler(client, real_user_headers):
    headers = real_user_headers("RECYCLER")
    res = client.get("/api/v1/analytics/supplier", headers=headers)
    assert res.status_code == 403


def test_seller_analytics_403_for_generator(client, real_user_headers):
    headers = real_user_headers("GENERATOR")
    res = client.get("/api/v1/analytics/seller", headers=headers)
    assert res.status_code == 403


def test_admin_analytics_403_for_supplier(client, real_user_headers):
    headers = real_user_headers("GENERATOR")
    res = client.get("/api/v1/analytics/admin", headers=headers)
    assert res.status_code == 403


def test_supplier_analytics_kg_by_day_has_entries(client, seeded_generator_headers):
    res = client.get("/api/v1/analytics/supplier", headers=seeded_generator_headers)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data["kg_by_day"], list)
    assert len(data["kg_by_day"]) > 0
    assert all("date" in pt and "value" in pt for pt in data["kg_by_day"])


def test_admin_analytics_co2e_positive(client, real_user_headers):
    headers = real_user_headers("ADMIN")
    res = client.get("/api/v1/analytics/admin", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["total_co2e_saved_kg"] > 0
    assert data["total_kg_diverted"] > 0


def test_admin_analytics_gmv_non_negative(client, real_user_headers):
    headers = real_user_headers("ADMIN")
    res = client.get("/api/v1/analytics/admin", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["total_gmv"] >= 0
    assert isinstance(data["gmv_by_day"], list)


def test_analytics_default_period_is_last_30_days(client, seeded_generator_headers):
    res = client.get("/api/v1/analytics/supplier", headers=seeded_generator_headers)
    assert res.status_code == 200
    data = res.json()
    today = datetime.now(timezone.utc).date()
    expected_start = today - timedelta(days=30)
    assert data["period_end"] == today.isoformat()
    assert data["period_start"] == expected_start.isoformat()
