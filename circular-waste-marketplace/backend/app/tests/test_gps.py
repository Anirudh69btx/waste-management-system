"""Tests for GPS location ping ingestion, current location telemetry, and route history."""
import uuid
from decimal import Decimal
import pytest
from starlette.testclient import TestClient

from app.core.security import create_access_token


def _register_user(client: TestClient, role: str) -> dict:
    unique_id = uuid.uuid4().hex[:8]
    email = f"gps_{unique_id}@test.com"
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


def _create_vehicle(client: TestClient, admin_headers: dict, driver_id: str | None = None) -> dict:
    plate = f"KA{uuid.uuid4().hex[:6].upper()}"
    res = client.post(
        "/api/v1/fleet/vehicles",
        headers=admin_headers,
        json={"plate_number": plate, "capacity_kg": 1500.0},
    )
    assert res.status_code == 201
    veh = res.json()
    if driver_id:
        res_assign = client.patch(
            f"/api/v1/fleet/vehicles/{veh['id']}/assign-driver",
            headers=admin_headers,
            json={"driver_user_id": driver_id},
        )
        assert res_assign.status_code == 200
        veh = res_assign.json()
    return veh


def test_record_ping_device_driver_success(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    veh = _create_vehicle(client, admin["headers"], driver["id"])

    res = client.post(
        f"/api/v1/fleet/vehicles/{veh['id']}/ping",
        headers=driver["headers"],
        json={
            "vehicle_id": veh["id"],
            "lat": 12.9716,
            "lng": 77.5946,
            "speed_kmh": 32.5,
            "heading": 180.0,
            "source": "device",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert float(data["lat"]) == 12.9716
    assert data["source"] == "device"


def test_record_ping_device_non_driver_fails_403(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver1 = _register_user(client, "LOGISTICS")
    driver2 = _register_user(client, "LOGISTICS")
    veh = _create_vehicle(client, admin["headers"], driver1["id"])

    res = client.post(
        f"/api/v1/fleet/vehicles/{veh['id']}/ping",
        headers=driver2["headers"],
        json={
            "vehicle_id": veh["id"],
            "lat": 12.9716,
            "lng": 77.5946,
            "source": "device",
        },
    )
    assert res.status_code == 403


def test_record_ping_simulated_admin_success(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    veh = _create_vehicle(client, admin["headers"])

    res = client.post(
        f"/api/v1/fleet/vehicles/{veh['id']}/ping",
        headers=admin["headers"],
        json={
            "vehicle_id": veh["id"],
            "lat": 12.9750,
            "lng": 77.5980,
            "speed_kmh": 20.0,
            "heading": 90.0,
            "source": "simulated",
        },
    )
    assert res.status_code == 201
    assert res.json()["source"] == "simulated"


def test_record_ping_simulated_non_admin_fails_403(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    veh = _create_vehicle(client, admin["headers"], driver["id"])

    res = client.post(
        f"/api/v1/fleet/vehicles/{veh['id']}/ping",
        headers=driver["headers"],
        json={
            "vehicle_id": veh["id"],
            "lat": 12.9750,
            "lng": 77.5980,
            "source": "simulated",
        },
    )
    assert res.status_code == 403


def test_record_ping_manual_admin_success(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    veh = _create_vehicle(client, admin["headers"])

    res = client.post(
        f"/api/v1/fleet/vehicles/{veh['id']}/ping",
        headers=admin["headers"],
        json={
            "vehicle_id": veh["id"],
            "lat": 12.9800,
            "lng": 77.6000,
            "source": "manual",
        },
    )
    assert res.status_code == 201
    assert res.json()["source"] == "manual"


def test_get_vehicle_location_latest(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    veh = _create_vehicle(client, admin["headers"])

    client.post(
        f"/api/v1/fleet/vehicles/{veh['id']}/ping",
        headers=admin["headers"],
        json={
            "vehicle_id": veh["id"],
            "lat": 12.9716,
            "lng": 77.5946,
            "speed_kmh": 40.0,
            "heading": 120.0,
            "source": "device",
        },
    )

    res = client.get(f"/api/v1/fleet/vehicles/{veh['id']}/location", headers=admin["headers"])
    assert res.status_code == 200
    data = res.json()
    assert float(data["lat"]) == 12.9716
    assert float(data["lng"]) == 77.5946
    assert float(data["speed_kmh"]) == 40.0
    assert data["is_simulated"] is False


def test_get_vehicle_location_is_simulated_flag(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    veh = _create_vehicle(client, admin["headers"])

    client.post(
        f"/api/v1/fleet/vehicles/{veh['id']}/ping",
        headers=admin["headers"],
        json={
            "vehicle_id": veh["id"],
            "lat": 12.9750,
            "lng": 77.5980,
            "source": "simulated",
        },
    )

    res = client.get(f"/api/v1/fleet/vehicles/{veh['id']}/location", headers=admin["headers"])
    assert res.status_code == 200
    data = res.json()
    assert data["source"] == "simulated"
    assert data["is_simulated"] is True


def test_get_vehicle_route_history(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    veh = _create_vehicle(client, admin["headers"])

    # Ping 1
    client.post(
        f"/api/v1/fleet/vehicles/{veh['id']}/ping",
        headers=admin["headers"],
        json={"vehicle_id": veh["id"], "lat": 12.9716, "lng": 77.5946, "source": "device"},
    )
    # Ping 2
    client.post(
        f"/api/v1/fleet/vehicles/{veh['id']}/ping",
        headers=admin["headers"],
        json={"vehicle_id": veh["id"], "lat": 12.9730, "lng": 77.5960, "source": "device"},
    )

    res = client.get(f"/api/v1/fleet/vehicles/{veh['id']}/route?limit=10", headers=admin["headers"])
    assert res.status_code == 200
    data = res.json()
    assert len(data["pings"]) >= 2
    assert data["total_distance_km"] > 0


def test_get_vehicle_route_distance_calculation(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    veh = _create_vehicle(client, admin["headers"])

    # Post 2 points approximately 1.5 km apart
    client.post(
        f"/api/v1/fleet/vehicles/{veh['id']}/ping",
        headers=admin["headers"],
        json={"vehicle_id": veh["id"], "lat": 12.9700, "lng": 77.5900, "source": "device"},
    )
    client.post(
        f"/api/v1/fleet/vehicles/{veh['id']}/ping",
        headers=admin["headers"],
        json={"vehicle_id": veh["id"], "lat": 12.9800, "lng": 77.6000, "source": "device"},
    )

    res = client.get(f"/api/v1/fleet/vehicles/{veh['id']}/route", headers=admin["headers"])
    assert res.status_code == 200
    assert 1.0 < res.json()["total_distance_km"] < 2.5


def test_record_ping_vehicle_not_found(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    fake_id = str(uuid.uuid4())
    res = client.post(
        f"/api/v1/fleet/vehicles/{fake_id}/ping",
        headers=admin["headers"],
        json={
            "vehicle_id": fake_id,
            "lat": 12.9716,
            "lng": 77.5946,
            "source": "simulated",
        },
    )
    assert res.status_code == 404
