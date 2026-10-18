"""Eco-Store router — /api/v1/eco-store/..."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import require_role, TokenPayload, get_current_token_payload
from app.db.session import get_async_session
from app.schemas import (
    EcoProductResponse, CartValidateRequest, CartValidateResponse,
    EcoCheckoutRequest, EcoOrderResponse,
)
from app.services.eco_store import EcoStoreService

router = APIRouter(prefix="/eco-store", tags=["Eco-Store"])

@router.get("/products", response_model=list[EcoProductResponse])
async def list_products(
    category: str | None = None,
    db: AsyncSession = Depends(get_async_session),
) -> list[EcoProductResponse]:
    """Browse upcycled products (public endpoint)."""
    return await EcoStoreService(db).list_products(category=category)

@router.get("/products/{product_id}", response_model=EcoProductResponse)
async def get_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
) -> EcoProductResponse:
    """Get individual product details."""
    return await EcoStoreService(db).get_product(product_id)

@router.post("/cart/validate", response_model=CartValidateResponse)
async def validate_cart(
    payload: CartValidateRequest,
    token: TokenPayload = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_async_session),
) -> CartValidateResponse:
    """Server-side cart validation with reward points calculation."""
    return await EcoStoreService(db).validate_cart(payload, user_id=token.sub)

@router.post("/orders/checkout", response_model=EcoOrderResponse, status_code=status.HTTP_201_CREATED)
async def checkout(
    payload: EcoCheckoutRequest,
    token: TokenPayload = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_async_session),
) -> EcoOrderResponse:
    """Create B2C order with point deduction and mock payment session."""
    return await EcoStoreService(db).checkout(payload, user_id=token.sub)
