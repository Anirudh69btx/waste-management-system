from __future__ import annotations
import uuid
from typing import TYPE_CHECKING
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.traceability_repository import TraceabilityRepository

if TYPE_CHECKING:
    from app.models import User

trace_repo = TraceabilityRepository()


async def emit(
    session: AsyncSession,
    *,
    batch_id: uuid.UUID,
    event_type: str,
    actor: User | None = None,
    from_status: str | None = None,
    to_status: str | None = None,
    metadata: dict | None = None,
    request_id: str | None = None,
) -> None:
    await trace_repo.append(
        session,
        batch_id=batch_id,
        event_type=event_type,
        from_status=from_status,
        to_status=to_status,
        actor_user_id=actor.id if actor else None,
        actor_role=actor.role if actor else None,
        metadata_json=metadata or {},
        request_id=request_id,
    )
