"""
Integration tests for password changes: POST /api/v1/auth/change-password.
"""
import uuid
import pytest
from starlette.testclient import TestClient


def test_change_password_success(client: TestClient, override_real_db) -> None:
    """Changing password revokes all existing refresh tokens and enables login with new password."""
    unique_id = uuid.uuid4().hex[:8]
    email = f"pw_{unique_id}@test.com"
    old_pw = "OldPassword123!"
    new_pw = "NewSuperPassword999!"

    # 1. Register
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": old_pw, "full_name": "Password Changer", "role": "GENERATOR"},
    )
    tokens = reg_res.json()["tokens"]
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    old_refresh = tokens["refresh_token"]

    # 2. Change password
    change_res = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": old_pw, "new_password": new_pw},
    )
    assert change_res.status_code == 204

    # 3. Old refresh token is revoked
    ref_res = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert ref_res.status_code == 401

    # 4. Old password login fails
    old_login = client.post("/api/v1/auth/login", json={"email": email, "password": old_pw})
    assert old_login.status_code == 401

    # 5. New password login succeeds
    new_login = client.post("/api/v1/auth/login", json={"email": email, "password": new_pw})
    assert new_login.status_code == 200
    assert "access_token" in new_login.json()


def test_change_password_wrong_current_password_fails(client: TestClient, override_real_db) -> None:
    """Providing incorrect current password returns 401."""
    unique_id = uuid.uuid4().hex[:8]
    email = f"wrong_pw_{unique_id}@test.com"
    pw = "CorrectPassword123!"

    reg_res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": pw, "full_name": "User", "role": "RECYCLER"},
    )
    headers = {"Authorization": f"Bearer {reg_res.json()['tokens']['access_token']}"}

    res = client.post(
        "/api/v1/auth/change-password",
        headers=headers,
        json={"current_password": "IncorrectPassword123!", "new_password": "NewValidPassword999!"},
    )
    assert res.status_code == 401
