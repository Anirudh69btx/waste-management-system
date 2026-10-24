"""
Circular Waste & Resource Marketplace — FastAPI Application Entry Point
========================================================================
Main ASGI application factory. Wires middleware, routers, lifespan events,
structured logging, exception handlers, and observability.
"""
from __future__ import annotations

import time
import uuid
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from sqlalchemy import text
import structlog

from app.core.logging import (
    configure_logging,
    get_logger,
    request_id_var,
)
from app.core.settings import get_settings
from app.db.engine import async_engine
from app.schemas import ProblemDetail
from app.core.limiter import limiter
from slowapi.errors import RateLimitExceeded
from app.services.exceptions import ServiceError


from app.routers import (
    auth,
    suppliers,
    intake,
    pickup,
    weight_ticket,
    tracking,
    sorting,
    marketplace,
    pricing,
    payments,
    rewards,
    eco_store,
    analytics,
    ai_assessment,
    health,
)

settings = get_settings()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
configure_logging(log_level=settings.log_level, log_format=settings.log_format)
logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Sentry (optional — skipped when DSN is empty)
# ---------------------------------------------------------------------------
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        integrations=[
            StarletteIntegration(transaction_style="url"),
            FastApiIntegration(transaction_style="url"),
        ],
        send_default_pii=False,  # Never send PII to Sentry
    )
    logger.info("sentry_initialized", dsn_set=True)


# ---------------------------------------------------------------------------
# Application Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup and shutdown events with database connectivity assertion."""
    logger.info(
        "startup",
        app_name=settings.app_name,
        environment=settings.app_env,
        version="1.0.0",
    )
    # Check DB connectivity at startup
    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("database_connected", status="ok")
    except Exception as exc:
        if settings.is_production:
            logger.error("database_connection_failed_at_startup", error=str(exc))
            raise
        else:
            logger.warning("database_connection_failed_at_startup", error=str(exc))

    yield

    logger.info("shutdown")
    # Gracefully dispose of connection pool
    await async_engine.dispose()


# ---------------------------------------------------------------------------
# Prometheus (graceful import if optional dependency)
# ---------------------------------------------------------------------------
try:
    from prometheus_fastapi_instrumentator import Instrumentator
    HAS_PROMETHEUS = True
except ImportError:
    HAS_PROMETHEUS = False
    Instrumentator = None


# ---------------------------------------------------------------------------
# Application Factory
# ---------------------------------------------------------------------------
def create_application() -> FastAPI:
    docs_url = None if settings.is_production else "/docs"
    redoc_url = None if settings.is_production else "/redoc"
    openapi_url = None if settings.is_production else "/openapi.json"

    app = FastAPI(
        title=settings.app_name,
        description=(
            "Production-grade Circular Waste & Resource Marketplace API. "
            "Enables AI-powered waste classification, dynamic pricing, "
            "live tracking, payments, and green rewards."
        ),
        version="1.0.0",
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url=openapi_url,
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    # ── Request-ID Middleware ─────────────────────────────────────────────
    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):  # type: ignore[return]
        rid = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        token = request_id_var.set(rid)
        structlog.contextvars.bind_contextvars(request_id=rid)
        try:
            start = time.perf_counter()
            response = await call_next(request)
            elapsed_ms = (time.perf_counter() - start) * 1000
            response.headers["X-Request-ID"] = rid
            logger.info(
                "http_request",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=round(elapsed_ms, 2),
            )
            return response
        finally:
            structlog.contextvars.unbind_contextvars("request_id")
            request_id_var.reset(token)

    # ── Prometheus Metrics ────────────────────────────────────────────────
    if settings.prometheus_enabled and HAS_PROMETHEUS and Instrumentator is not None:
        Instrumentator(
            should_group_status_codes=True,
            should_ignore_untemplated=True,
            excluded_handlers=["/health", "/ready", "/metrics"],
        ).instrument(app).expose(app, endpoint="/metrics")

    # ── Rate Limiting State ────────────────────────────────────────────────
    app.state.limiter = limiter

    # ── Global Exception Handlers ─────────────────────────────────────────
    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
        rid = request_id_var.get() or str(uuid.uuid4())
        problem = ProblemDetail(
            type="https://errors.vle-marketplace.com/rate-limit-exceeded",
            title="Rate Limit Exceeded",
            status=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded: {exc.detail}. Please slow down.",
            instance=str(request.url),
            request_id=rid,
        )
        response = JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content=problem.model_dump(),
            media_type="application/problem+json",
        )
        response.headers["Retry-After"] = "60"
        response.headers["X-Request-ID"] = rid
        return response

    @app.exception_handler(ServiceError)
    async def service_error_handler(request: Request, exc: ServiceError) -> JSONResponse:
        rid = request_id_var.get() or str(uuid.uuid4())
        problem = ProblemDetail(
            type=f"https://errors.vle-marketplace.com/{exc.error_code.lower().replace('_', '-')}",
            title=exc.error_code,
            status=exc.status_code,
            detail=exc.message,
            instance=str(request.url),
            request_id=rid,
        )
        response = JSONResponse(
            status_code=exc.status_code,
            content=problem.model_dump(),
            media_type="application/problem+json",
        )
        response.headers["X-Request-ID"] = rid
        return response

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        rid = request_id_var.get() or str(uuid.uuid4())
        logger.error("unhandled_exception", exc_type=type(exc).__name__, exc=str(exc), request_id=rid)
        detail = "An unexpected error occurred. Please try again later."
        if settings.app_debug:
            detail = f"{type(exc).__name__}: {str(exc)}"
        problem = ProblemDetail(
            title="Internal Server Error",
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
            instance=str(request.url),
            request_id=rid,
        )
        response = JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=problem.model_dump(),
            media_type="application/problem+json",
        )
        response.headers["X-Request-ID"] = rid
        return response

    from fastapi.encoders import jsonable_encoder
    from fastapi.exceptions import RequestValidationError

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        rid = request_id_var.get() or str(uuid.uuid4())
        problem = ProblemDetail(
            title="Validation Error",
            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="One or more fields failed validation.",
            instance=str(request.url),
            request_id=rid,
            errors=jsonable_encoder(exc.errors()),
        )
        response = JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=problem.model_dump(),
            media_type="application/problem+json",
        )
        response.headers["X-Request-ID"] = rid
        return response

    from pydantic import ValidationError

    @app.exception_handler(ValidationError)
    async def pydantic_validation_handler(request: Request, exc: ValidationError) -> JSONResponse:
        return await validation_exception_handler(request, RequestValidationError(exc.errors()))

    from fastapi import HTTPException as FastAPIHTTPException

    @app.exception_handler(FastAPIHTTPException)
    async def http_exception_handler(
        request: Request, exc: FastAPIHTTPException
    ) -> JSONResponse:
        rid = request_id_var.get() or str(uuid.uuid4())
        problem = ProblemDetail(
            title="HTTP Error",
            status=exc.status_code,
            detail=exc.detail,
            instance=str(request.url),
            request_id=rid,
        )
        response = JSONResponse(
            status_code=exc.status_code,
            content=problem.model_dump(),
            media_type="application/problem+json",
        )
        response.headers["X-Request-ID"] = rid
        return response

    # ── Routers ───────────────────────────────────────────────────────────
    prefix = settings.api_v1_prefix

    # ── Root Ping ─────────────────────────────────────────────────────────
    @app.get("/", tags=["Root"], summary="Root service ping")
    async def root_ping() -> dict[str, str]:
        return {
            "name": settings.app_name,
            "version": "1.0.0",
            "environment": settings.app_env,
            "docs": "/docs",
            "health": "/health",
        }

    app.include_router(health.router)                       # /health, /ready
    app.include_router(auth.router, prefix=prefix)          # /api/v1/auth/...
    app.include_router(suppliers.router, prefix=prefix)     # /api/v1/suppliers/...
    app.include_router(intake.router, prefix=prefix)        # /api/v1/intake/...
    app.include_router(pickup.router, prefix=prefix)        # /api/v1/pickups/...
    app.include_router(weight_ticket.router, prefix=prefix) # /api/v1/weight-tickets/...
    app.include_router(tracking.router, prefix=prefix)      # /api/v1/tracking/...
    app.include_router(sorting.router, prefix=prefix)       # /api/v1/sorting/...
    app.include_router(marketplace.router, prefix=prefix)   # /api/v1/marketplace/...
    app.include_router(pricing.router, prefix=prefix)       # /api/v1/pricing/...
    app.include_router(payments.router, prefix=prefix)      # /api/v1/payments/...
    app.include_router(rewards.router, prefix=prefix)       # /api/v1/rewards/...
    app.include_router(eco_store.router, prefix=prefix)     # /api/v1/eco-store/...
    app.include_router(analytics.router, prefix=prefix)     # /api/v1/dashboards/..., /api/v1/metrics/...
    app.include_router(ai_assessment.router, prefix=prefix) # /api/v1/ai/...

    return app


app = create_application()
