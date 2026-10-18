"""Pricing router — /api/v1/pricing/..."""
from __future__ import annotations
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import require_role, TokenPayload
from app.db.session import get_async_session
from app.schemas import PricingQuoteResponse
from app.services.pricing import PricingService

router = APIRouter(prefix="/pricing", tags=["Pricing"])

@router.get("/quote", response_model=PricingQuoteResponse)
async def get_pricing_quote(
    category_id: int = Query(...),
    purity_grade: str = Query(...),
    moisture_content_percent: float = Query(default=5.0, ge=0, le=100),
    contamination_percent: float = Query(default=0.0, ge=0, le=100),
    token: TokenPayload = Depends(require_role(["GENERATOR", "RECYCLER", "LOGISTICS", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> PricingQuoteResponse:
    """Calculate the dynamic price quote for a material lot."""
    return await PricingService(db).get_quote(
        category_id=category_id,
        purity_grade=purity_grade,
        moisture_content_percent=moisture_content_percent,
        contamination_percent=contamination_percent,
    )
