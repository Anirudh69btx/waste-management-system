"""
Integration tests for user registration: POST /api/v1/auth/register.
"""
import uuid
import pytest
from starlette.testclient import TestClient

from app.models import RefreshToken, RewardWallet, User
from sqlalchemy import select


def test_register_success(client: TestClient, override_real_db) -> None:
    """Registering a new GENERATOR returns 201 with user profile and token pair."""
    unique_id = uuid.uuid4().hex[:8]
    email = f"gen_{unique_id}@ecotest.org"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "SecurePassword123!",
            "full_name": "Eco Generator",
            "role": "GENERATOR",
            "organization_name": "Eco Farms Ltd",
            "phone_number": f"+9198765{int(unique_id, 16) % 100000:05d}",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert "user" in data
    assert "tokens" in data
    assert data["user"]["email"] == email.lower()
    assert data["user"]["role"] == "GENERATOR"
    assert data["user"]["is_active"] is True
    assert "tokens" in data
    assert "access_token" in data["tokens"]
    assert "refresh_token" in data["tokens"]
    assert data["tokens"]["token_type"] == "bearer"
    assert data["tokens"]["expires_in"] > 0


def test_register_admin_rejected_at_schema(client: TestClient) -> None:
    """Self-registration with role=ADMIN is rejected with 422."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "hacker@evil.com",
            "password": "Password123!",
            "full_name": "Attacker",
            "role": "ADMIN",
        },
    )
    assert response.status_code == 422
    data = response.json()
    assert "errors" in data or "detail" in data


def test_register_weak_password_rejected(client: TestClient) -> None:
    """Passwords shorter than 8 chars or missing numbers are rejected with 422."""
    # Too short
    res1 = client.post(
        "/api/v1/auth/register",
        json={
            "email": "short@test.com",
            "password": "abc1",
            "full_name": "Short Pw",
            "role": "GENERATOR",
        },
    )
    assert res1.status_code == 422

    # No number
    res2 = client.post(
        "/api/v1/auth/register",
        json={
            "email": "nonum@test.com",
            "password": "onlylettershere!",
            "full_name": "No Number",
            "role": "GENERATOR",
        },
    )
    assert res2.status_code == 422


def test_register_duplicate_email_rejected(client: TestClient, override_real_db) -> None:
    """Registering with an already registered email returns 409 Conflict."""
    unique_id = uuid.uuid4().hex[:8]
    email = f"dup_{unique_id}@test.com"
    payload = {
        "email": email,
        "password": "ValidPassword999!",
        "full_name": "Original User",
        "role": "RECYCLER",
    }
    r1 = client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 201

    r2 = client.post("/api/v1/auth/register", json=payload)
    assert r2.status_code == 409
    data = r2.json()
    assert data.get("title") == "USER_ALREADY_EXISTS" or data.get("status") == 409


def test_register_email_normalization(client: TestClient, override_real_db) -> None:
    """Emails with whitespace or uppercase are normalized lowercase."""
    unique_id = uuid.uuid4().hex[:8]
    raw_email = f"  MixedCase_{unique_id}@TestDomain.COM  "
    expected = f"mixedcase_{unique_id}@testdomain.com"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": raw_email,
            "password": "Password123!",
            "full_name": "Case Normalizer",
            "role": "LOGISTICS",
        },
    )
    assert response.status_code == 201
    assert response.json()["user"]["email"] == expected


def test_register_invalid_phone_rejected(client: TestClient) -> None:
    """Invalid phone number formats return 422."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "phone_test@test.com",
            "password": "Password123!",
            "full_name": "Bad Phone",
            "role": "GENERATOR",
            "phone_number": "not-a-phone-number",
        },
    )
    assert response.status_code == 422
