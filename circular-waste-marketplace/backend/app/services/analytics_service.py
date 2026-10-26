from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Supplier, User
from app.repositories import analytics_repository
from app.schemas.analytics_schemas import (
    AdminAnalyticsResponse,
    CategoryBreakdown,
    SellerAnalyticsResponse,
    StatusBreakdown,
    SupplierAnalyticsResponse,
    TimeSeriesPoint,
)


def _resolve_period(
    from_date: date | None,
    to_date: date | None,
) -> tuple[date, date, datetime, datetime]:
    today = datetime.now(timezone.utc).date()
    end_d = to_date if to_date is not None else today
    start_d = from_date if from_date is not None else (end_d - timedelta(days=30))
    start_dt = datetime.combine(start_d, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(end_d, time.max, tzinfo=timezone.utc)
    return start_d, end_d, start_dt, end_dt


def _role_str(user: User) -> str:
    return (user.role.value if hasattr(user.role, "value") else str(user.role)).upper()


async def supplier_analytics(
    user: User,
    from_date: date | None,
    to_date: date | None,
    session: AsyncSession,
) -> SupplierAnalyticsResponse:
    if _role_str(user) != "GENERATOR":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only GENERATOR role can access supplier analytics.",
        )

    supp_res = await session.execute(
        select(Supplier).where(Supplier.user_id == user.id)
    )
    supplier = supp_res.scalar_one_or_none()
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier profile not found.",
        )

    start_d, end_d, start_dt, end_dt = _resolve_period(from_date, to_date)

    totals = await analytics_repository.supplier_totals(session, supplier.id, start_dt, end_dt)
    kg_day_rows = await analytics_repository.supplier_kg_by_day(session, supplier.id, start_dt, end_dt)
    status_rows = await analytics_repository.supplier_batches_by_status(session, supplier.id, start_dt, end_dt)
    cat_rows = await analytics_repository.supplier_kg_by_category(session, supplier.id, start_dt, end_dt)
    streak = await analytics_repository.supplier_streak_days(session, supplier.id)

    total_batches = totals["total_batches"]
    verified_batches = totals["verified_batches"]
    rejected_batches = totals["rejected_batches"]
    total_verified_kg = totals["total_verified_kg"]

    avg_kg_per_batch = round(total_verified_kg / max(1, verified_batches), 2)
    rejection_rate = round((rejected_batches / max(1, total_batches)) * 100.0, 2) if total_batches > 0 else 0.0

    return SupplierAnalyticsResponse(
        period_start=start_d,
        period_end=end_d,
        total_batches=total_batches,
        total_declared_kg=totals["total_declared_kg"],
        total_verified_kg=total_verified_kg,
        total_estimated_earnings=totals["total_estimated_earnings"],
        total_actual_earnings=totals["total_actual_earnings"],
        total_co2e_saved_kg=totals["total_co2e_saved_kg"],
        avg_kg_per_batch=avg_kg_per_batch,
        rejection_rate=rejection_rate,
        submission_streak_days=streak,
        kg_by_day=[TimeSeriesPoint(date=d, value=v) for d, v in kg_day_rows],
        batches_by_status=[StatusBreakdown(status=s, count=c) for s, c in status_rows],
        kg_by_category=[
            CategoryBreakdown(category_id=cid, category_name=cname, quantity_kg=kg, count=cnt)
            for cid, cname, kg, cnt in cat_rows
        ],
    )


async def seller_analytics(
    user: User,
    from_date: date | None,
    to_date: date | None,
    session: AsyncSession,
) -> SellerAnalyticsResponse:
    if _role_str(user) not in ("RECYCLER", "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only RECYCLER role can access seller analytics.",
        )

    start_d, end_d, start_dt, end_dt = _resolve_period(from_date, to_date)

    totals = await analytics_repository.seller_totals(session, user.id, start_dt, end_dt)
    rev_day_rows = await analytics_repository.seller_revenue_by_day(session, user.id, start_dt, end_dt)
    cat_rows = await analytics_repository.seller_kg_sold_by_category(session, user.id, start_dt, end_dt)
    order_status_rows = await analytics_repository.seller_orders_by_status(session, user.id, start_dt, end_dt)
    accepted_bids, total_bids = await analytics_repository.seller_bid_acceptance(session, user.id, start_dt, end_dt)

    sold_kg = totals["sold_kg"]
    rev_period = totals["revenue_this_period"]
    avg_price = round(rev_period / max(1e-6, sold_kg), 2) if sold_kg > 0 else 0.0
    bid_acc_rate = round((accepted_bids / total_bids) * 100.0, 2) if total_bids > 0 else 0.0

    return SellerAnalyticsResponse(
        period_start=start_d,
        period_end=end_d,
        total_lots_created=totals["total_lots_created"],
        available_kg=totals["available_kg"],
        reserved_kg=totals["reserved_kg"],
        sold_kg=sold_kg,
        total_revenue=totals["total_revenue"],
        revenue_this_period=rev_period,
        avg_sale_price_per_kg=avg_price,
        bid_acceptance_rate=bid_acc_rate,
        pending_bids=totals["pending_bids"],
        open_orders=totals["open_orders"],
        revenue_by_day=[TimeSeriesPoint(date=d, value=v) for d, v in rev_day_rows],
        kg_sold_by_category=[
            CategoryBreakdown(category_id=cid, category_name=cname, quantity_kg=kg, count=cnt)
            for cid, cname, kg, cnt in cat_rows
        ],
        orders_by_status=[StatusBreakdown(status=s, count=c) for s, c in order_status_rows],
    )


async def admin_analytics(
    user: User,
    from_date: date | None,
    to_date: date | None,
    session: AsyncSession,
) -> AdminAnalyticsResponse:
    if _role_str(user) != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ADMIN role can access platform analytics.",
        )

    start_d, end_d, start_dt, end_dt = _resolve_period(from_date, to_date)

    totals = await analytics_repository.admin_totals(session, start_dt, end_dt)
    kg_day_rows = await analytics_repository.admin_kg_by_day(session, start_dt, end_dt)
    gmv_day_rows = await analytics_repository.admin_gmv_by_day(session, start_dt, end_dt)
    cat_rows = await analytics_repository.admin_kg_by_category(session, start_dt, end_dt)
    role_rows = await analytics_repository.admin_users_by_role(session)
    status_rows = await analytics_repository.admin_intakes_by_status(session, start_dt, end_dt)
    top_supps = await analytics_repository.admin_top_suppliers(session, start_dt, end_dt, limit=5)
    top_sells = await analytics_repository.admin_top_sellers(session, start_dt, end_dt, limit=5)

    return AdminAnalyticsResponse(
        period_start=start_d,
        period_end=end_d,
        total_intakes=totals["total_intakes"],
        total_kg_diverted=totals["total_kg_diverted"],
        total_co2e_saved_kg=totals["total_co2e_saved_kg"],
        total_gmv=totals["total_gmv"],
        active_users=totals["active_users"],
        active_suppliers=totals["active_suppliers"],
        active_recyclers=totals["active_recyclers"],
        total_households_served=totals["total_households_served"],
        kg_by_day=[TimeSeriesPoint(date=d, value=v) for d, v in kg_day_rows],
        gmv_by_day=[TimeSeriesPoint(date=d, value=v) for d, v in gmv_day_rows],
        kg_by_category=[
            CategoryBreakdown(category_id=cid, category_name=cname, quantity_kg=kg, count=cnt)
            for cid, cname, kg, cnt in cat_rows
        ],
        users_by_role=[StatusBreakdown(status=r, count=c) for r, c in role_rows],
        intakes_by_status=[StatusBreakdown(status=s, count=c) for s, c in status_rows],
        top_suppliers=top_supps,
        top_sellers=top_sells,
    )
