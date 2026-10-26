"""Points engine + transaction ledger + streak tracking (Segment 3.3b)."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models import EcoOrder, EcoProduct, RewardTransaction, RewardWallet, Supplier

logger = get_logger(__name__)

EARN_RATES: dict[str, int] = {
    "per_kg_submitted": 10,         # 10 pts per verified kg
    "per_completed_pickup": 50,     # 50 pts flat per pickup completed
    "per_kg_sold": 5,               # 5 pts per kg sold
    "streak_bonus_7d": 100,
    "streak_bonus_14d": 250,
    "streak_bonus_30d": 500,
}


def _today() -> date:
    """Return current UTC date (separate helper for clean test monkeypatching)."""
    return datetime.now(timezone.utc).date()


def _extract_user_id(user_or_id: Any) -> uuid.UUID:
    if isinstance(user_or_id, uuid.UUID):
        return user_or_id
    if isinstance(user_or_id, str):
        return uuid.UUID(user_or_id)
    if hasattr(user_or_id, "id") and user_or_id.id is not None:
        return user_or_id.id if isinstance(user_or_id.id, uuid.UUID) else uuid.UUID(str(user_or_id.id))
    if hasattr(user_or_id, "sub") and user_or_id.sub is not None:
        return uuid.UUID(str(user_or_id.sub))
    raise ValueError(f"Cannot extract user_id from {type(user_or_id)}")


async def get_or_create_wallet(user_or_id: Any, session: AsyncSession) -> RewardWallet:
    """Ensure one RewardWallet exists for the user and return it."""
    uid = _extract_user_id(user_or_id)
    res = await session.execute(select(RewardWallet).where(RewardWallet.user_id == uid))
    wallet = res.scalar_one_or_none()
    if wallet is not None:
        # Keep legacy columns and 3.3b columns synchronized if legacy had points
        if wallet.points_balance == 0 and wallet.available_points > 0:
            wallet.points_balance = wallet.available_points
        if wallet.lifetime_points == 0 and wallet.lifetime_earned > 0:
            wallet.lifetime_points = wallet.lifetime_earned
        return wallet

    wallet = RewardWallet(
        id=uuid.uuid4(),
        user_id=uid,
        points_balance=0,
        lifetime_points=0,
        streak_days=0,
        last_submission_date=None,
        available_points=0,
        lifetime_earned=0,
        lifetime_redeemed=0,
    )
    session.add(wallet)
    await session.commit()
    await session.refresh(wallet)
    return wallet


async def award_points(
    user_id: Any,
    points: int,
    transaction_type: str,
    description: str,
    session: AsyncSession,
    reference_type: str | None = None,
    reference_id: uuid.UUID | None = None,
    metadata: dict[str, Any] | None = None,
    request_id: str | None = None,
    commit: bool = True,
) -> RewardTransaction:
    """Append an idempotent RewardTransaction and update wallet balances."""
    uid = _extract_user_id(user_id)

    # Idempotency check on (reference_type, reference_id, transaction_type)
    if reference_type is not None and reference_id is not None:
        existing_q = select(RewardTransaction).where(
            RewardTransaction.user_id == uid,
            RewardTransaction.reference_type == reference_type,
            RewardTransaction.reference_id == reference_id,
            RewardTransaction.transaction_type == transaction_type,
        )
        existing_res = await session.execute(existing_q)
        existing_tx = existing_res.scalar_one_or_none()
        if existing_tx is not None:
            return existing_tx

    wallet = await get_or_create_wallet(uid, session)

    tx = RewardTransaction(
        id=uuid.uuid4(),
        wallet_id=wallet.id,
        user_id=uid,
        intake_id=None,
        order_id=None,
        points_delta=points,
        transaction_type=transaction_type,
        reference_type=reference_type,
        reference_id=reference_id,
        description=description[:255],
        metadata_json=metadata or {},
    )
    session.add(tx)

    wallet.points_balance = (wallet.points_balance or 0) + points
    wallet.available_points = wallet.points_balance
    if points > 0:
        wallet.lifetime_points = (wallet.lifetime_points or 0) + points
        wallet.lifetime_earned = wallet.lifetime_points
    elif points < 0:
        wallet.lifetime_redeemed = (wallet.lifetime_redeemed or 0) + abs(points)

    if commit:
        await session.commit()
        await session.refresh(tx)
        await session.refresh(wallet)

    logger.info(
        "rewards.awarded",
        user_id=str(uid),
        points_delta=points,
        transaction_type=transaction_type,
        reference_type=reference_type,
        reference_id=str(reference_id) if reference_id else None,
        request_id=request_id,
    )
    return tx


async def record_submission_streak(
    user_id: Any,
    session: AsyncSession,
    submission_date: date | None = None,
    request_id: str | None = None,
) -> RewardWallet:
    """Update user's consecutive-day submission streak and award milestone bonuses (7/14/30d)."""
    uid = _extract_user_id(user_id)
    wallet = await get_or_create_wallet(uid, session)
    today = submission_date or _today()
    prev_streak = wallet.streak_days or 0

    if wallet.last_submission_date == today:
        # Same calendar day — streak unchanged
        return wallet
    elif wallet.last_submission_date == today - timedelta(days=1):
        wallet.streak_days = prev_streak + 1
    else:
        wallet.streak_days = 1

    wallet.last_submission_date = today
    await session.flush()

    if wallet.streak_days in (7, 14, 30) and wallet.streak_days != prev_streak:
        bonus_key = f"streak_bonus_{wallet.streak_days}d"
        bonus_pts = EARN_RATES.get(bonus_key, 0)
        if bonus_pts > 0:
            await award_points(
                user_id=uid,
                points=bonus_pts,
                transaction_type="earn_streak_bonus",
                description=f"{wallet.streak_days}-day submission streak bonus",
                session=session,
                reference_type="streak",
                reference_id=None,
                metadata={"streak_days": wallet.streak_days, "date": today.isoformat()},
                request_id=request_id,
                commit=False,
            )

    await session.commit()
    await session.refresh(wallet)
    return wallet


async def on_intake_weighed(
    intake: Any,
    session: AsyncSession,
    request_id: str | None = None,
    submission_date: date | None = None,
) -> RewardTransaction | None:
    """Award points and update streak when an intake consignment is weighed."""
    if not isinstance(session, AsyncSession):
        return None

    user_id: uuid.UUID | None = None
    if getattr(intake, "supplier", None) is not None and getattr(intake.supplier, "user_id", None):
        user_id = intake.supplier.user_id
    elif getattr(intake, "supplier_id", None) is not None:
        res = await session.execute(
            select(Supplier.user_id).where(Supplier.id == intake.supplier_id)
        )
        user_id = res.scalar_one_or_none()
    elif getattr(intake, "user_id", None) is not None:
        user_id = intake.user_id

    if user_id is None:
        return None

    verified_kg = float(getattr(intake, "verified_weight_kg", None) or getattr(intake, "declared_weight_kg", 0) or 0)
    points = int(verified_kg * EARN_RATES["per_kg_submitted"])
    if points <= 0:
        return None

    await record_submission_streak(
        user_id=user_id,
        session=session,
        submission_date=submission_date,
        request_id=request_id,
    )

    batch_code = getattr(intake, "batch_code", None) or str(intake.id)[:8]
    return await award_points(
        user_id=user_id,
        points=points,
        transaction_type="earn_intake",
        description=f"Verified weight reward for batch {batch_code} ({verified_kg:.1f} kg)",
        session=session,
        reference_type="intake",
        reference_id=intake.id,
        metadata={"verified_weight_kg": verified_kg, "batch_code": str(batch_code)},
        request_id=request_id,
    )


async def on_pickup_completed(
    pickup: Any,
    session: AsyncSession,
    request_id: str | None = None,
) -> RewardTransaction | None:
    """Award 50 flat points to the supplier when a pickup reaches completed status."""
    if not isinstance(session, AsyncSession):
        return None

    user_id = getattr(pickup, "requested_by_user_id", None)
    if user_id is None and getattr(pickup, "intake", None) and getattr(pickup.intake, "supplier", None):
        user_id = pickup.intake.supplier.user_id
    if user_id is None:
        return None

    points = EARN_RATES["per_completed_pickup"]
    return await award_points(
        user_id=user_id,
        points=points,
        transaction_type="earn_intake",
        description="Completed waste pickup bonus",
        session=session,
        reference_type="pickup",
        reference_id=pickup.id,
        metadata={"pickup_id": str(pickup.id)},
        request_id=request_id,
    )


async def on_order_completed(
    order: Any,
    session: AsyncSession,
    request_id: str | None = None,
) -> RewardTransaction | None:
    """Award points to the seller when a marketplace order is completed."""
    if not isinstance(session, AsyncSession):
        return None

    seller_id = getattr(order, "seller_user_id", None)
    if seller_id is None:
        return None

    qty_kg = float(getattr(order, "quantity_kg", 0) or 0)
    points = int(qty_kg * EARN_RATES["per_kg_sold"])
    if points <= 0:
        return None

    order_code = getattr(order, "order_code", str(order.id)[:8])
    return await award_points(
        user_id=seller_id,
        points=points,
        transaction_type="earn_sale",
        description=f"Marketplace sale completed: {order_code} ({qty_kg:.1f} kg)",
        session=session,
        reference_type="order",
        reference_id=order.id,
        metadata={"order_code": order_code, "quantity_kg": qty_kg},
        request_id=request_id,
    )


async def redeem_voucher(
    user_or_id: Any,
    product_id: uuid.UUID,
    session: AsyncSession,
    request_id: str | None = None,
) -> EcoOrder:
    """Atomically deduct points, decrement stock, and create an EcoOrder voucher redemption."""
    uid = _extract_user_id(user_or_id)

    prod_res = await session.execute(
        select(EcoProduct).where(EcoProduct.id == product_id)
    )
    product = prod_res.scalar_one_or_none()
    if product is None or not product.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Eco product not found",
        )

    if product.stock_quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Eco product is out of stock",
        )

    wallet = await get_or_create_wallet(uid, session)
    if wallet.points_balance < product.points_cost:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Insufficient points: required {product.points_cost}, available {wallet.points_balance}",
        )

    order_id = uuid.uuid4()
    year = datetime.now(timezone.utc).year
    order_code = f"ECO-{year}-{uuid.uuid4().hex[:6].upper()}"

    product.stock_quantity -= 1

    await award_points(
        user_id=uid,
        points=-product.points_cost,
        transaction_type="redeem_voucher",
        description=f"Redeemed voucher: {product.title}",
        session=session,
        reference_type="eco_product",
        reference_id=order_id,
        metadata={
            "product_id": str(product.id),
            "product_title": product.title,
            "order_code": order_code,
        },
        request_id=request_id,
        commit=False,
    )

    order = EcoOrder(
        id=order_id,
        order_code=order_code,
        user_id=uid,
        product_id=product.id,
        product_title=product.title,
        points_paid=product.points_cost,
        status="pending",
        gross_amount=float(product.price or 0),
        points_discount_amount=float(product.price or 0),
        net_payable_amount=0.0,
        shipping_address="Voucher Redemption",
        items_snapshot=[
            {
                "product_id": str(product.id),
                "title": product.title,
                "points_cost": product.points_cost,
            }
        ],
    )
    session.add(order)
    await session.commit()
    await session.refresh(order)

    logger.info(
        "rewards.voucher_redeemed",
        user_id=str(uid),
        order_id=str(order.id),
        order_code=order_code,
        product_id=str(product.id),
        points_paid=product.points_cost,
        request_id=request_id,
    )
    return order


async def list_transactions(
    user_or_id: Any,
    session: AsyncSession,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[RewardTransaction], int]:
    """Return paginated reward transactions for a user."""
    uid = _extract_user_id(user_or_id)
    await get_or_create_wallet(uid, session)

    count_res = await session.execute(
        select(func.count(RewardTransaction.id)).where(RewardTransaction.user_id == uid)
    )
    total = int(count_res.scalar_one() or 0)

    items_res = await session.execute(
        select(RewardTransaction)
        .where(RewardTransaction.user_id == uid)
        .order_by(RewardTransaction.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(items_res.scalars().all()), total


async def list_products(session: AsyncSession) -> tuple[list[EcoProduct], int]:
    """Return active voucher products ordered by points_cost ascending."""
    items_res = await session.execute(
        select(EcoProduct)
        .where(EcoProduct.is_active.is_(True))
        .order_by(EcoProduct.points_cost.asc(), EcoProduct.title.asc())
    )
    items = list(items_res.scalars().all())
    return items, len(items)


async def list_user_orders(
    user_or_id: Any,
    session: AsyncSession,
) -> tuple[list[EcoOrder], int]:
    """Return user's redeemed voucher orders ordered by newest first."""
    uid = _extract_user_id(user_or_id)
    items_res = await session.execute(
        select(EcoOrder)
        .where(EcoOrder.user_id == uid, EcoOrder.product_id.is_not(None))
        .order_by(EcoOrder.created_at.desc())
    )
    items = list(items_res.scalars().all())
    return items, len(items)
