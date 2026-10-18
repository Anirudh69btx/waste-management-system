"""
Tests for Segment 1.2 — FastAPI + PostgreSQL Foundation Infrastructure
=====================================================================
Covers:
- /health ok + degraded (503 when DB fails)
- /ready ok + 503
- / root metadata
- CORS allowed vs blocked
- X-Request-ID middleware
- Settings fail-fast in production
- Settings wildcard CORS rejection
- DB session commit/rollback lifecycle
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from starlette.testclient import TestClient

from app.core.settings import Settings
from app.db.session import get_db
from app.main import app


def test_root_metadata_shape(client: TestClient) -> None:
    """GET / must return application metadata JSON."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "name" in data
    assert "version" in data
    assert "environment" in data
    assert data["docs"] == "/docs"
    assert data["health"] == "/health"


def test_health_check_ok(client: TestClient) -> None:
    """GET /health must return 200 OK with database=ok and latency_ms."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["ok", "healthy"]
    assert data["database"] == "ok"
    assert "version" in data
    assert "timestamp" in data


def test_health_check_degraded_when_db_fails(client: TestClient) -> None:
    """GET /health must return 503 when database query fails."""
    class FailingDbSession:
        async def execute(self, stmt):
            raise ConnectionError("DB offline")
        async def commit(self): pass
        async def rollback(self): pass

    async def override_failing_db():
        yield FailingDbSession()

    app.dependency_overrides[get_db] = override_failing_db
    try:
        response = client.get("/health")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "degraded"
        assert data["database"] == "unreachable"
    finally:
        from app.tests.conftest import override_get_async_session
        app.dependency_overrides[get_db] = override_get_async_session


def test_ready_check_ok(client: TestClient) -> None:
    """GET /ready must return 200 OK when DB and migrations are ready."""
    response = client.get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["database"] == "ok"
    assert data["migrations"] == "applied"


def test_ready_check_503_when_db_fails(client: TestClient) -> None:
    """GET /ready must return 503 when DB fails."""
    class FailingDbSession:
        async def execute(self, stmt):
            raise ConnectionError("DB offline")
        async def commit(self): pass
        async def rollback(self): pass

    async def override_failing_db():
        yield FailingDbSession()

    app.dependency_overrides[get_db] = override_failing_db
    try:
        response = client.get("/ready")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "degraded"
        assert data["database"] == "unreachable"
    finally:
        from app.tests.conftest import override_get_async_session
        app.dependency_overrides[get_db] = override_get_async_session


def test_cors_allowed_origin(client: TestClient) -> None:
    """Allowed origin receives Access-Control-Allow-Origin header."""
    response = client.get(
        "/health",
        headers={"Origin": "http://localhost:5173"},
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_blocked_origin(client: TestClient) -> None:
    """Disallowed origin does NOT receive Access-Control-Allow-Origin header."""
    response = client.get(
        "/health",
        headers={"Origin": "http://malicious-site.com"},
    )
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


def test_request_id_generated_and_returned(client: TestClient) -> None:
    """Responses contain X-Request-ID header."""
    response = client.get("/health")
    assert "x-request-id" in response.headers
    assert len(response.headers["x-request-id"]) > 0


def test_request_id_preserved_when_passed(client: TestClient) -> None:
    """Inbound X-Request-ID header is echoed back on response."""
    test_rid = "custom-trace-uuid-12345"
    response = client.get("/health", headers={"X-Request-ID": test_rid})
    assert response.headers.get("x-request-id") == test_rid


def test_settings_fail_fast_in_production_with_default_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    """Settings raises ValueError when APP_ENV=production and JWT_SECRET is default."""
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.delenv("SECRET_KEY", raising=False)
    with pytest.raises(ValueError, match="JWT_SECRET / SECRET_KEY must be changed"):
        Settings(
            _env_file=None,
            app_env="production",
            secret_key="change-me-64-character-dev-key-change-me-64-character-dev-key-change",
            hmac_secret_key="some-secure-non-default-hmac-key-value-1234567890",
            allowed_origins=["http://localhost:5173"],
        )


def test_settings_fail_fast_in_production_with_default_hmac(monkeypatch: pytest.MonkeyPatch) -> None:
    """Settings raises ValueError when APP_ENV=production and HMAC_SECRET_KEY is default."""
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.delenv("REFRESH_TOKEN_SECRET", raising=False)
    monkeypatch.delenv("HMAC_SECRET_KEY", raising=False)
    with pytest.raises(ValueError, match="HMAC_SECRET_KEY must be changed"):
        Settings(
            _env_file=None,
            app_env="production",
            secret_key="some-secure-non-default-secret-key-value-1234567890",
            refresh_token_secret="some-secure-non-default-refresh-secret-1234567890",
            hmac_secret_key="change-me-64-character-hmac-key-change-me-64-character-hmac-key-ch",
            allowed_origins=["http://localhost:5173"],
        )


def test_settings_wildcard_cors_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    """Settings raises ValueError when CORS contains wildcard '*' with credentials."""
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    with pytest.raises(ValueError, match=r"Wildcard CORS origin '\*' is forbidden"):
        Settings(
            _env_file=None,
            allowed_origins=["*"],
        )


@pytest.mark.asyncio
async def test_session_rollback_on_exception() -> None:
    """Database session dependency executes rollback on unhandled error."""
    mock_session = AsyncMock()
    mock_maker = MagicMock(return_value=mock_session)
    mock_session.__aenter__.return_value = mock_session

    with patch("app.db.session.async_session_maker", mock_maker):
        from app.db.session import get_db
        gen = get_db()
        session = await gen.asend(None)
        assert session == mock_session

        with pytest.raises(RuntimeError):
            await gen.athrow(RuntimeError("Forced failure"))

        mock_session.rollback.assert_awaited_once()
