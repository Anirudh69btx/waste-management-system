"""Sorting repository — SQLAlchemy 2.x async."""
from __future__ import annotations

import uuid
from typing import Any
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sorting_record import SortingRecord


class SortingRepository:
    @staticmethod
    async def create(session: AsyncSession, **fields) -> SortingRecord:
        record = SortingRecord(**fields)
        session.add(record)
        await session.flush()
        await session.refresh(record)
        return record

    @staticmethod
    async def get_by_id(session: AsyncSession, record_id: uuid.UUID) -> SortingRecord | None:
        result = await session.execute(select(SortingRecord).where(SortingRecord.id == record_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_intake(session: AsyncSession, intake_id: uuid.UUID) -> list[SortingRecord]:
        result = await session.execute(
            select(SortingRecord).where(SortingRecord.intake_id == intake_id).order_by(SortingRecord.created_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def list_all(
        session: AsyncSession,
        filters: dict[str, Any] | None = None,
        pagination: dict[str, int] | None = None,
    ) -> tuple[list[SortingRecord], int]:
        query = select(SortingRecord)
        if filters:
            if "intake_id" in filters and filters["intake_id"] is not None:
                query = query.where(SortingRecord.intake_id == filters["intake_id"])
            if "sorter_user_id" in filters and filters["sorter_user_id"] is not None:
                query = query.where(SortingRecord.sorter_user_id == filters["sorter_user_id"])
            if "sort_grade" in filters and filters["sort_grade"] is not None:
                query = query.where(SortingRecord.sort_grade == filters["sort_grade"])

        count_query = select(func.count()).select_from(query.subquery())
        total = (await session.execute(count_query)).scalar_one()

        query = query.order_by(SortingRecord.created_at.desc())
        if pagination:
            skip = pagination.get("skip", 0)
            limit = pagination.get("limit", 20)
            query = query.offset(skip).limit(limit)

        result = await session.execute(query)
        return list(result.scalars().all()), total
