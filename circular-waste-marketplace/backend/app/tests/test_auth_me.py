"""
Integration tests for profile retrieval and update: GET /me and PATCH /me.
"""
import uuid
import pytest
from starlette.testclient import TestClient


def _register_user(client: TestClient, role: str = "GENERATOR") -> dict:
    unique_id = uuid.uuid4().hex[:8]
    email = f"me_{unique_id}@test.com"
    phone = f"+9191{int(unique_id, 16) % 100000000:08d}"
    pw = "Password123!"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": pw,
            "full_name": "Original Name",
            "role": role,
            "phone_number": phone,
        },
    )
    assert res.status_code == 201
    tokens = res.json()["tokens"]
    return {
        "email": email,
        "phone": phone,
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "headers": {"Authorization": f"Bearer {tokens['access_token']}"},
    }


def test_get_me_success(client: TestClient, override_real_db) -> None:
    """GET /me returns user profile and never leaks password_hash."""
    user = _register_user(client)
    response = client.get("/api/v1/auth/me", headers=user["headers"])
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == user["email"]
    assert data["full_name"] == "Original Name"
    assert data["role"] == "GENERATOR"
    assert "password" not in data
    assert "hashed_password" not in data
    assert "password_hash" not in data


def test_get_me_unauthenticated_fails(client: TestClient) -> None:
    """GET /me without authorization header returns 401."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_get_me_with_refresh_token_fails(client: TestClient, override_real_db) -> None:
    """Passing a refresh token to GET /me is rejected with 401 (token type mismatch)."""
    user = _register_user(client)
    bad_headers = {"Authorization": f"Bearer {user['refresh_token']}"}
    response = client.get("/api/v1/auth/me", headers=bad_headers)
    assert response.status_code == 401


def test_patch_me_full_name(client: TestClient, override_real_db) -> None:
    """PATCH /me updates the full_name field."""
    user = _register_user(client)
    response = client.patch(
        "/api/v1/auth/me",
        headers=user["headers"],
        json={"full_name": "Brand New Name"},
    )
    assert response.status_code == 200
    assert response.json()["full_name"] == "Brand New Name"


def test_patch_me_phone_number(client: TestClient, override_real_db) -> None:
    """PATCH /me updates the phone_number field."""
    user = _register_user(client)
    new_phone = f"+9198{int(uuid.uuid4().hex[:8], 16) % 100000000:08d}"
    response = client.patch(
        "/api/v1/auth/me",
        headers=user["headers"],
        json={"phone_number": new_phone},
    )
    assert response.status_code == 200
    assert response.json()["phone_number"] == new_phone


def test_patch_me_duplicate_phone_fails(client: TestClient, override_real_db) -> None:
    """Attempting to set phone number to one already in use returns 409."""
    user1 = _register_user(client)
    user2 = _register_user(client)

    response = client.patch(
        "/api/v1/auth/me",
        headers=user2["headers"],
        json={"phone_number": user1["phone"]},
    )
    assert response.status_code == 409
