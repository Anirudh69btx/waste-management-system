"""Analytics router — /api/v1/analytics/..."""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_role, TokenPayload
from app.db.session import get_async_session, get_db
from app.dependencies.auth import get_current_active_user
from app.models import User
from app.schemas import (
    AdminDashboardResponse,
    PublicImpactMetrics,
    RecyclerDashboardResponse,
    SupplierDashboardResponse,
)
from app.schemas.analytics_schemas import (
    AdminAnalyticsResponse,
    SellerAnalyticsResponse,
    SupplierAnalyticsResponse,
)
from app.services import analytics_service
from app.services.analytics import AnalyticsService

router = APIRouter(tags=["analytics"])


@router.get("/analytics/supplier", response_model=SupplierAnalyticsResponse)
async def get_supplier_analytics(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_db),
    request_id: str = Header(default="-", alias="X-Request-ID"),
) -> SupplierAnalyticsResponse:
    return await analytics_service.supplier_analytics(user, from_date, to_date, session)


@router.get("/analytics/seller", response_model=SellerAnalyticsResponse)
async def get_seller_analytics(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_db),
    request_id: str = Header(default="-", alias="X-Request-ID"),
) -> SellerAnalyticsResponse:
    return await analytics_service.seller_analytics(user, from_date, to_date, session)


@router.get("/analytics/admin", response_model=AdminAnalyticsResponse)
async def get_admin_analytics(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_db),
    request_id: str = Header(default="-", alias="X-Request-ID"),
) -> AdminAnalyticsResponse:
    return await analytics_service.admin_analytics(user, from_date, to_date, session)


# Legacy dashboard endpoints preserved for backward compatibility
@router.get("/dashboards/metrics/public", response_model=PublicImpactMetrics)
async def public_metrics(db: AsyncSession = Depends(get_async_session)) -> PublicImpactMetrics:
    return await AnalyticsService(db).get_public_metrics()


@router.get("/dashboards/supplier", response_model=SupplierDashboardResponse)
async def supplier_dashboard(
    token: TokenPayload = Depends(require_role(["GENERATOR"])),
    db: AsyncSession = Depends(get_async_session),
) -> SupplierDashboardResponse:
    return await AnalyticsService(db).supplier_dashboard(token.sub)


@router.get("/dashboards/recycler", response_model=RecyclerDashboardResponse)
async def recycler_dashboard(
    token: TokenPayload = Depends(require_role(["RECYCLER"])),
    db: AsyncSession = Depends(get_async_session),
) -> RecyclerDashboardResponse:
    return await AnalyticsService(db).recycler_dashboard(token.sub)


@router.get("/dashboards/admin", response_model=AdminDashboardResponse)
async def admin_dashboard(
    token: TokenPayload = Depends(require_role(["ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> AdminDashboardResponse:
    return await AnalyticsService(db).admin_dashboard()
