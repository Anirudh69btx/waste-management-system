"""Segment 3.3c — Admin Dashboard backend integration tests (8 tests)."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from decimal import Decimal
import uuid

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.settings import get_settings
from app.models import (
    IntakeStatus,
    Supplier,
    TraceabilityEvent,
    User,
    UserRole,
    VerificationStatus,
    WasteCategory,
    WasteIntake,
    WastePurityGrade,
    WeightTicket,
)


def _run(coro):
    return asyncio.run(coro)


def test_list_users_requires_admin(client, real_user_headers):
    """1. GENERATOR hitting /api/v1/admin/users receives 403."""
    headers = real_user_headers("GENERATOR")
    res = client.get("/api/v1/admin/users", headers=headers)
    assert res.status_code == 403, res.text


def test_list_users_returns_paginated(client, real_user_headers):
    """2. Create 15 users, request limit=5 -> 5 items, total >= 15."""
    created_ids: list[uuid.UUID] = [uuid.uuid4() for _ in range(15)]

    async def _seed_users():
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                for idx, uid in enumerate(created_ids):
                    session.add(
                        User(
                            id=uid,
                            email=f"admin33c.pag.{idx}.{uid.hex[:6]}@cwm-test.io",
                            password_hash="hashed_test_pw",
                            full_name=f"Pagination User {idx}",
                            role=UserRole.GENERATOR,
                            is_active=True,
                            is_verified=True,
                        )
                    )
                await session.commit()
        finally:
            await engine.dispose()

    async def _cleanup_users():
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                await session.execute(delete(User).where(User.id.in_(created_ids)))
                await session.commit()
        finally:
            await engine.dispose()

    _run(_seed_users())
    try:
        headers = real_user_headers("ADMIN")
        res = client.get("/api/v1/admin/users?limit=5&offset=0", headers=headers)
        assert res.status_code == 200, res.text
        data = res.json()
        assert len(data["items"]) == 5
        assert data["total"] >= 15
    finally:
        _run(_cleanup_users())


def test_change_role_succeeds_and_logs(client, real_user_headers):
    """3. Changing a user's role updates DB role and sets last_role_change_by_user_id."""
    target_id = uuid.uuid4()

    async def _create_target():
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                session.add(
                    User(
                        id=target_id,
                        email=f"rolechange.{target_id.hex[:8]}@cwm-test.io",
                        password_hash="hashed_test_pw",
                        full_name="Role Target",
                        role=UserRole.GENERATOR,
                        is_active=True,
                        is_verified=True,
                    )
                )
                await session.commit()
        finally:
            await engine.dispose()

    async def _verify_and_cleanup() -> tuple[str, uuid.UUID | None, datetime | None]:
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                u = (await session.execute(select(User).where(User.id == target_id))).scalar_one()
                role_str = u.role.value if hasattr(u.role, "value") else str(u.role)
                changed_by = u.last_role_change_by_user_id
                changed_at = u.last_role_change_at
                await session.execute(delete(User).where(User.id == target_id))
                await session.commit()
                return role_str, changed_by, changed_at
        finally:
            await engine.dispose()

    _run(_create_target())
    headers = real_user_headers("ADMIN")
    res = client.patch(
        f"/api/v1/admin/users/{target_id}/role",
        json={"new_role": "RECYCLER", "reason": "Verified recycler facility credentials"},
        headers=headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["role"] == "RECYCLER"
    assert body["last_role_change_at"] is not None

    role_db, changed_by, changed_at = _run(_verify_and_cleanup())
    assert role_db == "RECYCLER"
    assert changed_by is not None
    assert changed_at is not None


def _extract_user_id(headers: dict[str, str]) -> str:
    from jose import jwt

    token = headers["Authorization"].split(" ", 1)[1]
    return str(jwt.get_unverified_claims(token)["sub"])


def test_change_own_role_forbidden(client, real_user_headers):
    """4. Admin attempting to change their own role receives 422."""
    headers = real_user_headers("ADMIN")
    admin_id = _extract_user_id(headers)

    res = client.patch(
        f"/api/v1/admin/users/{admin_id}/role",
        json={"new_role": "GENERATOR", "reason": "Trying to demote self"},
        headers=headers,
    )
    assert res.status_code == 422, res.text


def test_deactivate_last_admin_forbidden(client, real_user_headers):
    """5. Deactivating the only active ADMIN receives 422."""
    headers = real_user_headers("ADMIN")
    admin_id = uuid.UUID(_extract_user_id(headers))

    other_admin_ids: list[uuid.UUID] = []

    async def _isolate_single_admin():
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                rows = (
                    await session.execute(
                        select(User.id).where(
                            User.role == UserRole.ADMIN,
                            User.is_active.is_(True),
                            User.id != admin_id,
                        )
                    )
                ).scalars().all()
                other_admin_ids.extend(rows)
                if other_admin_ids:
                    await session.execute(
                        update(User)
                        .where(User.id.in_(other_admin_ids))
                        .values(is_active=False)
                    )
                    await session.commit()
        finally:
            await engine.dispose()

    async def _restore_admins():
        if not other_admin_ids:
            return
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                await session.execute(
                    update(User)
                    .where(User.id.in_(other_admin_ids))
                    .values(is_active=True)
                )
                await session.commit()
        finally:
            await engine.dispose()

    _run(_isolate_single_admin())
    try:
        res = client.patch(
            f"/api/v1/admin/users/{admin_id}/deactivate",
            json={"reason": "Attempting to deactivate last active admin"},
            headers=headers,
        )
        assert res.status_code == 422, res.text
    finally:
        _run(_restore_admins())


def _seed_dispute_pair():
    """Helper to seed 2 disputed weight tickets (1 pending, 1 resolved) and clean up."""
    user_id = uuid.uuid4()
    supplier_id = uuid.uuid4()
    intake1_id = uuid.uuid4()
    intake2_id = uuid.uuid4()
    ticket_pending_id = uuid.uuid4()
    ticket_resolved_id = uuid.uuid4()

    async def _setup():
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                cat = (await session.execute(select(WasteCategory).limit(1))).scalar_one()
                u = User(
                    id=user_id,
                    email=f"dispute.sup.{user_id.hex[:6]}@cwm-test.io",
                    password_hash="hashed_test_pw",
                    full_name="Dispute Supplier",
                    role=UserRole.GENERATOR,
                    is_active=True,
                    is_verified=True,
                )
                s = Supplier(
                    id=supplier_id,
                    user_id=user_id,
                    business_name=f"Dispute Corp {supplier_id.hex[:6]}",
                    registration_number=f"REG-{supplier_id.hex[:8].upper()}",
                    facility_address="123 Industrial Area",
                    latitude=19.076,
                    longitude=72.877,
                    contact_phone="+919876543210",
                    verification_status=VerificationStatus.VERIFIED,
                )
                i1 = WasteIntake(
                    id=intake1_id,
                    batch_code=f"BATCH-DISP-P-{intake1_id.hex[:6].upper()}",
                    supplier_id=supplier_id,
                    category_id=cat.id,
                    purity_grade=WastePurityGrade.GRADE_A,
                    declared_weight_kg=500.0,
                    verified_weight_kg=420.0,
                    weight_discrepancy_kg=80.0,
                    status=IntakeStatus.WEIGHED.value,
                    qr_code_hash=f"qr-{intake1_id.hex}",
                    image_paths=[],
                )
                i2 = WasteIntake(
                    id=intake2_id,
                    batch_code=f"BATCH-DISP-R-{intake2_id.hex[:6].upper()}",
                    supplier_id=supplier_id,
                    category_id=cat.id,
                    purity_grade=WastePurityGrade.GRADE_A,
                    declared_weight_kg=300.0,
                    verified_weight_kg=285.0,
                    weight_discrepancy_kg=15.0,
                    status=IntakeStatus.WEIGHED.value,
                    qr_code_hash=f"qr-{intake2_id.hex}",
                    image_paths=[],
                )
                t_pending = WeightTicket(
                    id=ticket_pending_id,
                    intake_id=intake1_id,
                    weight_method="weighbridge",
                    gross_weight_kg=Decimal("520.000"),
                    tare_weight_kg=Decimal("100.000"),
                    net_weight_kg=Decimal("420.000"),
                    recorded_by_user_id=user_id,
                    discrepancy_flag=True,
                    supplier_dispute_notes="Our factory scale recorded 500kg before dispatch.",
                )
                t_resolved = WeightTicket(
                    id=ticket_resolved_id,
                    intake_id=intake2_id,
                    weight_method="digital_scale",
                    gross_weight_kg=Decimal("305.000"),
                    tare_weight_kg=Decimal("20.000"),
                    net_weight_kg=Decimal("285.000"),
                    recorded_by_user_id=user_id,
                    discrepancy_flag=True,
                    supplier_dispute_notes="Minor moisture loss disputed.",
                    dispute_resolution="rejected",
                    dispute_resolved_by_user_id=user_id,
                    dispute_resolved_at=datetime.now(timezone.utc),
                    dispute_resolution_note="Scale calibration certificate verified.",
                )
                session.add_all([u, s, i1, i2, t_pending, t_resolved])
                await session.commit()
        finally:
            await engine.dispose()

    async def _cleanup():
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                await session.execute(
                    delete(WeightTicket).where(
                        WeightTicket.id.in_([ticket_pending_id, ticket_resolved_id])
                    )
                )
                await session.execute(
                    delete(WasteIntake).where(WasteIntake.id.in_([intake1_id, intake2_id]))
                )
                await session.execute(delete(Supplier).where(Supplier.id == supplier_id))
                await session.execute(delete(User).where(User.id == user_id))
                await session.commit()
        finally:
            await engine.dispose()

    return (
        {
            "ticket_pending_id": ticket_pending_id,
            "ticket_resolved_id": ticket_resolved_id,
        },
        _setup,
        _cleanup,
    )


def test_list_disputes_filters_pending(client, real_user_headers):
    """6. Create 2 disputes (one resolved, one pending) -> pending filter returns pending only."""
    ids, setup, cleanup = _seed_dispute_pair()
    _run(setup())
    try:
        headers = real_user_headers("ADMIN")
        res = client.get("/api/v1/admin/disputes?resolution=pending&limit=100", headers=headers)
        assert res.status_code == 200, res.text
        data = res.json()
        returned_ids = {item["id"] for item in data["items"]}
        assert str(ids["ticket_pending_id"]) in returned_ids
        assert str(ids["ticket_resolved_id"]) not in returned_ids
    finally:
        _run(cleanup())


def test_resolve_dispute_sets_fields(client, real_user_headers):
    """7. Resolving a pending dispute persists resolution, note, timestamp, and resolver ID."""
    ids, setup, cleanup = _seed_dispute_pair()
    _run(setup())
    try:
        headers = real_user_headers("ADMIN")
        ticket_id = ids["ticket_pending_id"]
        res = client.post(
            f"/api/v1/admin/disputes/{ticket_id}/resolve",
            json={
                "resolution": "upheld",
                "note": "Verified supplier weighbridge slip; upholding dispute.",
            },
            headers=headers,
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["dispute_resolution"] == "upheld"
        assert body["dispute_resolved_at"] is not None

        async def _check_db():
            engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
            try:
                async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                    t = (
                        await session.execute(
                            select(WeightTicket).where(WeightTicket.id == ticket_id)
                        )
                    ).scalar_one()
                    assert t.dispute_resolution == "upheld"
                    assert (
                        t.dispute_resolution_note
                        == "Verified supplier weighbridge slip; upholding dispute."
                    )
                    assert t.dispute_resolved_by_user_id is not None
                    assert t.dispute_resolved_at is not None
            finally:
                await engine.dispose()

        _run(_check_db())
    finally:
        _run(cleanup())


def test_activity_feed_returns_traceability_events(client, real_user_headers):
    """8. GET /api/v1/admin/activity returns traceability events sorted descending."""
    ev1_id = uuid.uuid4()
    ev2_id = uuid.uuid4()

    async def _seed_events():
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                intake = (await session.execute(select(WasteIntake).limit(1))).scalar_one()
                session.add_all(
                    [
                        TraceabilityEvent(
                            id=ev1_id,
                            batch_id=intake.id,
                            event_type="batch.submitted",
                            from_status=None,
                            to_status="submitted",
                            actor_role="GENERATOR",
                            metadata_json={"source": "test_3_3c"},
                        ),
                        TraceabilityEvent(
                            id=ev2_id,
                            batch_id=intake.id,
                            event_type="batch.weighed",
                            from_status="submitted",
                            to_status="weighed",
                            actor_role="LOGISTICS",
                            metadata_json={"source": "test_3_3c"},
                        ),
                    ]
                )
                await session.commit()
        finally:
            await engine.dispose()

    async def _cleanup_events():
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                await session.execute(
                    delete(TraceabilityEvent).where(
                        TraceabilityEvent.id.in_([ev1_id, ev2_id])
                    )
                )
                await session.commit()
        finally:
            await engine.dispose()

    _run(_seed_events())
    try:
        headers = real_user_headers("ADMIN")
        res = client.get("/api/v1/admin/activity?limit=20", headers=headers)
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["total"] >= 2
        items = data["items"]
        assert len(items) >= 2
        timestamps = [item["created_at"] for item in items]
        assert timestamps == sorted(timestamps, reverse=True)
    finally:
        _run(_cleanup_events())
