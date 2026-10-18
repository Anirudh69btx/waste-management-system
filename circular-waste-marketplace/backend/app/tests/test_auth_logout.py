"""
Integration tests for user logout: POST /api/v1/auth/logout.
"""
import uuid
import pytest
from starlette.testclient import TestClient


def _get_refresh_token(client: TestClient) -> str:
    unique_id = uuid.uuid4().hex[:8]
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"logout_{unique_id}@test.com",
            "password": "Password123!",
            "full_name": "Logout Tester",
            "role": "LOGISTICS",
        },
    )
    assert res.status_code == 201
    return res.json()["tokens"]["refresh_token"]


def test_logout_success_revokes_token(client: TestClient, override_real_db) -> None:
    """Logging out revokes the refresh token; subsequent refresh fails."""
    refresh_tok = _get_refresh_token(client)

    response = client.post("/api/v1/auth/logout", json={"refresh_token": refresh_tok})
    assert response.status_code == 204

    # Subsequent refresh with revoked token should fail
    ref_res = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_tok})
    assert ref_res.status_code == 401


def test_logout_idempotent_on_revoked_token(client: TestClient, override_real_db) -> None:
    """Calling logout a second time with the same revoked token still returns 204."""
    refresh_tok = _get_refresh_token(client)
    client.post("/api/v1/auth/logout", json={"refresh_token": refresh_tok})

    res2 = client.post("/api/v1/auth/logout", json={"refresh_token": refresh_tok})
    assert res2.status_code == 204


def test_logout_idempotent_on_garbage_token(client: TestClient) -> None:
    """Calling logout with invalid or random string returns 204 without raising error."""
    res = client.post("/api/v1/auth/logout", json={"refresh_token": "random-malformed-token-12345"})
    assert res.status_code == 204
