"""Tests for Trip lifecycle — start, arrive, complete (with weight check), fail, end, cancel."""
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from starlette.testclient import TestClient

from app.core.security import create_access_token


def _register_user(client: TestClient, role: str) -> dict:
    unique_id = uuid.uuid4().hex[:8]
    email = f"tl_{unique_id}@test.com"
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


def _create_pickup_and_intake(client: TestClient, supplier: dict, category_id: int = 34, weight_kg: float = 100.0) -> tuple[str, str]:
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
    pickup_id = res_pickup.json()["id"]
    return pickup_id, intake_id


def _create_trip(client: TestClient, admin: dict, driver: dict, supplier: dict) -> tuple[dict, str, str]:
    veh = _create_vehicle(client, admin["headers"], 1500.0)
    pid, iid = _create_pickup_and_intake(client, supplier, category_id=34, weight_kg=120.0)
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
    return res.json(), pid, iid


def _insert_weight_ticket(intake_id: str, user_id: str, net_weight_kg: float = 120.0):
    from sqlalchemy import create_engine, text
    from app.core.settings import get_settings
    engine = create_engine(get_settings().database_url_sync)
    with engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO weight_tickets (id, intake_id, weight_method, gross_weight_kg, tare_weight_kg, net_weight_kg, recorded_by_user_id, recorded_at, created_at, updated_at)
                VALUES (:id, :intake_id, 'digital_scale', :gross, :tare, :net, :user_id, NOW(), NOW(), NOW())
            """),
            {
                "id": str(uuid.uuid4()),
                "intake_id": intake_id,
                "gross": net_weight_kg + 5.0,
                "tare": 5.0,
                "net": net_weight_kg,
                "user_id": user_id,
            },
        )
    engine.dispose()


def test_start_trip_driver_success(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    supplier = _register_user(client, "GENERATOR")
    trip, pid, _ = _create_trip(client, admin, driver, supplier)

    res = client.patch(f"/api/v1/fleet/trips/{trip['id']}/start", headers=driver["headers"])
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "in_progress"
    assert data["started_at"] is not None
    assert data["stops"][0]["status"] == "en_route"


def test_start_trip_not_authorized(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver1 = _register_user(client, "LOGISTICS")
    driver2 = _register_user(client, "LOGISTICS")
    supplier = _register_user(client, "GENERATOR")
    trip, _, _ = _create_trip(client, admin, driver1, supplier)

    res = client.patch(f"/api/v1/fleet/trips/{trip['id']}/start", headers=driver2["headers"])
    assert res.status_code == 403


def test_start_trip_not_planned(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    supplier = _register_user(client, "GENERATOR")
    trip, _, _ = _create_trip(client, admin, driver, supplier)

    # Start once
    res1 = client.patch(f"/api/v1/fleet/trips/{trip['id']}/start", headers=driver["headers"])
    assert res1.status_code == 200

    # Start again -> 409
    res2 = client.patch(f"/api/v1/fleet/trips/{trip['id']}/start", headers=driver["headers"])
    assert res2.status_code == 409


def test_arrive_stop_success(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    supplier = _register_user(client, "GENERATOR")
    trip, _, _ = _create_trip(client, admin, driver, supplier)

    # Start trip first
    client.patch(f"/api/v1/fleet/trips/{trip['id']}/start", headers=driver["headers"])

    stop_id = trip["stops"][0]["id"]
    res = client.patch(f"/api/v1/fleet/trips/{trip['id']}/stops/{stop_id}/arrive", headers=driver["headers"])
    assert res.status_code == 200
    assert res.json()["status"] == "arrived"


def test_arrive_stop_not_en_route(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    supplier = _register_user(client, "GENERATOR")
    trip, _, _ = _create_trip(client, admin, driver, supplier)
    # Trip is planned, not started
    stop_id = trip["stops"][0]["id"]
    res = client.patch(f"/api/v1/fleet/trips/{trip['id']}/stops/{stop_id}/arrive", headers=driver["headers"])
    assert res.status_code == 409


def test_complete_stop_without_weight_ticket_fails_422(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    supplier = _register_user(client, "GENERATOR")
    trip, _, _ = _create_trip(client, admin, driver, supplier)

    client.patch(f"/api/v1/fleet/trips/{trip['id']}/start", headers=driver["headers"])
    stop_id = trip["stops"][0]["id"]
    client.patch(f"/api/v1/fleet/trips/{trip['id']}/stops/{stop_id}/arrive", headers=driver["headers"])

    # Try to complete without weight ticket
    res = client.patch(f"/api/v1/fleet/trips/{trip['id']}/stops/{stop_id}/complete", headers=driver["headers"])
    assert res.status_code == 422
    assert "Record weight before completing stop" in res.json()["detail"]


def test_complete_stop_with_weight_ticket_success(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    supplier = _register_user(client, "GENERATOR")
    trip, _, iid = _create_trip(client, admin, driver, supplier)

    client.patch(f"/api/v1/fleet/trips/{trip['id']}/start", headers=driver["headers"])
    stop_id = trip["stops"][0]["id"]
    client.patch(f"/api/v1/fleet/trips/{trip['id']}/stops/{stop_id}/arrive", headers=driver["headers"])

    # Insert weight ticket
    _insert_weight_ticket(iid, driver["id"], 120.0)

    # Complete stop
    res = client.patch(
        f"/api/v1/fleet/trips/{trip['id']}/stops/{stop_id}/complete",
        headers=driver["headers"],
        json={"notes": "Loaded smoothly"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "completed"


def test_fail_stop_success(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    supplier = _register_user(client, "GENERATOR")
    trip, _, _ = _create_trip(client, admin, driver, supplier)

    client.patch(f"/api/v1/fleet/trips/{trip['id']}/start", headers=driver["headers"])
    stop_id = trip["stops"][0]["id"]

    res = client.patch(
        f"/api/v1/fleet/trips/{trip['id']}/stops/{stop_id}/fail",
        headers=driver["headers"],
        json={"failure_reason": "Premises were locked, no contact reachable."},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "failed"


def test_end_trip_with_pending_stops_fails(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    supplier = _register_user(client, "GENERATOR")
    trip, _, _ = _create_trip(client, admin, driver, supplier)

    client.patch(f"/api/v1/fleet/trips/{trip['id']}/start", headers=driver["headers"])

    # End trip while stop is en_route -> 409
    res = client.patch(f"/api/v1/fleet/trips/{trip['id']}/end", headers=driver["headers"])
    assert res.status_code == 409


def test_end_trip_all_stops_done_success(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    supplier = _register_user(client, "GENERATOR")
    trip, _, iid = _create_trip(client, admin, driver, supplier)

    client.patch(f"/api/v1/fleet/trips/{trip['id']}/start", headers=driver["headers"])
    stop_id = trip["stops"][0]["id"]
    client.patch(f"/api/v1/fleet/trips/{trip['id']}/stops/{stop_id}/arrive", headers=driver["headers"])
    _insert_weight_ticket(iid, driver["id"], 120.0)
    client.patch(f"/api/v1/fleet/trips/{trip['id']}/stops/{stop_id}/complete", headers=driver["headers"])

    # End trip
    res = client.patch(
        f"/api/v1/fleet/trips/{trip['id']}/end",
        headers=driver["headers"],
        json={"notes": "Trip finished on time."},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "completed"
    assert data["ended_at"] is not None


def test_cancel_trip_admin_success(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    supplier = _register_user(client, "GENERATOR")
    trip, _, _ = _create_trip(client, admin, driver, supplier)

    res = client.patch(
        f"/api/v1/fleet/trips/{trip['id']}/cancel?reason=Vehicle+breakdown",
        headers=admin["headers"],
    )
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled"


def test_cancel_trip_non_admin_forbidden(client: TestClient, override_real_db):
    admin = _create_admin_user(client)
    driver = _register_user(client, "LOGISTICS")
    supplier = _register_user(client, "GENERATOR")
    trip, _, _ = _create_trip(client, admin, driver, supplier)

    res = client.patch(
        f"/api/v1/fleet/trips/{trip['id']}/cancel?reason=Driver+attempt",
        headers=driver["headers"],
    )
    assert res.status_code == 403
