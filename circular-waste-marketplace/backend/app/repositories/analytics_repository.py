from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import case, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Bid,
    InventoryLot,
    MarketplaceListing,
    PurchaseOrder,
    SortingRecord,
    Supplier,
    User,
    UserRole,
    WasteCategory,
    WasteIntake,
)

GMV_STATUSES = ["escrow_held", "shipped", "delivered", "completed"]


async def supplier_totals(
    session: AsyncSession,
    supplier_id: uuid.UUID,
    start: datetime,
    end: datetime,
) -> dict:
    stmt = (
        select(
            func.count(WasteIntake.id).label("total_batches"),
            func.coalesce(func.sum(WasteIntake.declared_weight_kg), 0.0).label("total_declared_kg"),
            func.coalesce(func.sum(WasteIntake.verified_weight_kg), 0.0).label("total_verified_kg"),
            func.count(
                case((WasteIntake.verified_weight_kg.isnot(None), 1))
            ).label("verified_batches"),
            func.count(
                case((WasteIntake.status.in_(["rejected", "cancelled"]), 1))
            ).label("rejected_batches"),
        )
        .where(
            WasteIntake.supplier_id == supplier_id,
            WasteIntake.created_at >= start,
            WasteIntake.created_at <= end,
        )
    )
    row = (await session.execute(stmt)).one()

    co2_stmt = (
        select(
            func.coalesce(
                func.sum(WasteIntake.verified_weight_kg * WasteCategory.carbon_offset_factor),
                0.0,
            ).label("co2e"),
            func.coalesce(
                func.sum(WasteIntake.declared_weight_kg * WasteCategory.carbon_offset_factor * 2.5),
                0.0,
            ).label("est_earnings"),
            func.coalesce(
                func.sum(
                    func.coalesce(WasteIntake.verified_weight_kg, 0.0)
                    * WasteCategory.carbon_offset_factor
                    * 2.5
                ),
                0.0,
            ).label("act_earnings"),
        )
        .join(WasteCategory, WasteCategory.id == WasteIntake.category_id)
        .where(
            WasteIntake.supplier_id == supplier_id,
            WasteIntake.created_at >= start,
            WasteIntake.created_at <= end,
        )
    )
    impact_row = (await session.execute(co2_stmt)).one()

    return {
        "total_batches": int(row.total_batches or 0),
        "total_declared_kg": round(float(row.total_declared_kg or 0.0), 2),
        "total_verified_kg": round(float(row.total_verified_kg or 0.0), 2),
        "verified_batches": int(row.verified_batches or 0),
        "rejected_batches": int(row.rejected_batches or 0),
        "total_co2e_saved_kg": round(float(impact_row.co2e or 0.0), 2),
        "total_estimated_earnings": round(float(impact_row.est_earnings or 0.0), 2),
        "total_actual_earnings": round(float(impact_row.act_earnings or 0.0), 2),
    }


async def supplier_kg_by_day(
    session: AsyncSession,
    supplier_id: uuid.UUID,
    start: datetime,
    end: datetime,
) -> list[tuple[date, float]]:
    stmt = (
        select(
            func.date(WasteIntake.created_at).label("day"),
            func.coalesce(func.sum(WasteIntake.verified_weight_kg), 0.0).label("kg"),
        )
        .where(WasteIntake.created_at >= start, WasteIntake.created_at <= end)
        .where(WasteIntake.supplier_id == supplier_id)
        .group_by(func.date(WasteIntake.created_at))
        .order_by(func.date(WasteIntake.created_at))
    )
    rows = (await session.execute(stmt)).all()
    return [(r.day, round(float(r.kg or 0.0), 2)) for r in rows]


async def supplier_batches_by_status(
    session: AsyncSession,
    supplier_id: uuid.UUID,
    start: datetime,
    end: datetime,
) -> list[tuple[str, int]]:
    stmt = (
        select(
            WasteIntake.status,
            func.count(WasteIntake.id).label("cnt"),
        )
        .where(
            WasteIntake.supplier_id == supplier_id,
            WasteIntake.created_at >= start,
            WasteIntake.created_at <= end,
        )
        .group_by(WasteIntake.status)
        .order_by(func.count(WasteIntake.id).desc())
    )
    rows = (await session.execute(stmt)).all()
    return [(str(r.status), int(r.cnt or 0)) for r in rows]


async def supplier_kg_by_category(
    session: AsyncSession,
    supplier_id: uuid.UUID,
    start: datetime,
    end: datetime,
) -> list[tuple[int, str, float, int]]:
    stmt = (
        select(
            WasteCategory.id,
            WasteCategory.name,
            func.coalesce(
                func.sum(func.coalesce(WasteIntake.verified_weight_kg, WasteIntake.declared_weight_kg)),
                0.0,
            ).label("kg"),
            func.count(WasteIntake.id).label("cnt"),
        )
        .join(WasteCategory, WasteCategory.id == WasteIntake.category_id)
        .where(
            WasteIntake.supplier_id == supplier_id,
            WasteIntake.created_at >= start,
            WasteIntake.created_at <= end,
        )
        .group_by(WasteCategory.id, WasteCategory.name)
        .order_by(
            func.coalesce(
                func.sum(func.coalesce(WasteIntake.verified_weight_kg, WasteIntake.declared_weight_kg)),
                0.0,
            ).desc()
        )
    )
    rows = (await session.execute(stmt)).all()
    return [(int(r.id), str(r.name), round(float(r.kg or 0.0), 2), int(r.cnt or 0)) for r in rows]


async def supplier_streak_days(
    session: AsyncSession,
    supplier_id: uuid.UUID,
) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    stmt = (
        select(distinct(func.date(WasteIntake.created_at)).label("day"))
        .where(
            WasteIntake.supplier_id == supplier_id,
            WasteIntake.created_at >= cutoff,
        )
        .order_by(func.date(WasteIntake.created_at).desc())
    )
    days = [r.day for r in (await session.execute(stmt)).all() if r.day is not None]
    if not days:
        return 0

    day_set = set(days)
    today = datetime.now(timezone.utc).date()
    cursor = today if today in day_set else (today - timedelta(days=1))
    streak = 0
    while cursor in day_set:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


async def seller_totals(
    session: AsyncSession,
    seller_id: uuid.UUID,
    start: datetime,
    end: datetime,
) -> dict:
    lot_stmt = (
        select(
            func.count(InventoryLot.id).label("total_lots"),
            func.coalesce(
                func.sum(
                    case((InventoryLot.status == "available", InventoryLot.available_kg), else_=0)
                ),
                0,
            ).label("avail_kg"),
            func.coalesce(
                func.sum(
                    case((InventoryLot.status == "reserved", InventoryLot.quantity_kg), else_=0)
                ),
                0,
            ).label("res_kg"),
        )
        .join(SortingRecord, SortingRecord.id == InventoryLot.sorting_record_id)
        .where(
            SortingRecord.sorter_user_id == seller_id,
            InventoryLot.created_at >= start,
            InventoryLot.created_at <= end,
        )
    )
    lot_row = (await session.execute(lot_stmt)).one()

    rev_all_stmt = (
        select(
            func.coalesce(func.sum(PurchaseOrder.total_amount), 0).label("total_rev"),
        )
        .where(
            PurchaseOrder.seller_user_id == seller_id,
            PurchaseOrder.status.in_(GMV_STATUSES),
        )
    )
    rev_all_row = (await session.execute(rev_all_stmt)).one()

    rev_period_stmt = (
        select(
            func.coalesce(func.sum(PurchaseOrder.total_amount), 0).label("period_rev"),
            func.coalesce(func.sum(PurchaseOrder.quantity_kg), 0).label("sold_kg"),
        )
        .where(
            PurchaseOrder.seller_user_id == seller_id,
            PurchaseOrder.status.in_(GMV_STATUSES),
            PurchaseOrder.created_at >= start,
            PurchaseOrder.created_at <= end,
        )
    )
    rev_period_row = (await session.execute(rev_period_stmt)).one()

    open_orders_stmt = select(func.count(PurchaseOrder.id)).where(
        PurchaseOrder.seller_user_id == seller_id,
        PurchaseOrder.status.in_(["pending_payment", "escrow_held", "confirmed", "shipped", "delivered"]),
    )
    open_orders = int((await session.execute(open_orders_stmt)).scalar() or 0)

    pending_bids_stmt = (
        select(func.count(Bid.id))
        .join(MarketplaceListing, MarketplaceListing.id == Bid.listing_id)
        .where(
            MarketplaceListing.seller_id == seller_id,
            Bid.status == "pending",
        )
    )
    pending_bids = int((await session.execute(pending_bids_stmt)).scalar() or 0)

    return {
        "total_lots_created": int(lot_row.total_lots or 0),
        "available_kg": round(float(lot_row.avail_kg or 0.0), 2),
        "reserved_kg": round(float(lot_row.res_kg or 0.0), 2),
        "sold_kg": round(float(rev_period_row.sold_kg or 0.0), 2),
        "total_revenue": round(float(rev_all_row.total_rev or 0.0), 2),
        "revenue_this_period": round(float(rev_period_row.period_rev or 0.0), 2),
        "pending_bids": pending_bids,
        "open_orders": open_orders,
    }


async def seller_revenue_by_day(
    session: AsyncSession,
    seller_id: uuid.UUID,
    start: datetime,
    end: datetime,
) -> list[tuple[date, float]]:
    stmt = (
        select(
            func.date(PurchaseOrder.created_at).label("day"),
            func.coalesce(func.sum(PurchaseOrder.total_amount), 0).label("rev"),
        )
        .where(
            PurchaseOrder.seller_user_id == seller_id,
            PurchaseOrder.status.in_(GMV_STATUSES),
            PurchaseOrder.created_at >= start,
            PurchaseOrder.created_at <= end,
        )
        .group_by(func.date(PurchaseOrder.created_at))
        .order_by(func.date(PurchaseOrder.created_at))
    )
    rows = (await session.execute(stmt)).all()
    return [(r.day, round(float(r.rev or 0.0), 2)) for r in rows]


async def seller_kg_sold_by_category(
    session: AsyncSession,
    seller_id: uuid.UUID,
    start: datetime,
    end: datetime,
) -> list[tuple[int, str, float, int]]:
    stmt = (
        select(
            WasteCategory.id,
            WasteCategory.name,
            func.coalesce(func.sum(PurchaseOrder.quantity_kg), 0).label("kg"),
            func.count(PurchaseOrder.id).label("cnt"),
        )
        .join(MarketplaceListing, MarketplaceListing.id == PurchaseOrder.listing_id)
        .join(WasteCategory, WasteCategory.id == MarketplaceListing.category_id)
        .where(
            PurchaseOrder.seller_user_id == seller_id,
            PurchaseOrder.status.in_(GMV_STATUSES),
            PurchaseOrder.created_at >= start,
            PurchaseOrder.created_at <= end,
        )
        .group_by(WasteCategory.id, WasteCategory.name)
        .order_by(func.coalesce(func.sum(PurchaseOrder.quantity_kg), 0).desc())
    )
    rows = (await session.execute(stmt)).all()
    return [(int(r.id), str(r.name), round(float(r.kg or 0.0), 2), int(r.cnt or 0)) for r in rows]


async def seller_orders_by_status(
    session: AsyncSession,
    seller_id: uuid.UUID,
    start: datetime,
    end: datetime,
) -> list[tuple[str, int]]:
    stmt = (
        select(
            PurchaseOrder.status,
            func.count(PurchaseOrder.id).label("cnt"),
        )
        .where(
            PurchaseOrder.seller_user_id == seller_id,
            PurchaseOrder.created_at >= start,
            PurchaseOrder.created_at <= end,
        )
        .group_by(PurchaseOrder.status)
        .order_by(func.count(PurchaseOrder.id).desc())
    )
    rows = (await session.execute(stmt)).all()
    return [(str(r.status), int(r.cnt or 0)) for r in rows]


async def seller_bid_acceptance(
    session: AsyncSession,
    seller_id: uuid.UUID,
    start: datetime,
    end: datetime,
) -> tuple[int, int]:
    stmt = (
        select(
            func.count(case((Bid.status == "accepted", 1))).label("accepted"),
            func.count(Bid.id).label("total"),
        )
        .join(MarketplaceListing, MarketplaceListing.id == Bid.listing_id)
        .where(
            MarketplaceListing.seller_id == seller_id,
            Bid.created_at >= start,
            Bid.created_at <= end,
        )
    )
    row = (await session.execute(stmt)).one()
    return int(row.accepted or 0), int(row.total or 0)


async def admin_totals(
    session: AsyncSession,
    start: datetime,
    end: datetime,
) -> dict:
    intake_stmt = (
        select(
            func.count(WasteIntake.id).label("total_intakes"),
            func.coalesce(func.sum(WasteIntake.verified_weight_kg), 0.0).label("kg_diverted"),
            func.count(distinct(WasteIntake.supplier_id)).label("active_suppliers"),
        )
        .where(WasteIntake.created_at >= start, WasteIntake.created_at <= end)
    )
    intake_row = (await session.execute(intake_stmt)).one()

    co2_stmt = (
        select(
            func.coalesce(
                func.sum(WasteIntake.verified_weight_kg * WasteCategory.carbon_offset_factor),
                0.0,
            )
        )
        .join(WasteCategory, WasteCategory.id == WasteIntake.category_id)
        .where(WasteIntake.verified_weight_kg.isnot(None))
        .where(WasteIntake.created_at >= start, WasteIntake.created_at <= end)
    )
    co2_saved = float((await session.execute(co2_stmt)).scalar() or 0.0)

    gmv_stmt = (
        select(func.coalesce(func.sum(PurchaseOrder.total_amount), 0))
        .where(PurchaseOrder.status.in_(GMV_STATUSES))
        .where(PurchaseOrder.created_at >= start, PurchaseOrder.created_at <= end)
    )
    total_gmv = float((await session.execute(gmv_stmt)).scalar() or 0.0)

    users_stmt = select(
        func.count(User.id).label("active_users"),
        func.count(case((User.role == UserRole.RECYCLER, 1))).label("active_recyclers"),
    ).where(User.is_active.is_(True))
    users_row = (await session.execute(users_stmt)).one()

    households_stmt = select(func.count(distinct(WasteIntake.supplier_id))).where(
        WasteIntake.verified_weight_kg.isnot(None)
    )
    total_households = int((await session.execute(households_stmt)).scalar() or 0)

    return {
        "total_intakes": int(intake_row.total_intakes or 0),
        "total_kg_diverted": round(float(intake_row.kg_diverted or 0.0), 2),
        "total_co2e_saved_kg": round(co2_saved, 2),
        "total_gmv": round(total_gmv, 2),
        "active_users": int(users_row.active_users or 0),
        "active_suppliers": int(intake_row.active_suppliers or 0),
        "active_recyclers": int(users_row.active_recyclers or 0),
        "total_households_served": total_households,
    }


async def admin_kg_by_day(
    session: AsyncSession,
    start: datetime,
    end: datetime,
) -> list[tuple[date, float]]:
    stmt = (
        select(
            func.date(WasteIntake.created_at).label("day"),
            func.coalesce(func.sum(WasteIntake.verified_weight_kg), 0.0).label("kg"),
        )
        .where(WasteIntake.created_at >= start, WasteIntake.created_at <= end)
        .group_by(func.date(WasteIntake.created_at))
        .order_by(func.date(WasteIntake.created_at))
    )
    rows = (await session.execute(stmt)).all()
    return [(r.day, round(float(r.kg or 0.0), 2)) for r in rows]


async def admin_gmv_by_day(
    session: AsyncSession,
    start: datetime,
    end: datetime,
) -> list[tuple[date, float]]:
    stmt = (
        select(
            func.date(PurchaseOrder.created_at).label("day"),
            func.coalesce(func.sum(PurchaseOrder.total_amount), 0.0).label("gmv"),
        )
        .where(
            PurchaseOrder.status.in_(GMV_STATUSES),
            PurchaseOrder.created_at >= start,
            PurchaseOrder.created_at <= end,
        )
        .group_by(func.date(PurchaseOrder.created_at))
        .order_by(func.date(PurchaseOrder.created_at))
    )
    rows = (await session.execute(stmt)).all()
    return [(r.day, round(float(r.gmv or 0.0), 2)) for r in rows]


async def admin_kg_by_category(
    session: AsyncSession,
    start: datetime,
    end: datetime,
) -> list[tuple[int, str, float, int]]:
    stmt = (
        select(
            WasteCategory.id,
            WasteCategory.name,
            func.coalesce(func.sum(WasteIntake.verified_weight_kg), 0.0).label("kg"),
            func.count(WasteIntake.id).label("cnt"),
        )
        .join(WasteCategory, WasteCategory.id == WasteIntake.category_id)
        .where(WasteIntake.created_at >= start, WasteIntake.created_at <= end)
        .group_by(WasteCategory.id, WasteCategory.name)
        .order_by(func.coalesce(func.sum(WasteIntake.verified_weight_kg), 0.0).desc())
    )
    rows = (await session.execute(stmt)).all()
    return [(int(r.id), str(r.name), round(float(r.kg or 0.0), 2), int(r.cnt or 0)) for r in rows]


async def admin_users_by_role(session: AsyncSession) -> list[tuple[str, int]]:
    stmt = (
        select(
            User.role,
            func.count(User.id).label("cnt"),
        )
        .group_by(User.role)
        .order_by(func.count(User.id).desc())
    )
    rows = (await session.execute(stmt)).all()
    return [
        (r.role.value if hasattr(r.role, "value") else str(r.role), int(r.cnt or 0))
        for r in rows
    ]


async def admin_intakes_by_status(
    session: AsyncSession,
    start: datetime,
    end: datetime,
) -> list[tuple[str, int]]:
    stmt = (
        select(
            WasteIntake.status,
            func.count(WasteIntake.id).label("cnt"),
        )
        .where(WasteIntake.created_at >= start, WasteIntake.created_at <= end)
        .group_by(WasteIntake.status)
        .order_by(func.count(WasteIntake.id).desc())
    )
    rows = (await session.execute(stmt)).all()
    return [(str(r.status), int(r.cnt or 0)) for r in rows]


async def admin_top_suppliers(
    session: AsyncSession,
    start: datetime,
    end: datetime,
    limit: int = 5,
) -> list[dict]:
    stmt = (
        select(
            User.id,
            User.full_name,
            func.coalesce(func.sum(WasteIntake.verified_weight_kg), 0.0).label("kg"),
        )
        .join(Supplier, Supplier.user_id == User.id)
        .join(WasteIntake, WasteIntake.supplier_id == Supplier.id)
        .where(
            WasteIntake.created_at >= start,
            WasteIntake.created_at <= end,
            WasteIntake.verified_weight_kg.isnot(None),
        )
        .group_by(User.id, User.full_name)
        .order_by(func.coalesce(func.sum(WasteIntake.verified_weight_kg), 0.0).desc())
        .limit(limit)
    )
    rows = (await session.execute(stmt)).all()
    return [
        {"id": str(r.id), "name": r.full_name, "kg": round(float(r.kg or 0.0), 2)}
        for r in rows
    ]


async def admin_top_sellers(
    session: AsyncSession,
    start: datetime,
    end: datetime,
    limit: int = 5,
) -> list[dict]:
    stmt = (
        select(
            User.id,
            User.full_name,
            func.coalesce(func.sum(PurchaseOrder.total_amount), 0.0).label("revenue"),
        )
        .join(PurchaseOrder, PurchaseOrder.seller_user_id == User.id)
        .where(
            PurchaseOrder.status.in_(GMV_STATUSES),
            PurchaseOrder.created_at >= start,
            PurchaseOrder.created_at <= end,
        )
        .group_by(User.id, User.full_name)
        .order_by(func.coalesce(func.sum(PurchaseOrder.total_amount), 0.0).desc())
        .limit(limit)
    )
    rows = (await session.execute(stmt)).all()
    return [
        {"id": str(r.id), "name": r.full_name, "revenue": round(float(r.revenue or 0.0), 2)}
        for r in rows
    ]
