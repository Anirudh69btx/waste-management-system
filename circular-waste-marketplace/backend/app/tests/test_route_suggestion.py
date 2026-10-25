"""Tests for capacity and waste-stream aware route suggestion."""
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from starlette.testclient import TestClient

from app.core.security import create_access_token


def _register_user(client: TestClient, role: str) -> dict:
    unique_id = uuid.uuid4().hex[:8]
    email = f"rt_{unique_id}@test.com"
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


def _create_pickup_at(
    client: TestClient, supplier: dict, category_id: int, weight_kg: float, lat: float, lng: float
) -> str:
    client.post(
        "/api/v1/suppliers/profile",
        headers=supplier["headers"],
        json={
            "business_name": f"Supplier {lat}",
            "registration_number": f"REG-{uuid.uuid4().hex[:8].upper()}",
            "facility_address": "123 Eco Way",
            "latitude": lat,
            "longitude": lng,
            "contact_phone": "+919876543210",
        },
    )
    res_intake = client.post(
        "/api/v1/intake/create",
        headers=supplier["headers"],
        data={
            "category_id": category_id,
            "declared_weight_kg": weight_kg,
            "purity_grade": "GRADE_A",
        },
    )
    assert res_intake.status_code == 201
    intake_id = res_intake.json()["id"]

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
    assert res_pickup.status_code == 201
    return res_pickup.json()["id"]


def test_suggest_route_admin_success(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    supplier = _register_user(client, "GENERATOR")
    veh = _create_vehicle(client, admin["headers"], 1500.0)
    p1 = _create_pickup_at(client, supplier, 34, 100.0, 12.9716, 77.5946)
    p2 = _create_pickup_at(client, supplier, 34, 150.0, 12.9750, 77.5980)

    res = client.post(
        "/api/v1/fleet/trips/suggest",
        headers=admin["headers"],
        json={
            "vehicle_id": veh["id"],
            "driver_user_id": driver["id"],
            "pickup_request_ids": [p1, p2],
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["ordered_pickup_request_ids"]) == 2
    assert data["stream_class"] == "DRY_RECYCLABLE"
    assert data["total_weight_kg"] == 250.0
    assert data["total_distance_km"] >= 0


def test_suggest_route_non_admin_forbidden(client: TestClient, override_real_db):
    driver = _register_user(client, "LOGISTICS")
    res = client.post(
        "/api/v1/fleet/trips/suggest",
        headers=driver["headers"],
        json={
            "vehicle_id": str(uuid.uuid4()),
            "driver_user_id": driver["id"],
            "pickup_request_ids": [str(uuid.uuid4())],
        },
    )
    assert res.status_code == 403


def test_suggest_route_vehicle_not_found(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    res = client.post(
        "/api/v1/fleet/trips/suggest",
        headers=admin["headers"],
        json={
            "vehicle_id": str(uuid.uuid4()),
            "driver_user_id": driver["id"],
            "pickup_request_ids": [str(uuid.uuid4())],
        },
    )
    assert res.status_code == 404


def test_suggest_route_excludes_non_dominant_stream(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    supplier = _register_user(client, "GENERATOR")
    veh = _create_vehicle(client, admin["headers"], 2000.0)

    # 2 DRY_RECYCLABLE (34), 1 ORGANIC (33)
    p1 = _create_pickup_at(client, supplier, 34, 100.0, 12.9716, 77.5946)
    p2 = _create_pickup_at(client, supplier, 34, 150.0, 12.9750, 77.5980)
    p3 = _create_pickup_at(client, supplier, 33, 80.0, 12.9760, 77.5990)

    res = client.post(
        "/api/v1/fleet/trips/suggest",
        headers=admin["headers"],
        json={
            "vehicle_id": veh["id"],
            "driver_user_id": driver["id"],
            "pickup_request_ids": [p1, p2, p3],
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["stream_class"] == "DRY_RECYCLABLE"
    assert p3 in data["excluded_pickup_ids"]
    assert p1 in data["ordered_pickup_request_ids"]
    assert p2 in data["ordered_pickup_request_ids"]


def test_suggest_route_excludes_capacity_exceeded(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    supplier = _register_user(client, "GENERATOR")
    # Vehicle capacity 250kg
    veh = _create_vehicle(client, admin["headers"], 250.0)

    p1 = _create_pickup_at(client, supplier, 34, 150.0, 12.9716, 77.5946)
    p2 = _create_pickup_at(client, supplier, 34, 200.0, 12.9750, 77.5980)

    res = client.post(
        "/api/v1/fleet/trips/suggest",
        headers=admin["headers"],
        json={
            "vehicle_id": veh["id"],
            "driver_user_id": driver["id"],
            "pickup_request_ids": [p1, p2],
        },
    )
    assert res.status_code == 200
    data = res.json()
    # One fits (150kg), second one (200kg) exceeds remaining 100kg capacity
    assert len(data["ordered_pickup_request_ids"]) == 1
    assert len(data["excluded_pickup_ids"]) == 1


def test_suggest_route_nearest_neighbor_ordering(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    s1 = _register_user(client, "GENERATOR")
    s2 = _register_user(client, "GENERATOR")
    veh = _create_vehicle(client, admin["headers"], 3000.0)

    # Put vehicle at (12.9700, 77.5900)
    client.post(
        f"/api/v1/fleet/vehicles/{veh['id']}/ping",
        headers=admin["headers"],
        json={"vehicle_id": veh["id"], "lat": 12.9700, "lng": 77.5900, "source": "simulated"},
    )

    # Near point (12.9710, 77.5910)
    p_near = _create_pickup_at(client, s1, 34, 50.0, 12.9710, 77.5910)
    # Far point (12.9900, 77.6200)
    p_far = _create_pickup_at(client, s2, 34, 50.0, 12.9900, 77.6200)

    res = client.post(
        "/api/v1/fleet/trips/suggest",
        headers=admin["headers"],
        json={
            "vehicle_id": veh["id"],
            "driver_user_id": driver["id"],
            # Submit far first
            "pickup_request_ids": [p_far, p_near],
        },
    )
    assert res.status_code == 200
    data = res.json()
    # Greedy nearest neighbor should pick p_near before p_far
    assert str(data["ordered_pickup_request_ids"][0]) == str(p_near)
    assert str(data["ordered_pickup_request_ids"][1]) == str(p_far)
