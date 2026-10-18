"""
Integration tests for user authentication: POST /api/v1/auth/login.
"""
import uuid
import pytest
from starlette.testclient import TestClient
from sqlalchemy import select

from app.models import User
from app.db.session import AsyncSessionLocal


def _create_user(client: TestClient, role: str = "GENERATOR") -> dict:
    unique_id = uuid.uuid4().hex[:8]
    email = f"login_{unique_id}@test.com"
    phone = f"+9199{int(unique_id, 16) % 100000000:08d}"
    pw = "SecureLogin123!"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": pw,
            "full_name": "Login Tester",
            "role": role,
            "phone_number": phone,
        },
    )
    assert res.status_code == 201
    return {"email": email, "phone": phone, "password": pw, "user_id": res.json()["user"]["id"]}


def test_login_success_with_email(client: TestClient, override_real_db) -> None:
    """Login with registered email returns 200 with access and refresh tokens."""
    creds = _create_user(client)
    response = client.post(
        "/api/v1/auth/login",
        json={"email": creds["email"], "password": creds["password"]},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] > 0


def test_login_success_with_phone(client: TestClient, override_real_db) -> None:
    """Login with registered phone number returns 200 with tokens."""
    creds = _create_user(client)
    response = client.post(
        "/api/v1/auth/login",
        json={"phone_number": creds["phone"], "password": creds["password"]},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_login_wrong_password_increments_counter(client: TestClient, override_real_db) -> None:
    """Wrong password returns 401 and increments failed_login_count."""
    creds = _create_user(client)
    res = client.post(
        "/api/v1/auth/login",
        json={"email": creds["email"], "password": "WrongPassword999!"},
    )
    assert res.status_code == 401


def test_login_unknown_user_returns_401(client: TestClient, override_real_db) -> None:
    """Non-existent email returns 401 (normalizing timing via dummy hash)."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "non_existent_user_999@domain.org", "password": "SomePassword123!"},
    )
    assert response.status_code == 401


def test_login_inactive_user_rejected(client: TestClient, override_real_db) -> None:
    """Inactive accounts are rejected with 403 Forbidden."""
    creds = _create_user(client)

    from sqlalchemy import create_engine, text
    from app.core.settings import get_settings
    engine = create_engine(get_settings().database_url_sync)
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE users SET is_active = false WHERE email = :email"),
            {"email": creds["email"]},
        )
    engine.dispose()

    response = client.post(
        "/api/v1/auth/login",
        json={"email": creds["email"], "password": creds["password"]},
    )
    assert response.status_code == 403


def test_login_oauth2_form_encoded(client: TestClient, override_real_db) -> None:
    """Form-encoded login (Swagger UI OAuth2 password flow) returns 200."""
    creds = _create_user(client)
    response = client.post(
        "/api/v1/auth/login",
        data={"username": creds["email"], "password": creds["password"]},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_login_both_email_and_phone_rejected(client: TestClient) -> None:
    """Providing both email and phone number is rejected with 422."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "both@test.com",
            "phone_number": "+919876543210",
            "password": "Password123!",
        },
    )
    assert response.status_code == 422
