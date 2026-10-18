"""
Integration tests for Role-Based Access Control (RBAC) and claim verification.
"""
import uuid
import pytest
from starlette.testclient import TestClient
from sqlalchemy import select

from app.core.security import create_access_token
from app.db.session import AsyncSessionLocal
from app.models import User, UserRole


def _register_user(client: TestClient, role: str) -> dict:
    unique_id = uuid.uuid4().hex[:8]
    email = f"rbac_{unique_id}@test.com"
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "full_name": f"{role} User", "role": role},
    )
    assert res.status_code == 201
    token = res.json()["tokens"]["access_token"]
    return {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


def test_rbac_allowed_role_access(client: TestClient, override_real_db) -> None:
    """User with appropriate role can access endpoints guarded by that role."""
    generator = _register_user(client, "GENERATOR")
    # GET /me is available to all authenticated active users
    response = client.get("/api/v1/auth/me", headers=generator["headers"])
    assert response.status_code == 200


def test_rbac_disallowed_role_access(client: TestClient, override_real_db) -> None:
    """GENERATOR attempting an operation requiring RECYCLER/ADMIN is rejected with 403."""
    generator = _register_user(client, "GENERATOR")
    # /api/v1/sorting/process requires RECYCLER or ADMIN
    response = client.post(
        "/api/v1/sorting/process",
        headers=generator["headers"],
        json={
            "intake_id": "00000000-0000-0000-0000-000000000000",
            "sorted_weight_kg": 100.0,
            "recovered_weight_kg": 95.0,
            "waste_category_id": 1,
            "contamination_percent": 5.0,
        },
    )
    assert response.status_code == 403


def test_rbac_admin_satisfies_all_role_gates(client: TestClient, admin_headers: dict[str, str]) -> None:
    """ADMIN role implicitly satisfies any role gate."""
    # /api/v1/sorting/process allows RECYCLER or ADMIN
    res = client.post(
        "/api/v1/sorting/process",
        headers=admin_headers,
        json={
            "intake_id": "00000000-0000-0000-0000-000000000000",
            "facility_location": "Plant 1",
            "input_weight_kg": 100.0,
            "sorted_yield_kg": 95.0,
            "contamination_removed_kg": 5.0,
            "started_at": "2026-10-18T10:00:00Z",
            "completed_at": "2026-10-18T11:00:00Z",
        },
    )
    # Admin passes role check (does not return 403 Forbidden)
    assert res.status_code != 403
    assert res.status_code in [200, 201, 404, 422]


def test_rbac_role_claim_divergence_rejected(client: TestClient, override_real_db) -> None:
    """If DB role changes after token is issued, request is rejected with 401."""
    user_info = _register_user(client, "GENERATOR")
    token = user_info["token"]

    # Now change user's role in DB to RECYCLER using sync engine to prevent loop collisions
    from sqlalchemy import create_engine, text
    from app.core.settings import get_settings

    engine = create_engine(get_settings().database_url_sync)
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE users SET role = 'RECYCLER' WHERE email = :email"),
            {"email": user_info["email"]},
        )
    engine.dispose()

    # Present old token (which has role='GENERATOR')
    # Because DB has role='RECYCLER', get_current_user detects divergence and returns 401
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401

