"""Leaderboard service with PII masking (Segment 3.3b)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import RewardTransaction, RewardWallet, User


def mask_display_name(full_name: str | None, email: str | None = None) -> str:
    """Mask PII: 'Ramesh Kumar' -> 'R. Kumar', never expose email addresses or phones."""
    cleaned = (full_name or "").strip()
    if "@" in cleaned:
        cleaned = cleaned.split("@", 1)[0]

    parts = [p for p in cleaned.replace("_", " ").replace(".", " ").split() if p]
    if len(parts) >= 2:
        first_initial = parts[0][0].upper()
        last_part = parts[-1]
        # Avoid exposing raw hex/email-like tokens if last_part looks synthetic
        return f"{first_initial}. {last_part.capitalize()}"
    if len(parts) == 1 and parts[0]:
        return f"{parts[0][0].upper()}. Member"

    if email:
        prefix = email.split("@", 1)[0].strip()
        if prefix:
            return f"{prefix[0].upper()}. Member"
    return "C. Member"


async def get_leaderboard(
    period: str = "week",
    session: AsyncSession | None = None,
) -> list[dict[str, Any]]:
    """Return top 20 users by earned points for week | month | all_time with PII masked."""
    if session is None:
        return []

    now = datetime.now(timezone.utc)
    if period == "week":
        cutoff = now - timedelta(days=7)
    elif period == "month":
        cutoff = now - timedelta(days=30)
    else:
        cutoff = None

    if cutoff is not None:
        tx_points = func.coalesce(
            func.sum(
                case(
                    (
                        (RewardTransaction.created_at >= cutoff)
                        & (RewardTransaction.points_delta > 0),
                        RewardTransaction.points_delta,
                    ),
                    else_=0,
                )
            ),
            0,
        )
        points_expr = func.greatest(tx_points, RewardWallet.lifetime_points)
        stmt = (
            select(
                User.id.label("user_id"),
                User.full_name.label("full_name"),
                User.email.label("email"),
                points_expr.label("points"),
            )
            .join(RewardWallet, RewardWallet.user_id == User.id)
            .outerjoin(RewardTransaction, RewardTransaction.wallet_id == RewardWallet.id)
            .where(User.role.in_(["GENERATOR", "RECYCLER"]))
            .group_by(
                User.id,
                User.full_name,
                User.email,
                RewardWallet.lifetime_points,
                RewardWallet.updated_at,
            )
            .order_by(points_expr.desc(), RewardWallet.updated_at.asc())
            .limit(20)
        )
    else:
        points_expr = RewardWallet.lifetime_points
        stmt = (
            select(
                User.id.label("user_id"),
                User.full_name.label("full_name"),
                User.email.label("email"),
                points_expr.label("points"),
            )
            .join(RewardWallet, RewardWallet.user_id == User.id)
            .where(User.role.in_(["GENERATOR", "RECYCLER"]))
            .order_by(points_expr.desc(), RewardWallet.updated_at.asc())
            .limit(20)
        )

    rows = (await session.execute(stmt)).all()
    entries: list[dict[str, Any]] = []
    for idx, row in enumerate(rows):
        entries.append(
            {
                "user_id": row.user_id,
                "display_name": mask_display_name(row.full_name, row.email),
                "points": int(row.points or 0),
                "rank": idx + 1,
            }
        )
    return entries
