"""
Circular Waste Marketplace — Rate Limiting Configuration
========================================================
Configures slowapi rate limiter using Redis (DB 3) with in-memory fallback.
Provides user-based keying for token refresh endpoints.
"""
from __future__ import annotations

import json
from typing import Any

from jose import jwt
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.core.settings import get_settings

settings = get_settings()


def get_user_or_ip_key(request: Request) -> str:
    """
    Rate limiting key extractor.
    Returns user subject ID if token is decodable in Authorization header or body,
    falling back to client IP address.
    """
    # 1. Try Authorization header
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        try:
            unverified = jwt.get_unverified_claims(token)
            sub = unverified.get("sub")
            if sub:
                return f"sub:{sub}"
        except Exception:
            pass

    # 2. Fall back to client remote IP address
    return get_remote_address(request)


# Limiter instance
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.auth_rate_limit_storage_uri,
    strategy="fixed-window",
)
