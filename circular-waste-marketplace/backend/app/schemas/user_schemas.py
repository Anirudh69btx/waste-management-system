"""Re-export user schemas from app.schemas.auth for compatibility."""
from __future__ import annotations

from app.schemas.auth import (
    UserLoginRequest,
    UserReadResponse,
    UserRegisterRequest,
    UserResponse,
    UserUpdateRequest,
)

__all__ = [
    "UserLoginRequest",
    "UserReadResponse",
    "UserRegisterRequest",
    "UserResponse",
    "UserUpdateRequest",
]
