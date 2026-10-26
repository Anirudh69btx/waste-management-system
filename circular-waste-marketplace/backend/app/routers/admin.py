"""Admin router — /api/v1/admin/... (Segment 3.3c)."""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.limiter import get_user_or_ip_key, limiter
from app.db.session import get_async_session
from app.dependencies.auth import get_current_active_user
from app.models import User
from app.schemas.admin_schemas import (
    ActivityEvent,
    ActivityFeedResponse,
    AdminDeactivateRequest,
    AdminDisputeListItem,
    AdminDisputeListResponse,
    AdminDisputeResolveRequest,
    AdminRoleChangeRequest,
    AdminUserListItem,
    AdminUserListResponse,
)
from app.services import admin_service

router = APIRouter(prefix="/admin", tags=["Admin"])


def _to_admin_user_item(u: User) -> AdminUserListItem:
    role_str = u.role.value if hasattr(u.role, "value") else str(u.role)
    return AdminUserListItem(
        id=u.id,
        email=u.email,
        full_name=u.full_name,
        role=role_str,
        organization_name=u.organization_name,
        phone_number=u.phone_number,
        is_active=u.is_active,
        is_verified=u.is_verified,
        created_at=u.created_at,
        deactivation_reason=u.deactivation_reason,
        last_role_change_at=u.last_role_change_at,
    )


@router.get("/users", response_model=AdminUserListResponse)
@limiter.limit("60/minute", key_func=get_user_or_ip_key)
async def list_users(
    request: Request,
    role: str | None = Query(default=None),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> AdminUserListResponse:
    items, total = await admin_service.list_users(
        user=user,
        role=role,
        status_filter=status,
        search=search,
        session=session,
        limit=limit,
        offset=offset,
    )
    return AdminUserListResponse(
        items=[_to_admin_user_item(u) for u in items],
        total=total,
    )


@router.patch("/users/{id}/role", response_model=AdminUserListItem)
@limiter.limit("30/minute", key_func=get_user_or_ip_key)
async def change_user_role(
    id: uuid.UUID,
    payload: AdminRoleChangeRequest,
    request: Request,
    user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> AdminUserListItem:
    request_id = request.headers.get("X-Request-ID")
    updated = await admin_service.change_user_role(
        user=user,
        target_user_id=id,
        new_role=payload.new_role,
        reason=payload.reason,
        session=session,
        request_id=request_id,
    )
    return _to_admin_user_item(updated)


@router.patch("/users/{id}/deactivate", response_model=AdminUserListItem)
@limiter.limit("30/minute", key_func=get_user_or_ip_key)
async def deactivate_user(
    id: uuid.UUID,
    payload: AdminDeactivateRequest,
    request: Request,
    user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> AdminUserListItem:
    request_id = request.headers.get("X-Request-ID")
    updated = await admin_service.deactivate_user(
        user=user,
        target_user_id=id,
        reason=payload.reason,
        session=session,
        request_id=request_id,
    )
    return _to_admin_user_item(updated)


@router.patch("/users/{id}/activate", response_model=AdminUserListItem)
@limiter.limit("30/minute", key_func=get_user_or_ip_key)
async def activate_user(
    id: uuid.UUID,
    request: Request,
    user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> AdminUserListItem:
    request_id = request.headers.get("X-Request-ID")
    updated = await admin_service.activate_user(
        user=user,
        target_user_id=id,
        session=session,
        request_id=request_id,
    )
    return _to_admin_user_item(updated)


@router.get("/disputes", response_model=AdminDisputeListResponse)
@limiter.limit("60/minute", key_func=get_user_or_ip_key)
async def list_disputes(
    request: Request,
    resolution: str = Query(default="pending", pattern="^(pending|upheld|rejected|all)$"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> AdminDisputeListResponse:
    items_raw, total = await admin_service.list_disputes(
        user=user,
        resolution_filter=resolution,
        session=session,
        limit=limit,
        offset=offset,
    )
    return AdminDisputeListResponse(
        items=[AdminDisputeListItem(**item) for item in items_raw],
        total=total,
    )


@router.post("/disputes/{ticket_id}/resolve", response_model=AdminDisputeListItem)
@limiter.limit("30/minute", key_func=get_user_or_ip_key)
async def resolve_dispute(
    ticket_id: uuid.UUID,
    payload: AdminDisputeResolveRequest,
    request: Request,
    user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> AdminDisputeListItem:
    request_id = request.headers.get("X-Request-ID")
    item_raw = await admin_service.resolve_dispute(
        user=user,
        ticket_id=ticket_id,
        resolution=payload.resolution,
        note=payload.note,
        session=session,
        request_id=request_id,
    )
    return AdminDisputeListItem(**item_raw)


@router.get("/activity", response_model=ActivityFeedResponse)
@limiter.limit("60/minute", key_func=get_user_or_ip_key)
async def get_activity_feed(
    request: Request,
    event_type: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> ActivityFeedResponse:
    items_raw, total = await admin_service.get_activity_feed(
        user=user,
        event_type_filter=event_type,
        session=session,
        limit=limit,
        offset=offset,
    )
    return ActivityFeedResponse(
        items=[ActivityEvent(**item) for item in items_raw],
        total=total,
    )
