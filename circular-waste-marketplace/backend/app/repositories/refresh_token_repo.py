"""
Circular Waste Marketplace — Refresh Token Repository
=====================================================
Data access layer for RefreshToken entity with rotation tracking,
revocation, and replay attack prevention.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional, Sequence

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import RefreshToken


class RefreshTokenRepository:
    """Repository managing RefreshToken persistence, revocation, and cleanup."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create(self, token: RefreshToken) -> RefreshToken:
        """Add and flush a new RefreshToken record."""
        self._db.add(token)
        await self._db.flush()
        return token

    async def get_by_jti(self, jti: str) -> Optional[RefreshToken]:
        """Look up a refresh token record by its unique JWT ID (jti)."""
        result = await self._db.execute(
            select(RefreshToken).where(RefreshToken.jti == jti)
        )
        return result.scalar_one_or_none()

    async def revoke(
        self,
        token: RefreshToken,
        replaced_by_jti: str | None = None,
    ) -> None:
        """Mark a refresh token as revoked, recording revocation time and replacement jti."""
        token.revoked_at = datetime.now(tz=timezone.utc)
        if replaced_by_jti is not None:
            token.replaced_by_jti = replaced_by_jti
        await self._db.flush()

    async def revoke_all_for_user(self, user_id: uuid.UUID | str) -> int:
        """
        Revoke all active refresh tokens belonging to a user.
        Used on password change or replay-attack detection.
        """
        if isinstance(user_id, str):
            user_id = uuid.UUID(user_id)

        now = datetime.now(tz=timezone.utc)
        stmt = (
            update(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=now)
        )
        result = await self._db.execute(stmt)
        await self._db.flush()
        return result.rowcount

    async def list_active_for_user(
        self,
        user_id: uuid.UUID | str,
    ) -> Sequence[RefreshToken]:
        """Return all non-revoked, non-expired tokens for a user."""
        if isinstance(user_id, str):
            user_id = uuid.UUID(user_id)

        now = datetime.now(tz=timezone.utc)
        result = await self._db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > now,
            )
        )
        return result.scalars().all()

    async def delete_expired(self) -> int:
        """
        Delete expired or revoked tokens from the database.
        Pruning utility to be scheduled in periodic background maintenance.
        """
        now = datetime.now(tz=timezone.utc)
        stmt = delete(RefreshToken).where(
            (RefreshToken.expires_at <= now) | (RefreshToken.revoked_at.is_not(None))
        )
        result = await self._db.execute(stmt)
        await self._db.flush()
        return result.rowcount
