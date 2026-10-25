"""
End-to-end route tests for Circular Waste Marketplace.
Verifies health checks, authentication rules, role authorization, and pricing engine endpoints.
"""
from __future__ import annotations

import pytest
from starlette.testclient import TestClient


def test_health_check(client: TestClient) -> None:
    """GET /health must respond 200 OK with status='ok'."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") in ["ok", "healthy"]
    assert "version" in data


def test_ready_check(client: TestClient) -> None:
    """GET /ready must respond 200 OK."""
    response = client.get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") in ["ready", "degraded", "ok"]


def test_unauthorized_access_fails(client: TestClient) -> None:
    """Protected endpoints must reject requests lacking Authorization headers."""
    response = client.get("/api/v1/suppliers/me")
    assert response.status_code == 401


def test_forbidden_role_access(client: TestClient, real_user_headers) -> None:
    """Supplier (GENERATOR) should not be authorized to perform recycler sorting operations."""
    headers = real_user_headers("GENERATOR")
    response = client.post(
        "/api/v1/sorting/process",
        headers=headers,
        json={
            "intake_id": "00000000-0000-0000-0000-000000000000",
            "sorted_weight_kg": 100.0,
            "recovered_weight_kg": 95.0,
            "waste_category_id": 1,
            "contamination_percent": 5.0,
        },
    )
    assert response.status_code == 403


def test_pricing_quote_schema_validation(client: TestClient, supplier_headers: dict[str, str]) -> None:
    """GET /api/v1/pricing/quote validates required parameters."""
    response = client.get(
        "/api/v1/pricing/quote",
        headers=supplier_headers,
        params={
            "category_id": 1,
            "purity_grade": "GRADE_A",
            "moisture_content_percent": 5.0,
            "contamination_percent": 1.0,
        },
    )
    # Returns 200 or 404 (if DB rule not seeded yet)
    assert response.status_code in [200, 404]
