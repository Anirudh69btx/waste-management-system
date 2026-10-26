"""Segment 3.3b — Rewards system backend tests (10 tests)."""
from __future__ import annotations

import asyncio
from datetime import date, timedelta
import uuid

import pytest
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.settings import get_settings
from app.models import (
    EcoOrder,
    EcoProduct,
    RewardTransaction,
    RewardWallet,
    User,
    UserRole,
)
from app.services import rewards_service
from app.tests.conftest import _fresh_token


def _run(coro):
    return asyncio.run(coro)


@pytest.fixture
def rewards_test_user(override_real_db):
    """Create a temporary GENERATOR user with no wallet initially; clean up after test."""
    uid = uuid.uuid4()
    email = f"ramesh.kumar.{uid.hex[:8]}@cwm-test.io"

    async def _setup():
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                user = User(
                    id=uid,
                    email=email,
                    password_hash="hashed_test_pw",
                    full_name="Ramesh Kumar",
                    role=UserRole.GENERATOR,
                    is_active=True,
                    is_verified=True,
                )
                session.add(user)
                await session.commit()
        finally:
            await engine.dispose()

    _run(_setup())
    token = _fresh_token(str(uid), "GENERATOR", email)
    headers = {"Authorization": f"Bearer {token}"}

    yield {"id": uid, "email": email, "headers": headers}

    async def _teardown():
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                await session.execute(delete(EcoOrder).where(EcoOrder.user_id == uid))
                await session.execute(
                    delete(RewardTransaction).where(RewardTransaction.user_id == uid)
                )
                await session.execute(delete(RewardWallet).where(RewardWallet.user_id == uid))
                await session.execute(delete(User).where(User.id == uid))
                await session.commit()
        finally:
            await engine.dispose()

    _run(_teardown())


def test_wallet_created_on_first_view(client, rewards_test_user):
    """1. GET /api/v1/rewards/wallet auto-creates wallet if missing."""
    res = client.get("/api/v1/rewards/wallet", headers=rewards_test_user["headers"])
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["user_id"] == str(rewards_test_user["id"])
    assert data["points_balance"] == 0
    assert data["lifetime_points"] == 0
    assert data["streak_days"] == 0


def test_award_points_creates_transaction(client, rewards_test_user):
    """2. Calling award_points creates a transaction row and updates wallet balance."""
    uid = rewards_test_user["id"]

    async def _award():
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                await rewards_service.award_points(
                    user_id=uid,
                    points=350,
                    transaction_type="earn_intake",
                    description="Test intake weighed 35kg",
                    session=session,
                    reference_type="intake",
                    reference_id=uuid.uuid4(),
                )
        finally:
            await engine.dispose()

    _run(_award())

    w_res = client.get("/api/v1/rewards/wallet", headers=rewards_test_user["headers"])
    assert w_res.status_code == 200
    assert w_res.json()["points_balance"] == 350
    assert w_res.json()["lifetime_points"] == 350

    tx_res = client.get("/api/v1/rewards/transactions", headers=rewards_test_user["headers"])
    assert tx_res.status_code == 200
    tx_data = tx_res.json()
    assert tx_data["total"] == 1
    assert tx_data["items"][0]["points_delta"] == 350
    assert tx_data["items"][0]["transaction_type"] == "earn_intake"


def test_award_idempotent_on_same_reference(client, rewards_test_user):
    """3. Calling award_points twice with the same reference_id creates only one transaction."""
    uid = rewards_test_user["id"]
    ref_id = uuid.uuid4()

    async def _award_twice():
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                tx1 = await rewards_service.award_points(
                    user_id=uid,
                    points=250,
                    transaction_type="earn_intake",
                    description="First call",
                    session=session,
                    reference_type="intake",
                    reference_id=ref_id,
                )
                tx2 = await rewards_service.award_points(
                    user_id=uid,
                    points=250,
                    transaction_type="earn_intake",
                    description="Duplicate call",
                    session=session,
                    reference_type="intake",
                    reference_id=ref_id,
                )
                assert tx1.id == tx2.id
        finally:
            await engine.dispose()

    _run(_award_twice())

    w_res = client.get("/api/v1/rewards/wallet", headers=rewards_test_user["headers"])
    assert w_res.json()["points_balance"] == 250

    tx_res = client.get("/api/v1/rewards/transactions", headers=rewards_test_user["headers"])
    assert tx_res.json()["total"] == 1


def test_redeem_voucher_decrements_points_and_stock(client, rewards_test_user):
    """4. Redeeming a voucher deducts points, decrements stock, and creates an EcoOrder."""
    uid = rewards_test_user["id"]

    async def _prep():
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                await rewards_service.award_points(
                    user_id=uid,
                    points=500,
                    transaction_type="earn_intake",
                    description="Seed points for redemption",
                    session=session,
                )
                p = (
                    await session.execute(
                        select(EcoProduct)
                        .where(EcoProduct.points_cost <= 300, EcoProduct.stock_quantity > 0)
                        .order_by(EcoProduct.points_cost.asc())
                        .limit(1)
                    )
                ).scalar_one()
                return str(p.id), p.points_cost, p.stock_quantity
        finally:
            await engine.dispose()

    product_id, cost, initial_stock = _run(_prep())

    res = client.post(
        "/api/v1/rewards/redeem",
        json={"product_id": product_id},
        headers=rewards_test_user["headers"],
    )
    assert res.status_code == 200, res.text
    order_data = res.json()
    assert order_data["product_id"] == product_id
    assert order_data["points_paid"] == cost
    assert order_data["status"] == "pending"

    w_res = client.get("/api/v1/rewards/wallet", headers=rewards_test_user["headers"])
    assert w_res.json()["points_balance"] == 500 - cost

    # Restore stock by +1 so catalog stays pristine
    async def _check_and_restore_stock():
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                p = (
                    await session.execute(
                        select(EcoProduct).where(EcoProduct.id == uuid.UUID(product_id))
                    )
                ).scalar_one()
                new_stock = p.stock_quantity
                p.stock_quantity = initial_stock
                await session.commit()
                return new_stock
        finally:
            await engine.dispose()

    new_stock = _run(_check_and_restore_stock())
    assert new_stock == initial_stock - 1


def test_redeem_insufficient_points_returns_422(client, rewards_test_user):
    """5. Redeeming a voucher without enough points returns 422."""
    p_res = client.get("/api/v1/rewards/products", headers=rewards_test_user["headers"])
    assert p_res.status_code == 200
    product_id = p_res.json()["items"][0]["id"]

    res = client.post(
        "/api/v1/rewards/redeem",
        json={"product_id": product_id},
        headers=rewards_test_user["headers"],
    )
    assert res.status_code == 422


def test_redeem_out_of_stock_returns_422(client, rewards_test_user):
    """6. Redeeming an out-of-stock voucher returns 422."""
    uid = rewards_test_user["id"]
    temp_prod_id = uuid.uuid4()

    async def _setup_oos():
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                await rewards_service.award_points(
                    user_id=uid,
                    points=1000,
                    transaction_type="earn_intake",
                    description="Points for OOS test",
                    session=session,
                )
                oos_prod = EcoProduct(
                    id=temp_prod_id,
                    title="Out Of Stock Test Voucher",
                    description="Zero stock item",
                    price=100.0,
                    stock_quantity=0,
                    category="LIFESTYLE",
                    unit="piece",
                    weight_kg=0.1,
                    points_cost=100,
                    is_active=True,
                )
                session.add(oos_prod)
                await session.commit()
        finally:
            await engine.dispose()

    _run(_setup_oos())
    try:
        res = client.post(
            "/api/v1/rewards/redeem",
            json={"product_id": str(temp_prod_id)},
            headers=rewards_test_user["headers"],
        )
        assert res.status_code == 422
    finally:
        async def _cleanup_oos():
            engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
            try:
                async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                    await session.execute(
                        delete(EcoProduct).where(EcoProduct.id == temp_prod_id)
                    )
                    await session.commit()
            finally:
                await engine.dispose()

        _run(_cleanup_oos())


def test_streak_increments_on_consecutive_days(rewards_test_user):
    """7. Submitting across 3 consecutive calendar days increments streak_days to 3."""
    uid = rewards_test_user["id"]
    d1 = date(2026, 10, 10)
    d2 = d1 + timedelta(days=1)
    d3 = d1 + timedelta(days=2)

    async def _run_streak():
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                await rewards_service.record_submission_streak(uid, session, submission_date=d1)
                await rewards_service.record_submission_streak(uid, session, submission_date=d2)
                w = await rewards_service.record_submission_streak(uid, session, submission_date=d3)
                return w.streak_days, w.last_submission_date
        finally:
            await engine.dispose()

    streak_days, last_date = _run(_run_streak())
    assert streak_days == 3
    assert last_date == d3


def test_streak_resets_after_gap(rewards_test_user):
    """8. Submitting on day 1 and day 3 (skipping day 2) resets streak_days to 1."""
    uid = rewards_test_user["id"]
    d1 = date(2026, 10, 10)
    d3 = d1 + timedelta(days=2)

    async def _run_gap():
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                await rewards_service.record_submission_streak(uid, session, submission_date=d1)
                w = await rewards_service.record_submission_streak(uid, session, submission_date=d3)
                return w.streak_days, w.last_submission_date
        finally:
            await engine.dispose()

    streak_days, last_date = _run(_run_gap())
    assert streak_days == 1
    assert last_date == d3


def test_leaderboard_returns_ranked_users(client, rewards_test_user):
    """9. GET /api/v1/rewards/leaderboard returns ranked entries sorted descending by points."""
    uid = rewards_test_user["id"]

    async def _seed_pts():
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                await rewards_service.award_points(
                    user_id=uid,
                    points=9999,
                    transaction_type="earn_intake",
                    description="High score test",
                    session=session,
                )
        finally:
            await engine.dispose()

    _run(_seed_pts())

    res = client.get(
        "/api/v1/rewards/leaderboard?period=week",
        headers=rewards_test_user["headers"],
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["period"] == "week"
    assert len(data["entries"]) >= 1
    assert data["entries"][0]["rank"] == 1
    assert data["entries"][0]["points"] >= 9999


def test_leaderboard_masks_pii(client, rewards_test_user):
    """10. Leaderboard masks user names as 'R. Kumar' and never exposes email addresses."""
    uid = rewards_test_user["id"]

    async def _seed_pts():
        engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                await rewards_service.award_points(
                    user_id=uid,
                    points=8888,
                    transaction_type="earn_intake",
                    description="PII mask check",
                    session=session,
                )
        finally:
            await engine.dispose()

    _run(_seed_pts())

    res = client.get(
        "/api/v1/rewards/leaderboard?period=all_time",
        headers=rewards_test_user["headers"],
    )
    assert res.status_code == 200
    entries = res.json()["entries"]
    my_entry = next((e for e in entries if e["user_id"] == str(uid)), None)
    assert my_entry is not None
    assert my_entry["display_name"] == "R. Kumar"
    for entry in entries:
        assert "@" not in entry["display_name"]
