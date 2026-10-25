"""Tests for Trip creation validations and stream/capacity checks."""
import uuid
from decimal import Decimal
import pytest
from starlette.testclient import TestClient

from app.core.security import create_access_token
from app.models import UserRole


def _register_user(client: TestClient, role: str) -> dict:
    unique_id = uuid.uuid4().hex[:8]
    email = f"tc_{unique_id}@test.com"
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "full_name": f"{role} User", "role": role},
    )
    assert res.status_code == 201
    token = res.json()["tokens"]["access_token"]
    user_id = res.json()["user"]["id"]
    return {"id": user_id, "email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


def _create_admin_user(client: TestClient) -> dict:
    from sqlalchemy import create_engine, text
    from app.core.settings import get_settings

    u = _register_user(client, "GENERATOR")
    engine = create_engine(get_settings().database_url_sync)
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE users SET role = 'ADMIN' WHERE id = :id"),
            {"id": u["id"]},
        )
    engine.dispose()
    token = create_access_token(
        subject=u["id"],
        role="ADMIN",
        email=u["email"],
        is_verified=True,
    )
    return {"id": u["id"], "email": u["email"], "token": token, "headers": {"Authorization": f"Bearer {token}"}}


def _create_vehicle(client: TestClient, admin_headers: dict, capacity_kg: float = 1000.0) -> dict:
    plate = f"KA{uuid.uuid4().hex[:6].upper()}"
    res = client.post(
        "/api/v1/fleet/vehicles",
        headers=admin_headers,
        json={"plate_number": plate, "capacity_kg": capacity_kg},
    )
    assert res.status_code == 201
    return res.json()


def _create_pickup(client: TestClient, supplier: dict, category_id: int = 34, weight_kg: float = 100.0) -> str:
    # 1. ensure supplier profile
    client.post(
        "/api/v1/suppliers/profile",
        headers=supplier["headers"],
        json={
            "business_name": "Test Supplier",
            "registration_number": f"REG-{uuid.uuid4().hex[:8].upper()}",
            "facility_address": "123 Eco Way",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "contact_phone": "+919876543210",
        },
    )
    # 2. create intake
    res_intake = client.post(
        "/api/v1/intake/create",
        headers=supplier["headers"],
        data={
            "category_id": category_id,
            "declared_weight_kg": weight_kg,
            "purity_grade": "GRADE_A",
        },
    )
    assert res_intake.status_code == 201, f"Intake failed: {res_intake.text}"
    intake_id = res_intake.json()["id"]

    # 3. create pickup request
    from datetime import datetime, timezone, timedelta
    start = datetime.now(timezone.utc) + timedelta(days=1)
    end = start + timedelta(hours=2)
    res_pickup = client.post(
        "/api/v1/pickups",
        headers=supplier["headers"],
        json={
            "intake_id": intake_id,
            "scheduled_start": start.isoformat(),
            "scheduled_end": end.isoformat(),
        },
    )
    assert res_pickup.status_code == 201, f"Pickup failed: {res_pickup.text}"
    return res_pickup.json()["id"]


def test_create_trip_admin_success(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    supplier = _register_user(client, "GENERATOR")
    veh = _create_vehicle(client, admin["headers"], 1500.0)
    pid = _create_pickup(client, supplier, category_id=34, weight_kg=150.0)

    res = client.post(
        "/api/v1/fleet/trips",
        headers=admin["headers"],
        json={
            "vehicle_id": veh["id"],
            "driver_user_id": driver["id"],
            "pickup_request_ids": [pid],
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "planned"
    assert len(data["stops"]) == 1


def test_create_trip_non_admin_forbidden(client: TestClient, override_real_db):
    driver = _register_user(client, "LOGISTICS")
    res = client.post(
        "/api/v1/fleet/trips",
        headers=driver["headers"],
        json={
            "vehicle_id": str(uuid.uuid4()),
            "driver_user_id": driver["id"],
            "pickup_request_ids": [str(uuid.uuid4())],
        },
    )
    assert res.status_code == 403


def test_create_trip_vehicle_not_found(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    res = client.post(
        "/api/v1/fleet/trips",
        headers=admin["headers"],
        json={
            "vehicle_id": str(uuid.uuid4()),
            "driver_user_id": driver["id"],
            "pickup_request_ids": [str(uuid.uuid4())],
        },
    )
    assert res.status_code == 404


def test_create_trip_vehicle_not_available(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    supplier = _register_user(client, "GENERATOR")
    veh = _create_vehicle(client, admin["headers"], 1500.0)
    # Put vehicle in maintenance
    client.patch(
        f"/api/v1/fleet/vehicles/{veh['id']}",
        headers=admin["headers"],
        json={"status": "maintenance"},
    )
    pid = _create_pickup(client, supplier, category_id=34, weight_kg=150.0)
    res = client.post(
        "/api/v1/fleet/trips",
        headers=admin["headers"],
        json={
            "vehicle_id": veh["id"],
            "driver_user_id": driver["id"],
            "pickup_request_ids": [pid],
        },
    )
    assert res.status_code == 409


def test_create_trip_driver_not_logistics(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    supplier = _register_user(client, "GENERATOR")
    veh = _create_vehicle(client, admin["headers"], 1500.0)
    pid = _create_pickup(client, supplier, category_id=34, weight_kg=150.0)
    res = client.post(
        "/api/v1/fleet/trips",
        headers=admin["headers"],
        json={
            "vehicle_id": veh["id"],
            "driver_user_id": supplier["id"],
            "pickup_request_ids": [pid],
        },
    )
    assert res.status_code == 422


def test_create_trip_pickup_not_found(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    veh = _create_vehicle(client, admin["headers"], 1500.0)
    res = client.post(
        "/api/v1/fleet/trips",
        headers=admin["headers"],
        json={
            "vehicle_id": veh["id"],
            "driver_user_id": driver["id"],
            "pickup_request_ids": [str(uuid.uuid4())],
        },
    )
    assert res.status_code == 404


def test_create_trip_incompatible_streams_rejected(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    supplier = _register_user(client, "GENERATOR")
    veh = _create_vehicle(client, admin["headers"], 1500.0)

    # 33 = ORGANIC, 34 = PLASTIC (DRY_RECYCLABLE)
    p1 = _create_pickup(client, supplier, category_id=33, weight_kg=50.0)
    p2 = _create_pickup(client, supplier, category_id=34, weight_kg=50.0)

    res = client.post(
        "/api/v1/fleet/trips",
        headers=admin["headers"],
        json={
            "vehicle_id": veh["id"],
            "driver_user_id": driver["id"],
            "pickup_request_ids": [p1, p2],
        },
    )
    assert res.status_code == 422
    assert "incompatible" in res.json()["detail"].lower()


def test_create_trip_capacity_exceeded_rejected(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    supplier = _register_user(client, "GENERATOR")
    # Small capacity vehicle 200kg
    veh = _create_vehicle(client, admin["headers"], 200.0)
    # Pickup declared weight 500kg
    pid = _create_pickup(client, supplier, category_id=34, weight_kg=500.0)

    res = client.post(
        "/api/v1/fleet/trips",
        headers=admin["headers"],
        json={
            "vehicle_id": veh["id"],
            "driver_user_id": driver["id"],
            "pickup_request_ids": [pid],
        },
    )
    assert res.status_code == 422
    assert "capacity" in res.json()["detail"].lower()


def test_create_trip_duplicate_active_trip_driver(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    supplier = _register_user(client, "GENERATOR")
    v1 = _create_vehicle(client, admin["headers"], 1000.0)
    v2 = _create_vehicle(client, admin["headers"], 1000.0)
    p1 = _create_pickup(client, supplier, category_id=34, weight_kg=100.0)
    p2 = _create_pickup(client, supplier, category_id=34, weight_kg=100.0)

    res1 = client.post(
        "/api/v1/fleet/trips",
        headers=admin["headers"],
        json={
            "vehicle_id": v1["id"],
            "driver_user_id": driver["id"],
            "pickup_request_ids": [p1],
        },
    )
    assert res1.status_code == 201

    res2 = client.post(
        "/api/v1/fleet/trips",
        headers=admin["headers"],
        json={
            "vehicle_id": v2["id"],
            "driver_user_id": driver["id"],
            "pickup_request_ids": [p2],
        },
    )
    assert res2.status_code == 409


def test_create_trip_duplicate_active_trip_vehicle(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    d1 = _register_user(client, "LOGISTICS")
    d2 = _register_user(client, "LOGISTICS")
    supplier = _register_user(client, "GENERATOR")
    v1 = _create_vehicle(client, admin["headers"], 1000.0)
    p1 = _create_pickup(client, supplier, category_id=34, weight_kg=100.0)
    p2 = _create_pickup(client, supplier, category_id=34, weight_kg=100.0)

    res1 = client.post(
        "/api/v1/fleet/trips",
        headers=admin["headers"],
        json={
            "vehicle_id": v1["id"],
            "driver_user_id": d1["id"],
            "pickup_request_ids": [p1],
        },
    )
    assert res1.status_code == 201

    res2 = client.post(
        "/api/v1/fleet/trips",
        headers=admin["headers"],
        json={
            "vehicle_id": v1["id"],
            "driver_user_id": d2["id"],
            "pickup_request_ids": [p2],
        },
    )
    assert res2.status_code == 409
