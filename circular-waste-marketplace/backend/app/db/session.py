"""
Circular Waste Marketplace — Database Session Factory & Dependencies
=====================================================================
Async SQLAlchemy 2.x session factories, context managers, and FastAPI
dependencies.
"""
from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
)

from app.db.engine import async_engine

# Session factory — expire_on_commit=False prevents lazy loads after commit
async_session_maker: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=async_engine,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

# Backwards compatibility alias
AsyncSessionLocal = async_session_maker


# ---------------------------------------------------------------------------
# FastAPI Dependency
# ---------------------------------------------------------------------------
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Yield an async database session for use in FastAPI route dependencies.

    The session is automatically committed on successful completion and
    rolled back on any exception. Always injected via ``Depends()``.
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# Backwards compatibility alias
get_async_session = get_db


# ---------------------------------------------------------------------------
# Context Manager (for background tasks / CLI scripts / Celery tasks)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def get_db_context() -> AsyncGenerator[AsyncSession, None]:
    """
    Context manager for async sessions outside of request/response cycles.

    Usage::

        async with get_db_context() as db:
            result = await db.execute(...)
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# Alias
async_session_context = get_db_context
