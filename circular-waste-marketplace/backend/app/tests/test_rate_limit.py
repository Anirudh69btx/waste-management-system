"""
Integration tests for rate limiting on auth endpoints using slowapi.
"""
import pytest
from starlette.testclient import TestClient

from app.core.limiter import limiter


def test_rate_limiting_on_login(client: TestClient) -> None:
    """Exceeding the rate limit on /login triggers HTTP 429 with Retry-After header."""
    limiter.reset()

    # The default limit for login is 10/minute
    responses = []
    for _ in range(15):
        r = client.post(
            "/api/v1/auth/login",
            json={"email": "ratelimit_tester@example.com", "password": "Password123!"},
        )
        responses.append(r)

    statuses = [r.status_code for r in responses]
    # At least one request beyond the limit must return 429
    assert 429 in statuses

    # Find the 429 response
    r_429 = next(r for r in responses if r.status_code == 429)
    assert "retry-after" in r_429.headers
    data = r_429.json()
    assert data.get("status") == 429
    assert "Rate Limit Exceeded" in data.get("title", "")


def test_rate_limiter_reset_clears_blocks(client: TestClient) -> None:
    """Calling limiter.reset() immediately clears rate limits."""
    limiter.reset()

    # Hit 12 times to trigger limit
    for _ in range(12):
        client.post(
            "/api/v1/auth/login",
            json={"email": "reset_tester@example.com", "password": "Password123!"},
        )

    # Reset limiter
    limiter.reset()

    # Next request should NOT be 429
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "reset_tester@example.com", "password": "Password123!"},
    )
    assert res.status_code != 429
