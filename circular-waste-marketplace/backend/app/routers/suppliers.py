"""Suppliers router — POST/GET /api/v1/suppliers/..."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_role, TokenPayload
from app.db.session import get_async_session
from app.schemas import SupplierProfileRequest, SupplierResponse
from app.services.suppliers import SupplierService

router = APIRouter(prefix="/suppliers", tags=["Suppliers"])


@router.post("/profile", response_model=SupplierResponse, status_code=201)
async def create_profile(
    payload: SupplierProfileRequest,
    token: TokenPayload = Depends(require_role(["GENERATOR"])),
    db: AsyncSession = Depends(get_async_session),
) -> SupplierResponse:
    """Create or update supplier KYC profile (GENERATOR role only)."""
    return await SupplierService(db).upsert_profile(token.sub, payload)


@router.get("/me", response_model=SupplierResponse)
async def get_my_profile(
    token: TokenPayload = Depends(require_role(["GENERATOR"])),
    db: AsyncSession = Depends(get_async_session),
) -> SupplierResponse:
    """Fetch authenticated supplier's KYC profile."""
    return await SupplierService(db).get_by_user_id(token.sub)
