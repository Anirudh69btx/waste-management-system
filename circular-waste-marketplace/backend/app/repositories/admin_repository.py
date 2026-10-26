"""Admin repository — async SQL queries for user management, disputes, and activity feed."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Supplier, TraceabilityEvent, User, UserRole, WasteIntake, WeightTicket


async def list_users(
    session: AsyncSession,
    role: str | None = None,
    status: str | None = None,
    search: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[User], int]:
    stmt = select(User)
    count_stmt = select(func.count(User.id))

    filters = []
    if role:
        role_upper = role.strip().upper()
        try:
            filters.append(User.role == UserRole(role_upper))
        except ValueError:
            filters.append(User.role == role_upper)  # type: ignore[arg-type]

    if status:
        status_lower = status.strip().lower()
        if status_lower == "active":
            filters.append(User.is_active.is_(True))
        elif status_lower == "inactive":
            filters.append(User.is_active.is_(False))

    if search and search.strip():
        q = f"%{search.strip()}%"
        filters.append(or_(User.email.ilike(q), User.full_name.ilike(q)))

    if filters:
        stmt = stmt.where(*filters)
        count_stmt = count_stmt.where(*filters)

    total = int((await session.execute(count_stmt)).scalar_one() or 0)
    rows = (
        await session.execute(
            stmt.order_by(User.created_at.desc()).limit(limit).offset(offset)
        )
    ).scalars().all()
    return list(rows), total


async def get_user_by_id(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    res = await session.execute(select(User).where(User.id == user_id))
    return res.scalar_one_or_none()


async def count_active_admins(session: AsyncSession) -> int:
    res = await session.execute(
        select(func.count(User.id)).where(
            User.role == UserRole.ADMIN,
            User.is_active.is_(True),
        )
    )
    return int(res.scalar_one() or 0)


async def update_user_role(
    session: AsyncSession,
    user: User,
    new_role: str,
    actor_id: uuid.UUID,
) -> User:
    user.role = UserRole(new_role)
    user.last_role_change_by_user_id = actor_id
    user.last_role_change_at = datetime.now(timezone.utc)
    await session.flush()
    await session.refresh(user)
    return user


async def deactivate_user(
    session: AsyncSession,
    user: User,
    reason: str,
    actor_id: uuid.UUID,
) -> User:
    user.is_active = False
    user.deactivation_reason = reason
    user.deactivated_by_user_id = actor_id
    await session.flush()
    await session.refresh(user)
    return user


async def activate_user(session: AsyncSession, user: User) -> User:
    user.is_active = True
    user.deactivation_reason = None
    user.deactivated_by_user_id = None
    await session.flush()
    await session.refresh(user)
    return user


def _build_dispute_dict(
    ticket: WeightTicket, intake: WasteIntake, supplier_email: str
) -> dict[str, Any]:
    verified_kg = (
        float(intake.verified_weight_kg)
        if intake.verified_weight_kg is not None
        else float(ticket.net_weight_kg)
    )
    return {
        "id": ticket.id,
        "intake_id": ticket.intake_id,
        "batch_code": intake.batch_code,
        "supplier_email": supplier_email,
        "declared_weight_kg": float(intake.declared_weight_kg),
        "verified_weight_kg": verified_kg,
        "dispute_notes": ticket.supplier_dispute_notes or "",
        "weight_method": ticket.weight_method,
        "recorded_at": ticket.recorded_at,
        "dispute_resolution": ticket.dispute_resolution,
        "dispute_resolved_at": ticket.dispute_resolved_at,
    }


async def list_disputes(
    session: AsyncSession,
    resolution_filter: str = "pending",
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    base_filters = [WeightTicket.supplier_dispute_notes.is_not(None)]
    res_lower = (resolution_filter or "pending").strip().lower()
    if res_lower == "pending":
        base_filters.append(WeightTicket.dispute_resolution.is_(None))
    elif res_lower in ("upheld", "rejected"):
        base_filters.append(WeightTicket.dispute_resolution == res_lower)

    count_stmt = (
        select(func.count(WeightTicket.id))
        .join(WasteIntake, WeightTicket.intake_id == WasteIntake.id)
        .join(Supplier, WasteIntake.supplier_id == Supplier.id)
        .join(User, Supplier.user_id == User.id)
        .where(*base_filters)
    )
    total = int((await session.execute(count_stmt)).scalar_one() or 0)

    stmt = (
        select(WeightTicket, WasteIntake, User.email)
        .join(WasteIntake, WeightTicket.intake_id == WasteIntake.id)
        .join(Supplier, WasteIntake.supplier_id == Supplier.id)
        .join(User, Supplier.user_id == User.id)
        .where(*base_filters)
        .order_by(WeightTicket.recorded_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await session.execute(stmt)).all()
    items = [_build_dispute_dict(t, i, email) for t, i, email in rows]
    return items, total


async def get_dispute_by_ticket_id(
    session: AsyncSession, ticket_id: uuid.UUID
) -> tuple[WeightTicket, WasteIntake, str] | None:
    stmt = (
        select(WeightTicket, WasteIntake, User.email)
        .join(WasteIntake, WeightTicket.intake_id == WasteIntake.id)
        .join(Supplier, WasteIntake.supplier_id == Supplier.id)
        .join(User, Supplier.user_id == User.id)
        .where(WeightTicket.id == ticket_id)
    )
    row = (await session.execute(stmt)).first()
    if not row:
        return None
    return row[0], row[1], row[2]


async def resolve_dispute(
    session: AsyncSession,
    ticket: WeightTicket,
    resolution: str,
    note: str,
    actor_id: uuid.UUID,
) -> WeightTicket:
    ticket.dispute_resolution = resolution
    ticket.dispute_resolved_by_user_id = actor_id
    ticket.dispute_resolved_at = datetime.now(timezone.utc)
    ticket.dispute_resolution_note = note
    await session.flush()
    await session.refresh(ticket)
    return ticket


async def list_activity(
    session: AsyncSession,
    event_type_filter: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    filters = []
    if event_type_filter and event_type_filter.strip():
        filters.append(TraceabilityEvent.event_type == event_type_filter.strip())

    count_stmt = select(func.count(TraceabilityEvent.id))
    if filters:
        count_stmt = count_stmt.where(*filters)
    total = int((await session.execute(count_stmt)).scalar_one() or 0)

    stmt = (
        select(
            TraceabilityEvent,
            WasteIntake.batch_code,
            User.full_name,
        )
        .outerjoin(WasteIntake, TraceabilityEvent.batch_id == WasteIntake.id)
        .outerjoin(User, TraceabilityEvent.actor_user_id == User.id)
    )
    if filters:
        stmt = stmt.where(*filters)

    stmt = stmt.order_by(TraceabilityEvent.created_at.desc()).limit(limit).offset(offset)
    rows = (await session.execute(stmt)).all()

    items: list[dict[str, Any]] = []
    for ev, batch_code, actor_name in rows:
        items.append(
            {
                "id": ev.id,
                "event_type": ev.event_type,
                "batch_id": ev.batch_id,
                "batch_code": batch_code,
                "actor_user_id": ev.actor_user_id,
                "actor_name": actor_name,
                "actor_role": ev.actor_role,
                "from_status": ev.from_status,
                "to_status": ev.to_status,
                "metadata_json": dict(ev.metadata_json or {}),
                "created_at": ev.created_at,
            }
        )
    return items, total
