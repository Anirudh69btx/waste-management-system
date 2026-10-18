"""
Circular Waste Marketplace — User Repository
============================================
Data access layer for User entity with case-insensitive email matching,
phone lookup, and login attempt audit tracking.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User


class UserRepository:
    """Repository managing User database persistence and queries."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_id(self, user_id: uuid.UUID | str) -> Optional[User]:
        """Look up user by primary key UUID."""
        if isinstance(user_id, str):
            try:
                user_id = uuid.UUID(user_id)
            except ValueError:
                return None
        result = await self._db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        """Look up user by normalized lowercase email."""
        clean_email = email.strip().lower()
        result = await self._db.execute(
            select(User).where(func.lower(User.email) == clean_email)
        )
        return result.scalar_one_or_none()

    async def get_by_phone(self, phone: str) -> Optional[User]:
        """Look up user by phone number."""
        clean_phone = phone.strip()
        result = await self._db.execute(
            select(User).where(User.phone_number == clean_phone)
        )
        return result.scalar_one_or_none()

    async def create(self, user: User) -> User:
        """Add and flush a new User record."""
        self._db.add(user)
        await self._db.flush()
        return user

    async def update(self, user: User, **kwargs: Any) -> User:
        """Update fields on a User and flush."""
        for key, value in kwargs.items():
            if hasattr(user, key):
                setattr(user, key, value)
        await self._db.flush()
        return user

    async def touch_last_login(self, user: User) -> None:
        """Update last_login_at timestamp and reset failed_login_count to 0."""
        user.last_login_at = datetime.now(tz=timezone.utc)
        user.failed_login_count = 0
        await self._db.flush()

    async def increment_failed_login(self, user: User) -> int:
        """Increment failed login attempts counter."""
        user.failed_login_count = (user.failed_login_count or 0) + 1
        await self._db.flush()
        return user.failed_login_count

    async def reset_failed_login(self, user: User) -> None:
        """Reset failed login count to zero."""
        user.failed_login_count = 0
        await self._db.flush()
