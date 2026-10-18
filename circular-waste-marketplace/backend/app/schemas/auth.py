"""
Circular Waste Marketplace — Auth & User Schemas
=================================================
Pydantic v2 models for registration, login, token refresh, user profile,
and password change operations.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class _BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ---------------------------------------------------------------------------
# Password Validation Helper
# ---------------------------------------------------------------------------


def _validate_password_complexity(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if not re.search(r"[A-Za-z]", v):
        raise ValueError("Password must contain at least one letter.")
    if not re.search(r"\d", v):
        raise ValueError("Password must contain at least one numeric digit.")
    return v


def _validate_e164_phone(v: str | None) -> str | None:
    if v is not None and v.strip():
        cleaned = v.strip()
        if not re.match(r"^\+?[1-9]\d{6,14}$", cleaned):
            raise ValueError("Phone number must be a valid E.164 format (e.g. +1234567890).")
        return cleaned
    return None


# ---------------------------------------------------------------------------
# User Registration
# ---------------------------------------------------------------------------


class UserRegisterRequest(_BaseSchema):
    """Request body for POST /api/v1/auth/register."""

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=120)
    role: str = Field(..., description="Role must be GENERATOR, RECYCLER, or LOGISTICS")
    organization_name: Optional[str] = Field(None, max_length=255)
    phone_number: Optional[str] = Field(None, max_length=30)

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return _validate_password_complexity(v)

    @field_validator("role")
    @classmethod
    def check_role(cls, v: str) -> str:
        role_upper = v.strip().upper()
        if role_upper == "ADMIN":
            raise ValueError("Self-registration for the ADMIN role is strictly forbidden.")
        if role_upper not in {"GENERATOR", "RECYCLER", "LOGISTICS"}:
            raise ValueError(
                f"Invalid role '{v}'. Allowed self-registration roles: GENERATOR, RECYCLER, LOGISTICS."
            )
        return role_upper

    @field_validator("phone_number")
    @classmethod
    def check_phone(cls, v: str | None) -> str | None:
        return _validate_e164_phone(v)


# ---------------------------------------------------------------------------
# User Login
# ---------------------------------------------------------------------------


class UserLoginRequest(_BaseSchema):
    """
    Request body for POST /api/v1/auth/login.
    Accepts either email or phone_number, exactly one.
    """

    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    password: str = Field(..., min_length=1)

    @field_validator("phone_number")
    @classmethod
    def check_phone(cls, v: str | None) -> str | None:
        return _validate_e164_phone(v)

    @model_validator(mode="after")
    def validate_identifier(self) -> "UserLoginRequest":
        has_email = bool(self.email)
        has_phone = bool(self.phone_number and self.phone_number.strip())
        if not has_email and not has_phone:
            raise ValueError("Either 'email' or 'phone_number' must be provided.")
        if has_email and has_phone:
            raise ValueError("Provide either 'email' or 'phone_number', not both.")
        return self


# ---------------------------------------------------------------------------
# Token Responses & Requests
# ---------------------------------------------------------------------------


class TokenPairResponse(_BaseSchema):
    """Response containing access and refresh token pair."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # Seconds until access token expires


class AccessTokenResponse(_BaseSchema):
    """Response containing only an access token."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(_BaseSchema):
    """Request body for POST /api/v1/auth/refresh."""

    refresh_token: str


# Alias for backward compatibility
RefreshTokenRequest = RefreshRequest
TokenResponse = TokenPairResponse


# ---------------------------------------------------------------------------
# User Profile Responses & Requests
# ---------------------------------------------------------------------------


class UserReadResponse(_BaseSchema):
    """Safe public representation of user profile (never exposes credentials)."""

    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: str
    organization_name: Optional[str] = None
    phone_number: Optional[str] = None
    is_active: bool
    is_verified: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime


# Alias for backward compatibility
UserResponse = UserReadResponse


class RegisterResponse(_BaseSchema):
    """
    Additive response for POST /api/v1/auth/register returning
    both the newly created user profile and the initial token pair.
    """

    user: UserReadResponse
    tokens: TokenPairResponse


class UserUpdateRequest(_BaseSchema):
    """Request body for PATCH /api/v1/auth/me."""

    full_name: Optional[str] = Field(None, min_length=2, max_length=120)
    organization_name: Optional[str] = Field(None, max_length=255)
    phone_number: Optional[str] = Field(None, max_length=30)

    @field_validator("phone_number")
    @classmethod
    def check_phone(cls, v: str | None) -> str | None:
        return _validate_e164_phone(v)


class ChangePasswordRequest(_BaseSchema):
    """Request body for POST /api/v1/auth/change-password."""

    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def check_new_password(cls, v: str) -> str:
        return _validate_password_complexity(v)
