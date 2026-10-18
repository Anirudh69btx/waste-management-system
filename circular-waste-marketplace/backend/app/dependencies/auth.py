"""
Circular Waste Marketplace — RBAC & Authentication Dependencies
================================================================
FastAPI dependencies providing DB-backed user authentication,
role-based access control (RBAC), and session verification.
"""
from __future__ import annotations

import uuid
from typing import Callable, Sequence

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    AuthError,
    ExpiredTokenError,
    InvalidTokenError,
    TokenTypeMismatchError,
    decode_access_token,
)
from app.core.settings import Settings, get_settings
from app.db.session import get_async_session
from app.models import User
from app.repositories.user_repo import UserRepository

http_bearer = HTTPBearer(auto_error=False)


async def get_bearer_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(http_bearer),
) -> str:
    """
    Extract raw bearer token string from Authorization header.

    Raises:
        HTTPException 401: If header missing or not Bearer scheme.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials


async def get_current_user(
    token: str = Depends(get_bearer_token),
    db: AsyncSession = Depends(get_async_session),
    settings: Settings = Depends(get_settings),
) -> User:
    """
    Decode access token, load user from DB, and verify token claim consistency.
    Rejects request if the role claim in token differs from the user's current DB role.

    Raises:
        HTTPException 401: On invalid token, expired token, type mismatch,
                           missing user, or role claim divergence.
    """
    try:
        payload = decode_access_token(token, settings)
    except ExpiredTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except TokenTypeMismatchError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type: expected access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (InvalidTokenError, AuthError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await UserRepository(db).get_by_id(sub)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify claim consistency: token role claim must match DB role
    token_role = str(payload.get("role", "")).upper()
    db_role = (user.role.value if hasattr(user.role, "value") else str(user.role)).upper()
    if token_role != db_role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token claims do not match current account status. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_active_user(
    user: User = Depends(get_current_user),
) -> User:
    """
    Ensure the authenticated user is marked active.

    Raises:
        HTTPException 403: If account is deactivated.
    """
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )
    return user


def require_roles(*roles: str) -> Callable:
    """
    RBAC dependency factory.
    Authorizes request if user's role is in the allowed list, OR if user is ADMIN.
    ADMIN implicitly satisfies any role check.

    Usage:
        @router.get("/admin-only")
        async def admin_view(user: User = Depends(require_roles("ADMIN"))):
            ...
    """
    allowed_roles = {r.strip().upper() for r in roles}

    async def role_checker(
        user: User = Depends(get_current_active_user),
    ) -> User:
        user_role = (user.role.value if hasattr(user.role, "value") else str(user.role)).upper()
        if user_role == "ADMIN" or user_role in allowed_roles:
            return user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Operation not permitted. Required roles: {sorted(list(allowed_roles))}",
        )

    return role_checker


# Convenient Role Aliases
require_admin = require_roles("ADMIN")
require_generator = require_roles("GENERATOR")
require_recycler = require_roles("RECYCLER")
require_logistics = require_roles("LOGISTICS")
require_any_authenticated = get_current_active_user
