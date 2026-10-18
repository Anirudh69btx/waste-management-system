"""
Circular Waste Marketplace — Health & Readiness Routers
=======================================================
/health  — liveness & DB probe (proves process alive + DB reachable with latency)
/ready   — readiness probe (verifies DB, migrations applied via alembic_version, Redis, storage)
"""
from __future__ import annotations

import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import Settings, get_settings
from app.db.session import get_db
from app.schemas import HealthResponse, ReadinessResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Liveness and DB health probe",
    description="Proves process is alive and database is reachable. Returns 200 on success, 503 on DB error.",
    responses={
        200: {"description": "Service is healthy and database is reachable."},
        503: {"description": "Service is unhealthy or database is unreachable."},
    },
)
async def health_check(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> JSONResponse:
    start_time = time.perf_counter()
    db_status = "ok"
    latency_ms: float | None = None
    http_status = status.HTTP_200_OK

    try:
        await db.execute(text("SELECT 1"))
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
    except Exception:
        db_status = "unreachable"
        http_status = status.HTTP_503_SERVICE_UNAVAILABLE

    body = {
        "status": "ok" if db_status == "ok" else "degraded",
        "version": "1.0.0",
        "environment": settings.app_env,
        "database": db_status,
        "latency_ms": latency_ms,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return JSONResponse(status_code=http_status, content=body)


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    summary="Readiness probe",
    description="Verifies database, migrations, and Redis connectivity before serving traffic.",
    responses={
        200: {"description": "Service is ready to accept traffic."},
        503: {"description": "Service dependencies are not ready."},
    },
)
async def readiness_check(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> JSONResponse:
    import redis.asyncio as aioredis

    # 1. Check database connectivity & migration state
    db_status = "ok"
    migration_status = "applied"
    alembic_version: str | None = None

    try:
        res = await db.execute(text("SELECT version_num FROM alembic_version LIMIT 1"))
        row = res.scalar_one_or_none()
        if row:
            alembic_version = str(row)
        else:
            migration_status = "missing_head"
    except Exception:
        db_status = "unreachable"
        migration_status = "error"

    # 2. Check Redis connectivity
    redis_status = "ok"
    try:
        r = aioredis.from_url(settings.redis_url, socket_connect_timeout=2)
        await r.ping()
        await r.aclose()
    except Exception:
        redis_status = "unreachable"

    # 3. Check storage
    storage_status = "ok"
    if settings.storage_backend == "local":
        import os
        if not os.path.isdir(settings.local_upload_dir):
            storage_status = "directory_missing"

    is_ready = (db_status == "ok" and migration_status == "applied")
    http_status = status.HTTP_200_OK if is_ready else status.HTTP_503_SERVICE_UNAVAILABLE

    body = {
        "status": "ready" if is_ready else "degraded",
        "database": db_status,
        "redis": redis_status,
        "storage": storage_status,
        "migrations": migration_status,
        "alembic_version": alembic_version,
    }
    return JSONResponse(status_code=http_status, content=body)
