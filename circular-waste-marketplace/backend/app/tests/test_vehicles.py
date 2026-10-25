"""Tests for Vehicle management endpoints."""
import uuid
import pytest
from starlette.testclient import TestClient

from app.core.security import create_access_token
from app.models import UserRole


def _register_user(client: TestClient, role: str) -> dict:
    unique_id = uuid.uuid4().hex[:8]
    email = f"veh_{unique_id}@test.com"
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


def test_create_vehicle_admin_success(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    plate = f"KA{uuid.uuid4().hex[:6].upper()}"
    res = client.post(
        "/api/v1/fleet/vehicles",
        headers=admin["headers"],
        json={"plate_number": plate, "capacity_kg": 1200.0, "fuel_type": "diesel"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["plate_number"] == plate
    assert data["status"] == "available"


def test_create_vehicle_duplicate_plate_fails(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    plate = f"KA{uuid.uuid4().hex[:6].upper()}"
    res1 = client.post(
        "/api/v1/fleet/vehicles",
        headers=admin["headers"],
        json={"plate_number": plate, "capacity_kg": 1200.0, "fuel_type": "diesel"},
    )
    assert res1.status_code == 201

    res2 = client.post(
        "/api/v1/fleet/vehicles",
        headers=admin["headers"],
        json={"plate_number": plate, "capacity_kg": 1500.0, "fuel_type": "diesel"},
    )
    assert res2.status_code == 409


def test_create_vehicle_non_admin_forbidden(client: TestClient, override_real_db):
    driver = _register_user(client, "LOGISTICS")
    res = client.post(
        "/api/v1/fleet/vehicles",
        headers=driver["headers"],
        json={"plate_number": f"KA{uuid.uuid4().hex[:6].upper()}", "capacity_kg": 800.0},
    )
    assert res.status_code == 403


def test_list_vehicles_admin(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    plate = f"KA{uuid.uuid4().hex[:6].upper()}"
    create_res = client.post(
        "/api/v1/fleet/vehicles",
        headers=admin["headers"],
        json={"plate_number": plate, "capacity_kg": 1000.0},
    )
    assert create_res.status_code == 201
    created_id = create_res.json()["id"]
    # Use page_size large enough or filter — list all and search
    res = client.get("/api/v1/fleet/vehicles?limit=100", headers=admin["headers"])
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    assert any(v["id"] == created_id for v in data["items"])


def test_list_vehicles_logistics_filtered(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    plate = f"KA{uuid.uuid4().hex[:6].upper()}"
    res_veh = client.post(
        "/api/v1/fleet/vehicles",
        headers=admin["headers"],
        json={"plate_number": plate, "capacity_kg": 1000.0},
    )
    veh_id = res_veh.json()["id"]

    # Assign driver
    client.patch(
        f"/api/v1/fleet/vehicles/{veh_id}/assign-driver",
        headers=admin["headers"],
        json={"driver_user_id": driver["id"]},
    )

    # Driver lists vehicles -> should see assigned
    res_driver = client.get("/api/v1/fleet/vehicles", headers=driver["headers"])
    assert res_driver.status_code == 200
    items = res_driver.json()["items"]
    assert any(v["id"] == veh_id for v in items)


def test_update_vehicle_success(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    plate = f"KA{uuid.uuid4().hex[:6].upper()}"
    res = client.post(
        "/api/v1/fleet/vehicles",
        headers=admin["headers"],
        json={"plate_number": plate, "capacity_kg": 1000.0},
    )
    veh_id = res.json()["id"]

    patch_res = client.patch(
        f"/api/v1/fleet/vehicles/{veh_id}",
        headers=admin["headers"],
        json={"capacity_kg": 1800.0, "status": "maintenance"},
    )
    assert patch_res.status_code == 200
    assert float(patch_res.json()["capacity_kg"]) == 1800.0
    assert patch_res.json()["status"] == "maintenance"


def test_assign_driver_success(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    plate = f"KA{uuid.uuid4().hex[:6].upper()}"
    res = client.post(
        "/api/v1/fleet/vehicles",
        headers=admin["headers"],
        json={"plate_number": plate, "capacity_kg": 1000.0},
    )
    veh_id = res.json()["id"]

    assign_res = client.patch(
        f"/api/v1/fleet/vehicles/{veh_id}/assign-driver",
        headers=admin["headers"],
        json={"driver_user_id": driver["id"]},
    )
    assert assign_res.status_code == 200
    assert assign_res.json()["assigned_driver_user_id"] == driver["id"]


def test_assign_non_logistics_driver_fails(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    generator = _register_user(client, "GENERATOR")
    plate = f"KA{uuid.uuid4().hex[:6].upper()}"
    res = client.post(
        "/api/v1/fleet/vehicles",
        headers=admin["headers"],
        json={"plate_number": plate, "capacity_kg": 1000.0},
    )
    veh_id = res.json()["id"]

    assign_res = client.patch(
        f"/api/v1/fleet/vehicles/{veh_id}/assign-driver",
        headers=admin["headers"],
        json={"driver_user_id": generator["id"]},
    )
    assert assign_res.status_code == 422
