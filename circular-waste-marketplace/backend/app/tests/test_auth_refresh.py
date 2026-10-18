"""
Integration tests for token refresh and rotation: POST /api/v1/auth/refresh.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt
from starlette.testclient import TestClient

from app.core.security import create_access_token, create_refresh_token
from app.core.settings import get_settings
from app.db.session import AsyncSessionLocal
from app.models import RefreshToken, User
from sqlalchemy import select


def _register_and_get_tokens(client: TestClient) -> dict:
    unique_id = uuid.uuid4().hex[:8]
    email = f"refresh_{unique_id}@test.com"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "SecurePassword123!",
            "full_name": "Rotation Tester",
            "role": "RECYCLER",
        },
    )
    assert res.status_code == 201
    return res.json()["tokens"]


def test_refresh_rotation_success(client: TestClient, override_real_db) -> None:
    """Valid refresh token issues a new token pair and revokes the old one."""
    tokens = _register_and_get_tokens(client)
    old_refresh = tokens["refresh_token"]

    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": old_refresh},
    )
    assert response.status_code == 200
    new_tokens = response.json()
    assert "access_token" in new_tokens
    assert "refresh_token" in new_tokens
    assert new_tokens["refresh_token"] != old_refresh


def test_refresh_replay_defense_revokes_all_sessions(client: TestClient, override_real_db) -> None:
    """
    Replaying a previously rotated refresh token triggers replay defense:
    returns 401 and invalidates all active sessions for that user.
    """
    tokens = _register_and_get_tokens(client)
    first_refresh = tokens["refresh_token"]

    # 1. Normal rotation (first_refresh -> second_refresh)
    res1 = client.post("/api/v1/auth/refresh", json={"refresh_token": first_refresh})
    assert res1.status_code == 200
    second_refresh = res1.json()["refresh_token"]

    # 2. Replay attack: present first_refresh again!
    res_replay = client.post("/api/v1/auth/refresh", json={"refresh_token": first_refresh})
    assert res_replay.status_code == 401

    # 3. Verify that the valid second_refresh is now ALSO revoked due to replay defense!
    res_subsequent = client.post("/api/v1/auth/refresh", json={"refresh_token": second_refresh})
    assert res_subsequent.status_code == 401


def test_refresh_expired_token_rejected(client: TestClient) -> None:
    """An expired refresh token is rejected with 401."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expired_payload = {
        "sub": str(uuid.uuid4()),
        "role": "LOGISTICS",
        "type": "refresh",
        "jti": uuid.uuid4().hex,
        "exp": now - timedelta(days=1),
        "iat": now - timedelta(days=2),
    }
    tok = jwt.encode(expired_payload, settings.refresh_token_secret, algorithm=settings.jwt_algorithm)

    response = client.post("/api/v1/auth/refresh", json={"refresh_token": tok})
    assert response.status_code == 401


def test_refresh_forged_signature_rejected(client: TestClient) -> None:
    """A forged token signed with wrong secret is rejected with 401."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(uuid.uuid4()),
        "role": "GENERATOR",
        "type": "refresh",
        "jti": uuid.uuid4().hex,
        "exp": now + timedelta(days=7),
    }
    forged = jwt.encode(payload, "wrong-secret-key-that-does-not-match-at-all", algorithm=settings.jwt_algorithm)

    response = client.post("/api/v1/auth/refresh", json={"refresh_token": forged})
    assert response.status_code == 401


def test_refresh_with_access_token_rejected(client: TestClient, override_real_db) -> None:
    """Passing an access token to /refresh returns 401 (type mismatch)."""
    tokens = _register_and_get_tokens(client)
    access_tok = tokens["access_token"]

    response = client.post("/api/v1/auth/refresh", json={"refresh_token": access_tok})
    assert response.status_code == 401


def test_refresh_inactive_user_rejected(client: TestClient, override_real_db) -> None:
    """If user is deactivated after token issue, refresh is rejected with 403."""
    unique_id = uuid.uuid4().hex[:8]
    email = f"deact_{unique_id}@test.com"
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "full_name": "Deact User", "role": "GENERATOR"},
    )
    tokens = res.json()["tokens"]

    # Deactivate user
    from sqlalchemy import create_engine, text
    from app.core.settings import get_settings
    engine = create_engine(get_settings().database_url_sync)
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE users SET is_active = false WHERE email = :email"),
            {"email": email},
        )
    engine.dispose()

    refresh_res = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refresh_res.status_code in [401, 403]
