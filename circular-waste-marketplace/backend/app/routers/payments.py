"""Payments router — /api/v1/payments/..."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import require_role, TokenPayload
from app.core.settings import get_settings
from app.db.session import get_async_session
from app.schemas import MockWebhookRequest, MockWebhookResponse
from app.services.payments import PaymentService

router = APIRouter(prefix="/payments", tags=["Payments"])
settings = get_settings()

@router.post("/mock-webhook", response_model=MockWebhookResponse)
async def mock_webhook(
    payload: MockWebhookRequest,
    db: AsyncSession = Depends(get_async_session),
) -> MockWebhookResponse:
    """
    Simulate a payment gateway webhook callback.
    BLOCKED in production environments.
    """
    if settings.is_production:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Mock payment endpoints are disabled in production.",
        )
    return await PaymentService(db).process_mock_webhook(payload)

@router.post("/escrow/release/{order_id}", response_model=MockWebhookResponse)
async def release_escrow(
    order_id: uuid.UUID,
    token: TokenPayload = Depends(require_role(["ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> MockWebhookResponse:
    """Admin-triggered escrow release after delivery confirmation."""
    return await PaymentService(db).release_escrow(order_id)
