"""
Circular Waste Marketplace — Database Async Engine
===================================================
Configures the async SQLAlchemy 2.x engine with connection pooling
and health checks.
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from app.core.settings import get_settings

_settings = get_settings()

async_engine: AsyncEngine = create_async_engine(
    _settings.database_url,
    pool_size=_settings.db_pool_size,
    max_overflow=_settings.db_max_overflow,
    pool_recycle=_settings.db_pool_recycle_seconds,
    pool_pre_ping=True,          # Detect stale connections before checkout
    echo=_settings.app_debug,    # Log SQL in debug mode only
    future=True,
)

# Standard alias
engine = async_engine
