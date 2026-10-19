"""
Circular Waste Marketplace — Security & JWT Utilities
=====================================================
Centralized cryptographic operations:
- Password hashing (bcrypt work factor 12, SHA-256 pre-hash for >72 byte inputs)
- Access token creation & decoding (JWT_SECRET, type='access')
- Refresh token creation & decoding (REFRESH_TOKEN_SECRET, type='refresh')
- Token hash generation & timing-safe verification
- QR code HMAC manifest signing and verification
No secrets leak to routers or logs.
"""
from __future__ import annotations

import hashlib
import hmac
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import ExpiredSignatureError, JWTError, jwt
from passlib.context import CryptContext

from app.core.settings import Settings, get_settings

# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class AuthError(Exception):
    """Base exception for authentication and token validation errors."""


class InvalidTokenError(AuthError):
    """Raised when a token is malformed, has an invalid signature, or is unreadable."""


class ExpiredTokenError(AuthError):
    """Raised when a token has passed its expiration time."""


class TokenTypeMismatchError(AuthError):
    """Raised when a token type (e.g. access vs refresh) does not match expected."""


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
_pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__default_rounds=12,
)


def _preprocess_password(plain: str) -> str:
    """
    Pre-process password to handle bcrypt's 72-byte truncation boundary.
    If input exceeds 72 bytes in UTF-8, pre-hash with SHA-256 hex string.
    """
    raw = plain.encode("utf-8")
    if len(raw) > 72:
        return hashlib.sha256(raw).hexdigest()
    return plain


def hash_password(plain: str) -> str:
    """Hash a plain-text password using bcrypt with work factor 12."""
    processed = _preprocess_password(plain)
    return _pwd_context.hash(processed)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    processed = _preprocess_password(plain)
    return _pwd_context.verify(processed, hashed)


# Precomputed dummy bcrypt hash for timing attack defense on user-not-found
_DUMMY_PASSWORD = "dummy-timing-defense-password-string-vle-auth"
# Static bcrypt hash (work factor 12) for the dummy password to avoid runtime bcrypt backend issues
_DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKc5euJ4R/6lJ8dQf6p2V2cK9cGdGjtVb5fUK"


def dummy_verify_password() -> None:
    """
    Execute a dummy password verification taking ~80ms (bcrypt work factor 12)
    to normalize latency when a user is not found, mitigating timing enumeration.
    """
    _pwd_context.verify(_DUMMY_PASSWORD, _DUMMY_HASH)


# ---------------------------------------------------------------------------
# Token Hashing (for DB storage and rotation replay defense)
# ---------------------------------------------------------------------------


def hash_token(token: str) -> str:
    """Compute SHA-256 hash of a token for database persistence."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def verify_token_hash(token: str, token_hash: str) -> bool:
    """Constant-time verification of a token against its stored hash."""
    return hmac.compare_digest(hash_token(token), token_hash)


# ---------------------------------------------------------------------------
# JWT creation & verification
# ---------------------------------------------------------------------------
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    auto_error=False,
)


def create_access_token(
    subject: str,
    role: str,
    email: str,
    is_verified: bool = False,
    jti: str | None = None,
    settings: Settings | None = None,
) -> str:
    """Create a short-lived JWT access token signed with JWT_SECRET."""
    cfg = settings or get_settings()
    now = datetime.now(tz=timezone.utc)
    expire = now + timedelta(minutes=cfg.access_token_expire_minutes)
    token_jti = jti or uuid.uuid4().hex

    payload: dict[str, Any] = {
        "sub": str(subject),
        "role": str(role),
        "email": str(email),
        "is_verified": bool(is_verified),
        "type": "access",
        "jti": token_jti,
        "exp": expire,
        "iat": now,
    }
    return jwt.encode(payload, cfg.jwt_secret, algorithm=cfg.jwt_algorithm)


def decode_access_token(
    token: str,
    settings: Settings | None = None,
) -> dict[str, Any]:
    """
    Decode and validate a JWT access token.

    Raises:
        ExpiredTokenError: If token expired.
        TokenTypeMismatchError: If token type != 'access'.
        InvalidTokenError: If signature invalid or token malformed.
    """
    cfg = settings or get_settings()
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            cfg.jwt_secret,
            algorithms=[cfg.jwt_algorithm],
        )
    except ExpiredSignatureError as exc:
        raise ExpiredTokenError("Access token has expired") from exc
    except JWTError as exc:
        # Check if token was signed with refresh secret to provide explicit TokenTypeMismatchError
        try:
            alt_payload = jwt.decode(token, cfg.refresh_token_secret, algorithms=[cfg.jwt_algorithm])
            if alt_payload.get("type") != "access":
                raise TokenTypeMismatchError(
                    f"Expected token type 'access', got '{alt_payload.get('type')}'"
                )
        except (ExpiredSignatureError, JWTError):
            pass
        raise InvalidTokenError("Invalid access token") from exc

    token_type = payload.get("type")
    if token_type != "access":
        raise TokenTypeMismatchError(
            f"Expected token type 'access', got '{token_type}'"
        )
    return payload


def create_refresh_token(
    subject: str,
    role: str,
    email: str,
    is_verified: bool = False,
    jti: str | None = None,
    settings: Settings | None = None,
) -> str:
    """Create a long-lived JWT refresh token signed with REFRESH_TOKEN_SECRET."""
    cfg = settings or get_settings()
    now = datetime.now(tz=timezone.utc)
    expire = now + timedelta(days=cfg.refresh_token_expire_days)
    token_jti = jti or uuid.uuid4().hex

    payload: dict[str, Any] = {
        "sub": str(subject),
        "role": str(role),
        "email": str(email),
        "is_verified": bool(is_verified),
        "type": "refresh",
        "jti": token_jti,
        "exp": expire,
        "iat": now,
    }
    return jwt.encode(payload, cfg.refresh_token_secret, algorithm=cfg.jwt_algorithm)


def decode_refresh_token(
    token: str,
    settings: Settings | None = None,
) -> dict[str, Any]:
    """
    Decode and validate a JWT refresh token using REFRESH_TOKEN_SECRET.

    Raises:
        ExpiredTokenError: If token expired.
        TokenTypeMismatchError: If token type != 'refresh'.
        InvalidTokenError: If signature invalid or token malformed.
    """
    cfg = settings or get_settings()
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            cfg.refresh_token_secret,
            algorithms=[cfg.jwt_algorithm],
        )
    except ExpiredSignatureError as exc:
        raise ExpiredTokenError("Refresh token has expired") from exc
    except JWTError as exc:
        # Check if token was signed with access secret to provide explicit TokenTypeMismatchError
        try:
            alt_payload = jwt.decode(token, cfg.jwt_secret, algorithms=[cfg.jwt_algorithm])
            if alt_payload.get("type") != "refresh":
                raise TokenTypeMismatchError(
                    f"Expected token type 'refresh', got '{alt_payload.get('type')}'"
                )
        except (ExpiredSignatureError, JWTError):
            pass
        raise InvalidTokenError("Invalid refresh token") from exc

    token_type = payload.get("type")
    if token_type != "refresh":
        raise TokenTypeMismatchError(
            f"Expected token type 'refresh', got '{token_type}'"
        )
    return payload


# ---------------------------------------------------------------------------
# Backward Compatibility & Typed Wrappers
# ---------------------------------------------------------------------------

_credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials.",
    headers={"WWW-Authenticate": "Bearer"},
)


def decode_token(token: str, settings: Settings | None = None) -> dict[str, Any]:
    """
    Backward-compatible token decoder for access tokens.
    Raises HTTPException 401 on any validation failure.
    """
    try:
        return decode_access_token(token, settings)
    except AuthError as exc:
        raise _credentials_exception from exc


class TokenPayload:
    """Typed wrapper around decoded JWT claims."""

    def __init__(self, raw: dict[str, Any]) -> None:
        self.sub: str = str(raw["sub"])
        self.role: str = str(raw["role"])
        self.email: str = str(raw.get("email", ""))
        self.is_verified: bool = bool(raw.get("is_verified", False))
        self.token_type: str = str(raw.get("type", "access"))
        self.jti: str = str(raw.get("jti", ""))
        self.raw: dict[str, Any] = raw


async def get_current_token_payload(
    token: str | None = Depends(oauth2_scheme),
    settings: Settings = Depends(get_settings),
) -> TokenPayload:
    """Extract and decode the bearer token into a typed TokenPayload."""
    if not token:
        raise _credentials_exception
    try:
        raw = decode_access_token(token, settings)
        return TokenPayload(raw)
    except AuthError as exc:
        raise _credentials_exception from exc


def require_role(allowed_roles: list[str]):  # noqa: ANN201
    """
    FastAPI dependency factory for role-based access control on TokenPayload.
    ADMIN implicitly satisfies any role constraint.
    """
    async def role_checker(
        payload: TokenPayload = Depends(get_current_token_payload),
    ) -> TokenPayload:
        if payload.role != "ADMIN" and payload.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required roles: {allowed_roles}",
            )
        return payload

    return role_checker


def require_verified(
    payload: TokenPayload = Depends(get_current_token_payload),
) -> TokenPayload:
    """Dependency that additionally requires the account to be KYC-verified."""
    if not payload.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account verification required before performing this action.",
        )
    return payload


# ---------------------------------------------------------------------------
# HMAC signing utilities (QR code manifests)
# ---------------------------------------------------------------------------


def sign_manifest(data: str, settings: Settings | None = None) -> str:
    """
    Compute HMAC-SHA256 signature for a QR code manifest payload string.

    Args:
        data: Canonical string to sign (e.g. f"{batch_code}|{supplier_id}|{weight}")

    Returns:
        Hex-encoded HMAC-SHA256 signature.
    """
    cfg = settings or get_settings()
    return hmac.new(
        cfg.hmac_secret_key.encode("utf-8"),
        data.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_manifest(data: str, signature: str, settings: Settings | None = None) -> bool:
    """Constant-time HMAC verification to prevent timing attacks."""
    expected = sign_manifest(data, settings)
    return hmac.compare_digest(expected, signature)
