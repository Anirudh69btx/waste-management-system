"""Analytics + AI Assessment routers."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import require_role, TokenPayload
from app.db.session import get_async_session
from app.schemas import (
    PublicImpactMetrics, SupplierDashboardResponse,
    RecyclerDashboardResponse, AdminDashboardResponse,
    WasteAssessmentResponse,
)
from app.services.analytics import AnalyticsService
from app.services.ai_assessment import AIAssessmentService

# ── Analytics ──────────────────────────────────────────────────────────────
router = APIRouter(prefix="/dashboards", tags=["Analytics & Dashboards"])

@router.get("/metrics/public", response_model=PublicImpactMetrics)
async def public_metrics(db: AsyncSession = Depends(get_async_session)) -> PublicImpactMetrics:
    """Public aggregate impact metrics for landing page."""
    return await AnalyticsService(db).get_public_metrics()

@router.get("/supplier", response_model=SupplierDashboardResponse)
async def supplier_dashboard(
    token: TokenPayload = Depends(require_role(["GENERATOR"])),
    db: AsyncSession = Depends(get_async_session),
) -> SupplierDashboardResponse:
    return await AnalyticsService(db).supplier_dashboard(token.sub)

@router.get("/recycler", response_model=RecyclerDashboardResponse)
async def recycler_dashboard(
    token: TokenPayload = Depends(require_role(["RECYCLER"])),
    db: AsyncSession = Depends(get_async_session),
) -> RecyclerDashboardResponse:
    return await AnalyticsService(db).recycler_dashboard(token.sub)

@router.get("/admin", response_model=AdminDashboardResponse)
async def admin_dashboard(
    token: TokenPayload = Depends(require_role(["ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> AdminDashboardResponse:
    return await AnalyticsService(db).admin_dashboard()
