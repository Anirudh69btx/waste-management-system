"""Admin service — role-gated business logic and safeguards for Segment 3.3c."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models import User, UserRole
from app.repositories import admin_repository

logger = get_logger(__name__)


def _require_admin(user: User) -> None:
    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    if role_val.upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required.",
        )


async def list_users(
    user: User,
    role: str | None,
    status_filter: str | None,
    search: str | None,
    session: AsyncSession,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[User], int]:
    _require_admin(user)
    return await admin_repository.list_users(
        session,
        role=role,
        status=status_filter,
        search=search,
        limit=limit,
        offset=offset,
    )


async def change_user_role(
    user: User,
    target_user_id: uuid.UUID,
    new_role: str,
    reason: str,
    session: AsyncSession,
    request_id: str | None = None,
) -> User:
    _require_admin(user)
    if user.id == target_user_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot change your own role.",
        )

    target_user = await admin_repository.get_user_by_id(session, target_user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {target_user_id} not found.",
        )

    from_role = (
        target_user.role.value
        if hasattr(target_user.role, "value")
        else str(target_user.role)
    )
    updated = await admin_repository.update_user_role(
        session, target_user, new_role, user.id
    )
    await session.commit()
    logger.info(
        "admin.role_changed",
        target_user_id=str(target_user_id),
        from_role=from_role,
        to_role=new_role,
        actor_user_id=str(user.id),
        reason=reason,
        request_id=request_id,
    )
    return updated


async def deactivate_user(
    user: User,
    target_user_id: uuid.UUID,
    reason: str,
    session: AsyncSession,
    request_id: str | None = None,
) -> User:
    _require_admin(user)
    target_user = await admin_repository.get_user_by_id(session, target_user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {target_user_id} not found.",
        )

    target_role = (
        target_user.role.value
        if hasattr(target_user.role, "value")
        else str(target_user.role)
    )
    if target_role.upper() == UserRole.ADMIN.value and target_user.is_active:
        active_admins = await admin_repository.count_active_admins(session)
        if active_admins <= 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Cannot deactivate the last active ADMIN.",
            )

    if user.id == target_user_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot deactivate your own account.",
        )

    updated = await admin_repository.deactivate_user(
        session, target_user, reason, user.id
    )
    await session.commit()
    logger.info(
        "admin.user_deactivated",
        target_user_id=str(target_user_id),
        actor_user_id=str(user.id),
        reason=reason,
        request_id=request_id,
    )
    return updated


async def activate_user(
    user: User,
    target_user_id: uuid.UUID,
    session: AsyncSession,
    request_id: str | None = None,
) -> User:
    _require_admin(user)
    target_user = await admin_repository.get_user_by_id(session, target_user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {target_user_id} not found.",
        )

    updated = await admin_repository.activate_user(session, target_user)
    await session.commit()
    logger.info(
        "admin.user_activated",
        target_user_id=str(target_user_id),
        actor_user_id=str(user.id),
        request_id=request_id,
    )
    return updated


async def list_disputes(
    user: User,
    resolution_filter: str,
    session: AsyncSession,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    _require_admin(user)
    return await admin_repository.list_disputes(
        session,
        resolution_filter=resolution_filter,
        limit=limit,
        offset=offset,
    )


async def resolve_dispute(
    user: User,
    ticket_id: uuid.UUID,
    resolution: str,
    note: str,
    session: AsyncSession,
    request_id: str | None = None,
) -> dict[str, Any]:
    _require_admin(user)
    row = await admin_repository.get_dispute_by_ticket_id(session, ticket_id)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Weight ticket {ticket_id} not found.",
        )

    ticket, intake, supplier_email = row
    if not ticket.supplier_dispute_notes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Weight ticket has no supplier dispute notes to resolve.",
        )

    if ticket.dispute_resolved_at is not None or ticket.dispute_resolution is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Dispute has already been resolved.",
        )

    ticket = await admin_repository.resolve_dispute(
        session, ticket, resolution, note, user.id
    )
    await session.commit()
    logger.info(
        "admin.dispute_resolved",
        ticket_id=str(ticket_id),
        resolution=resolution,
        actor_user_id=str(user.id),
        request_id=request_id,
    )
    return admin_repository._build_dispute_dict(ticket, intake, supplier_email)


async def get_activity_feed(
    user: User,
    event_type_filter: str | None,
    session: AsyncSession,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    _require_admin(user)
    return await admin_repository.list_activity(
        session,
        event_type_filter=event_type_filter,
        limit=limit,
        offset=offset,
    )
