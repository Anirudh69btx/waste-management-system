"""Tracking, Sorting, Marketplace, Pricing, Payments, Rewards, Eco-Store, Analytics, AI Assessment routers."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_role, TokenPayload
from app.db.session import get_async_session
from app.schemas import (
    TrackingPingRequest, TelemetryPingResponse, TransitTrailResponse,
    SortingRecordRequest, SortingRecordResponse, InventoryLotResponse,
    MarketplaceListingRequest, MarketplaceListingResponse,
    BidRequest, BidResponse,
    CheckoutRequest, PurchaseOrderResponse,
    PricingQuoteResponse,
    MockWebhookRequest, MockWebhookResponse,
    RewardWalletResponse, RewardTransactionResponse,
    CartValidateRequest, CartValidateResponse,
    EcoCheckoutRequest, EcoOrderResponse, EcoProductResponse,
    PublicImpactMetrics, SupplierDashboardResponse,
    RecyclerDashboardResponse, AdminDashboardResponse,
    WasteAssessmentResponse,
)
from app.services.tracking import TrackingService
from app.services.sorting import SortingService
from app.services.marketplace import MarketplaceService
from app.services.pricing import PricingService
from app.services.payments import PaymentService
from app.services.rewards import RewardService
from app.services.eco_store import EcoStoreService
from app.services.analytics import AnalyticsService
from app.services.ai_assessment import AIAssessmentService

# ─────────────────────────────────────────────────────────────────────────────
# Tracking
# ─────────────────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/tracking", tags=["GPS Tracking"])


@router.post("/ping", response_model=TelemetryPingResponse, status_code=201)
async def ingest_ping(
    payload: TrackingPingRequest,
    token: TokenPayload = Depends(require_role(["LOGISTICS", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> TelemetryPingResponse:
    """Ingest a GPS coordinate ping from a driver device or simulator."""
    return await TrackingService(db).record_ping(payload)


@router.get("/{transit_id}/trail", response_model=TransitTrailResponse)
async def get_trail(
    transit_id: uuid.UUID,
    token: TokenPayload = Depends(require_role(["GENERATOR", "RECYCLER", "LOGISTICS", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> TransitTrailResponse:
    """Return chronological GPS breadcrumb trail for a transit."""
    return await TrackingService(db).get_trail(transit_id)
