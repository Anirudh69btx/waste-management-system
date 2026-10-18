"""
Unit tests for cryptographic security utilities in app.core.security.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.core.security import (
    ExpiredTokenError,
    InvalidTokenError,
    TokenTypeMismatchError,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    dummy_verify_password,
    hash_password,
    hash_token,
    sign_manifest,
    verify_manifest,
    verify_password,
    verify_token_hash,
)
from app.core.settings import get_settings


def test_password_hash_and_verify() -> None:
    """Bcrypt password hashing produces unique salts and verifies correctly."""
    pw = "SuperSecureP@ssw0rd!"
    h1 = hash_password(pw)
    h2 = hash_password(pw)

    assert h1 != h2
    assert verify_password(pw, h1) is True
    assert verify_password(pw, h2) is True
    assert verify_password("WrongPassword123", h1) is False


def test_password_hash_exceeding_72_bytes() -> None:
    """Passwords exceeding 72 bytes are pre-hashed with SHA-256 and verified accurately."""
    long_pw = "A" * 150 + "Secure99!"
    hashed = hash_password(long_pw)

    assert verify_password(long_pw, hashed) is True
    assert verify_password(long_pw + "extra", hashed) is False


def test_access_token_roundtrip() -> None:
    """Access token encodes claims and decodes with valid structure."""
    user_id = str(uuid.uuid4())
    token = create_access_token(
        subject=user_id,
        role="GENERATOR",
        email="gen@test.com",
        is_verified=True,
    )
    payload = decode_access_token(token)

    assert payload["sub"] == user_id
    assert payload["role"] == "GENERATOR"
    assert payload["email"] == "gen@test.com"
    assert payload["is_verified"] is True
    assert payload["type"] == "access"
    assert "jti" in payload
    assert "exp" in payload


def test_refresh_token_roundtrip() -> None:
    """Refresh token signs with REFRESH_TOKEN_SECRET and decodes with type='refresh'."""
    user_id = str(uuid.uuid4())
    token = create_refresh_token(
        subject=user_id,
        role="RECYCLER",
        email="recycle@test.com",
    )
    payload = decode_refresh_token(token)

    assert payload["sub"] == user_id
    assert payload["role"] == "RECYCLER"
    assert payload["type"] == "refresh"
    assert "jti" in payload


def test_token_type_mismatch_rejection() -> None:
    """Access decoder rejects refresh token, and refresh decoder rejects access token."""
    user_id = str(uuid.uuid4())
    access_tok = create_access_token(subject=user_id, role="LOGISTICS", email="l@test.com")
    refresh_tok = create_refresh_token(subject=user_id, role="LOGISTICS", email="l@test.com")

    with pytest.raises(TokenTypeMismatchError):
        decode_access_token(refresh_tok)

    with pytest.raises(TokenTypeMismatchError):
        decode_refresh_token(access_tok)


def test_expired_token_rejection() -> None:
    """Expired tokens raise ExpiredTokenError."""
    from jose import jwt
    settings = get_settings()
    now = datetime.now(timezone.utc)
    expired_payload = {
        "sub": "user-123",
        "role": "ADMIN",
        "type": "access",
        "exp": now - timedelta(minutes=5),
        "iat": now - timedelta(minutes=10),
    }
    expired_token = jwt.encode(expired_payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

    with pytest.raises(ExpiredTokenError):
        decode_access_token(expired_token)


def test_token_hash_verification() -> None:
    """SHA-256 token hashing and timing-safe verification."""
    tok = "random-token-string-xyz"
    th = hash_token(tok)
    assert verify_token_hash(tok, th) is True
    assert verify_token_hash("tampered-token", th) is False


def test_dummy_verify_password_runs() -> None:
    """Dummy verify completes without error."""
    dummy_verify_password()


def test_manifest_signing_and_verification() -> None:
    """QR manifest HMAC-SHA256 signature and constant-time check."""
    payload = "BATCH-001|SUP-99|500.5"
    sig = sign_manifest(payload)
    assert verify_manifest(payload, sig) is True
    assert verify_manifest("BATCH-002|SUP-99|500.5", sig) is False
