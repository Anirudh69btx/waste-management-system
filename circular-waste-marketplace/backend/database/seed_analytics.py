"""Seed 90 days of historical analytics data for demo dashboards.

Idempotent: skips if data already exists for a given (user, day) pair.
Dev-only: refuses to run if APP_ENV=production.

Run:
    docker compose exec -T backend python /app/database/seed_analytics.py
    docker compose exec -T backend python /app/database/seed_analytics.py --reset  # wipe seeded rows first
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import random
import secrets
import sys
import uuid
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
from pathlib import Path

# Ensure /app is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.settings import get_settings
from app.models import (
    Bid,
    InventoryLot,
    ListingType,
    MarketplaceListing,
    PurchaseOrder,
    SortingRecord,
    Supplier,
    TraceabilityEvent,
    User,
    UserRole,
    WasteCategory,
    WasteIntake,
    WastePurityGrade,
    WeightTicket,
)
from app.services.intake import _generate_batch_code

SEED_TAG = "seed-analytics-3.3a"
SEED_SCALE_ID = "SEED-SCALE-3.3A"
SEED_BID_PREFIX = "[seeded-3.3a]"


def _seeded_batch_code(dt: datetime, used: set[str]) -> str:
    """Generate a unique batch code using _generate_batch_code format with historical date."""
    base = _generate_batch_code()
    suffix = base.split("-")[-1]
    code = f"BATCH-{dt.strftime('%Y%m%d')}-{suffix}"
    while code in used:
        code = f"BATCH-{dt.strftime('%Y%m%d')}-{secrets.token_hex(4).upper()}"
    used.add(code)
    return code


async def _reset_seeded_data(session) -> None:
    """Delete only rows created by this seed script in reverse FK dependency order."""
    await session.execute(
        delete(PurchaseOrder).where(PurchaseOrder.request_id_correlation == SEED_TAG)
    )
    await session.execute(
        delete(Bid).where(Bid.message.like(f"{SEED_BID_PREFIX}%"))
    )
    await session.execute(
        delete(MarketplaceListing).where(MarketplaceListing.listing_code.like("LST-SEED-%"))
    )
    await session.execute(
        delete(InventoryLot).where(InventoryLot.lot_code.like("LOT-SEED-%"))
    )
    await session.execute(
        delete(SortingRecord).where(SortingRecord.request_id_correlation == SEED_TAG)
    )
    await session.execute(
        delete(WeightTicket).where(WeightTicket.scale_id == SEED_SCALE_ID)
    )
    await session.execute(
        delete(TraceabilityEvent).where(TraceabilityEvent.request_id == SEED_TAG)
    )
    await session.execute(
        delete(WasteIntake).where(
            text("metadata->>'seeded' = 'true'")
        )
    )
    await session.commit()
    print("Reset complete: wiped existing seeded analytics rows.")


async def run_seed(reset: bool = False) -> None:
    settings = get_settings()
    if settings.app_env.lower() == "production":
        sys.exit("Refuses to run in production")

    rng = random.Random(3301)
    engine = create_async_engine(settings.database_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    try:
        async with session_factory() as session:
            if reset:
                await _reset_seeded_data(session)

            # Load categories (33..40)
            cat_rows = (
                await session.execute(
                    select(WasteCategory).where(WasteCategory.is_active.is_(True)).order_by(WasteCategory.id)
                )
            ).scalars().all()
            if not cat_rows:
                sys.exit("No waste_categories found in database.")
            category_ids = [c.id for c in cat_rows]
            cat_factor = {c.id: float(c.carbon_offset_factor or 1.5) for c in cat_rows}

            # Load existing suppliers (prioritize non-synthetic GENERATOR users first, cap at 15 for ~2000 intakes)
            supp_stmt = (
                select(Supplier, User)
                .join(User, User.id == Supplier.user_id)
                .where(User.role == UserRole.GENERATOR)
                .order_by(
                    User.email.like("%@test.%").asc(),
                    Supplier.created_at.asc(),
                )
                .limit(15)
            )
            supp_pairs = (await session.execute(supp_stmt)).all()
            if not supp_pairs:
                # Fallback to any suppliers if none matched GENERATOR
                supp_only = (await session.execute(select(Supplier).limit(15))).scalars().all()
                suppliers = supp_only
            else:
                suppliers = [row[0] for row in supp_pairs]

            # Load existing recyclers & admins
            recyclers = (
                await session.execute(
                    select(User)
                    .where(User.role == UserRole.RECYCLER, User.is_active.is_(True))
                    .order_by(User.email.like("%@test.%").asc(), User.created_at.asc())
                    .limit(10)
                )
            ).scalars().all()
            admins = (
                await session.execute(
                    select(User)
                    .where(User.role == UserRole.ADMIN, User.is_active.is_(True))
                    .limit(5)
                )
            ).scalars().all()

            if not suppliers or not recyclers:
                sys.exit("Need at least 1 supplier and 1 recycler in database before seeding analytics.")

            # Existing seeded (supplier_id, date) pairs for idempotency
            existing_rows = (
                await session.execute(
                    select(WasteIntake.supplier_id, func.date(WasteIntake.created_at))
                    .where(text("metadata->>'seeded' = 'true'"))
                )
            ).all()
            existing_pairs: set[tuple[uuid.UUID, str]] = {
                (r[0], str(r[1])) for r in existing_rows
            }

            used_batch_codes: set[str] = set()
            now_utc = datetime.now(timezone.utc)
            today_date = now_utc.date()

            total_intakes = 0
            total_tickets = 0
            total_lots = 0
            total_listings = 0
            total_orders = 0

            grades = [WastePurityGrade.GRADE_A, WastePurityGrade.GRADE_B, WastePurityGrade.GRADE_C]
            grade_strs = ["GRADE_A", "GRADE_B", "GRADE_C"]
            price_by_cat = {
                33: 4.5,
                34: 22.0,
                35: 11.5,
                36: 30.0,
                37: 5.5,
                38: 68.0,
                39: 15.0,
                40: 16.0,
            }

            for day_offset in range(89, -1, -1):
                day_date = today_date - timedelta(days=day_offset)
                day_iso = day_date.isoformat()

                day_intakes: list[WasteIntake] = []
                day_tickets: list[WeightTicket] = []
                day_records: list[SortingRecord] = []
                day_lots: list[InventoryLot] = []
                day_listings: list[MarketplaceListing] = []
                day_bids: list[Bid] = []
                day_orders: list[PurchaseOrder] = []
                day_events: list[TraceabilityEvent] = []

                for s_idx, supplier in enumerate(suppliers):
                    if (supplier.id, day_iso) in existing_pairs:
                        continue

                    # Primary supplier gets 1-3 batches every day for unbroken streak; others get 0-3
                    if s_idx == 0:
                        num_intakes = rng.choices([1, 2, 3], weights=[40, 40, 20])[0]
                    else:
                        num_intakes = rng.choices([0, 1, 2, 3], weights=[20, 35, 30, 15])[0]

                    for _ in range(num_intakes):
                        hour = rng.randint(6, 21)
                        minute = rng.randint(0, 59)
                        second = rng.randint(0, 59)
                        created_dt = datetime.combine(
                            day_date, time(hour, minute, second), tzinfo=timezone.utc
                        )
                        if created_dt > now_utc:
                            created_dt = now_utc - timedelta(minutes=rng.randint(5, 120))

                        cat_id = rng.choice(category_ids)
                        grade_enum = rng.choices(grades, weights=[55, 30, 15])[0]
                        # Weight 5-500 kg, weighted toward 8-35 kg so 90d total is ~18-24 tonnes
                        if rng.random() < 0.90:
                            declared_kg = round(rng.uniform(6.0, 26.0), 2)
                        else:
                            declared_kg = round(rng.uniform(28.0, 120.0), 2)

                        bucket = rng.random()
                        if bucket < 0.60:
                            lifecycle = "completed"
                            intake_status = "sorted"
                        elif bucket < 0.80:
                            lifecycle = "weighed"
                            intake_status = "weighed"
                        elif bucket < 0.90:
                            lifecycle = "picked_up"
                            intake_status = "picked_up"
                        elif bucket < 0.95:
                            lifecycle = "submitted"
                            intake_status = "submitted"
                        else:
                            lifecycle = "cancelled"
                            intake_status = rng.choice(["cancelled", "rejected"])

                        intake_id = uuid.uuid4()
                        batch_code = _seeded_batch_code(created_dt, used_batch_codes)
                        qr_hash = hashlib.sha256(
                            f"{batch_code}|{supplier.id}|{declared_kg:.4f}".encode()
                        ).hexdigest()

                        verified_kg: float | None = None
                        discrepancy_kg: float | None = None
                        verified_at: datetime | None = None
                        sorter_user = rng.choice(recyclers)

                        if lifecycle in ("completed", "weighed"):
                            factor = rng.uniform(0.94, 1.04)
                            verified_kg = round(max(5.0, declared_kg * factor), 2)
                            discrepancy_kg = round(verified_kg - declared_kg, 2)
                            verified_at = created_dt + timedelta(hours=rng.randint(1, 4))

                        intake = WasteIntake(
                            id=intake_id,
                            batch_code=batch_code,
                            supplier_id=supplier.id,
                            category_id=cat_id,
                            purity_grade=grade_enum,
                            declared_weight_kg=declared_kg,
                            verified_weight_kg=verified_kg,
                            weight_discrepancy_kg=discrepancy_kg,
                            status=intake_status,
                            qr_code_hash=qr_hash,
                            image_paths=[],
                            notes="Historical analytics seed consignment",
                            scale_operator_id=sorter_user.id if verified_kg is not None else None,
                            verified_at=verified_at,
                            metadata_json={"seeded": True, "seed_tag": SEED_TAG, "seed_day": day_iso},
                            created_at=created_dt,
                            updated_at=verified_at or created_dt,
                        )
                        day_intakes.append(intake)
                        total_intakes += 1

                        day_events.append(
                            TraceabilityEvent(
                                id=uuid.uuid4(),
                                batch_id=intake_id,
                                event_type="batch.submitted",
                                from_status=None,
                                to_status="submitted",
                                actor_user_id=supplier.user_id,
                                actor_role="GENERATOR",
                                metadata_json={"seeded": True, "declared_weight_kg": declared_kg},
                                request_id=SEED_TAG,
                                created_at=created_dt,
                            )
                        )

                        if lifecycle in ("completed", "weighed") and verified_kg is not None and verified_at is not None:
                            tare_dec = Decimal(str(round(rng.uniform(10.0, 25.0), 3)))
                            net_dec = Decimal(str(round(verified_kg, 3)))
                            gross_dec = tare_dec + net_dec

                            wt = WeightTicket(
                                id=uuid.uuid4(),
                                intake_id=intake_id,
                                pickup_request_id=None,
                                weight_method="digital_scale",
                                gross_weight_kg=gross_dec,
                                tare_weight_kg=tare_dec,
                                net_weight_kg=net_dec,
                                scale_id=SEED_SCALE_ID,
                                photo_paths=[],
                                recorded_by_user_id=sorter_user.id,
                                recorded_at=verified_at,
                                discrepancy_flag=abs(verified_kg - declared_kg) / declared_kg > 0.15,
                                supplier_confirmed_at=verified_at + timedelta(minutes=30),
                                created_at=verified_at,
                                updated_at=verified_at,
                            )
                            day_tickets.append(wt)
                            total_tickets += 1

                            day_events.append(
                                TraceabilityEvent(
                                    id=uuid.uuid4(),
                                    batch_id=intake_id,
                                    event_type="weight.recorded",
                                    from_status="picked_up",
                                    to_status="weighed",
                                    actor_user_id=sorter_user.id,
                                    actor_role="RECYCLER",
                                    metadata_json={"seeded": True, "net_weight_kg": float(net_dec)},
                                    request_id=SEED_TAG,
                                    created_at=verified_at,
                                )
                            )

                        if lifecycle == "completed" and verified_kg is not None and verified_at is not None:
                            sorted_dt = verified_at + timedelta(hours=rng.randint(1, 3))
                            input_dec = Decimal(str(round(verified_kg, 3)))
                            reject_ratio = rng.uniform(0.02, 0.08)
                            rejected_val = round(verified_kg * reject_ratio, 3)
                            sorted_val = round(verified_kg - rejected_val, 3)
                            sorted_dec = Decimal(str(sorted_val))
                            rejected_dec = Decimal(str(rejected_val))
                            contam_dec = Decimal(str(round(rng.uniform(1.0, 7.5), 2)))
                            moisture_dec = Decimal(str(round(rng.uniform(4.0, 12.0), 2)))
                            sort_grade_str = grade_enum.value if grade_enum.value in grade_strs else "GRADE_A"

                            sr_id = uuid.uuid4()
                            sr = SortingRecord(
                                id=sr_id,
                                intake_id=intake_id,
                                sorter_user_id=sorter_user.id,
                                input_weight_kg=input_dec,
                                sorted_weight_kg=sorted_dec,
                                rejected_weight_kg=rejected_dec,
                                contamination_percent=contam_dec,
                                sort_grade=sort_grade_str,
                                moisture_percent=moisture_dec,
                                notes="Seeded sorting run",
                                photos=[],
                                request_id_correlation=SEED_TAG,
                                created_at=sorted_dt,
                                updated_at=sorted_dt,
                            )
                            day_records.append(sr)

                            day_events.append(
                                TraceabilityEvent(
                                    id=uuid.uuid4(),
                                    batch_id=intake_id,
                                    event_type="sorting.completed",
                                    from_status="weighed",
                                    to_status="sorted",
                                    actor_user_id=sorter_user.id,
                                    actor_role="RECYCLER",
                                    metadata_json={"seeded": True, "sorted_weight_kg": float(sorted_dec)},
                                    request_id=SEED_TAG,
                                    created_at=sorted_dt,
                                )
                            )

                            # 1-2 inventory lots per sorting record
                            num_lots = rng.choices([1, 2], weights=[65, 35])[0]
                            lot_weights: list[float] = []
                            if num_lots == 1:
                                lot_weights = [sorted_val]
                            else:
                                w1 = round(sorted_val * rng.uniform(0.45, 0.65), 3)
                                w2 = round(max(1.0, sorted_val - w1), 3)
                                lot_weights = [w1, w2]

                            for l_w in lot_weights:
                                lot_id = uuid.uuid4()
                                lot_code = f"LOT-SEED-{secrets.token_hex(5).upper()}"
                                lot_qty_dec = Decimal(str(l_w))
                                will_order = rng.random() < 0.52
                                lot_status = rng.choice(["sold", "reserved"]) if will_order else "available"
                                avail_dec = Decimal("0.000") if lot_status == "sold" else lot_qty_dec

                                lot = InventoryLot(
                                    id=lot_id,
                                    lot_code=lot_code,
                                    intake_id=intake_id,
                                    sorting_record_id=sr_id,
                                    category_id=cat_id,
                                    quantity_kg=lot_qty_dec,
                                    available_kg=avail_dec,
                                    grade=sort_grade_str,
                                    contamination_percent=contam_dec,
                                    moisture_percent=moisture_dec,
                                    status=lot_status,
                                    hub_location="Mumbai Central Sorting Hub",
                                    created_at=sorted_dt,
                                    updated_at=sorted_dt,
                                )
                                day_lots.append(lot)
                                total_lots += 1

                                # Create MarketplaceListing for this lot
                                listing_id = uuid.uuid4()
                                listing_code = f"LST-SEED-{secrets.token_hex(5).upper()}"
                                base_p = price_by_cat.get(cat_id, 15.0)
                                unit_price = round(base_p * rng.uniform(0.9, 1.25), 2)
                                floor_price = round(unit_price * 0.7, 2)
                                min_order_kg = round(max(1.0, l_w * 0.25), 2)
                                co2_total = round(l_w * cat_factor.get(cat_id, 1.5), 2)
                                listing_dt = sorted_dt + timedelta(minutes=rng.randint(15, 90))

                                listing = MarketplaceListing(
                                    id=listing_id,
                                    listing_code=listing_code,
                                    seller_id=sorter_user.id,
                                    inventory_lot_id=lot_id,
                                    category_id=cat_id,
                                    title=f"Certified {sort_grade_str.replace('_', ' ')} Feedstock Lot",
                                    description="Seeded secondary raw material lot",
                                    purity_grade=grade_enum,
                                    listing_type=ListingType.FIXED_PRICE,
                                    available_quantity_kg=max(1.0, l_w),
                                    min_order_quantity_kg=min_order_kg,
                                    unit_price_per_kg=unit_price,
                                    calculated_floor_price=floor_price,
                                    estimated_co2_offset_total=co2_total,
                                    status="sold" if lot_status == "sold" else "active",
                                    created_at=listing_dt,
                                    updated_at=listing_dt,
                                )
                                day_listings.append(listing)
                                total_listings += 1

                                # Pick a buyer distinct from seller if possible
                                other_recyclers = [r for r in recyclers if r.id != sorter_user.id]
                                buyer_user = rng.choice(other_recyclers) if other_recyclers else sorter_user

                                # 35% of listings get 1-2 bids
                                if rng.random() < 0.35:
                                    for b_i in range(rng.randint(1, 2)):
                                        bid_price = Decimal(str(round(unit_price * rng.uniform(0.75, 0.98), 2)))
                                        bid_qty = Decimal(str(l_w))
                                        bid_tot = (bid_price * bid_qty).quantize(Decimal("0.01"))
                                        bid_status = "accepted" if (will_order and b_i == 0) else rng.choice(["pending", "rejected"])
                                        day_bids.append(
                                            Bid(
                                                id=uuid.uuid4(),
                                                listing_id=listing_id,
                                                buyer_user_id=buyer_user.id,
                                                bid_price_per_kg=bid_price,
                                                quantity_kg=bid_qty,
                                                total_amount=bid_tot,
                                                message=f"{SEED_BID_PREFIX} Automated procurement bid",
                                                status=bid_status,
                                                created_at=listing_dt + timedelta(minutes=20 + b_i * 10),
                                                updated_at=listing_dt + timedelta(minutes=30 + b_i * 10),
                                            )
                                        )

                                if will_order:
                                    order_dt = listing_dt + timedelta(hours=rng.randint(1, 4))
                                    order_status = rng.choices(
                                        ["completed", "delivered", "shipped", "escrow_held", "pending_payment", "cancelled"],
                                        weights=[50, 15, 10, 15, 5, 5],
                                    )[0]
                                    u_price_dec = Decimal(str(unit_price))
                                    total_amt_dec = (lot_qty_dec * u_price_dec).quantize(Decimal("0.01"))
                                    escrow_dt = order_dt + timedelta(minutes=15) if order_status in ("escrow_held", "shipped", "delivered", "completed") else None
                                    comp_dt = order_dt + timedelta(hours=2) if order_status == "completed" else None

                                    po = PurchaseOrder(
                                        id=uuid.uuid4(),
                                        order_code=f"ORD-SEED-{secrets.token_hex(5).upper()}",
                                        listing_id=listing_id,
                                        buyer_user_id=buyer_user.id,
                                        seller_user_id=sorter_user.id,
                                        quantity_kg=lot_qty_dec,
                                        unit_price=u_price_dec,
                                        total_amount=total_amt_dec,
                                        currency="INR",
                                        status=order_status,
                                        escrow_held_at=escrow_dt,
                                        completed_at=comp_dt,
                                        cancellation_reason="Seeded cancellation" if order_status == "cancelled" else None,
                                        request_id_correlation=SEED_TAG,
                                        created_at=order_dt,
                                        updated_at=comp_dt or escrow_dt or order_dt,
                                    )
                                    day_orders.append(po)
                                    total_orders += 1

                                    day_events.append(
                                        TraceabilityEvent(
                                            id=uuid.uuid4(),
                                            batch_id=intake_id,
                                            event_type="order.completed" if order_status == "completed" else "order.created",
                                            from_status="sorted",
                                            to_status="sold" if order_status == "completed" else "listed",
                                            actor_user_id=buyer_user.id,
                                            actor_role="RECYCLER",
                                            metadata_json={"seeded": True, "order_status": order_status},
                                            request_id=SEED_TAG,
                                            created_at=order_dt,
                                        )
                                    )

                if day_intakes:
                    session.add_all(day_intakes)
                    await session.flush()
                if day_tickets:
                    session.add_all(day_tickets)
                if day_records:
                    session.add_all(day_records)
                    await session.flush()
                if day_lots:
                    session.add_all(day_lots)
                    await session.flush()
                if day_listings:
                    session.add_all(day_listings)
                    await session.flush()
                if day_bids:
                    session.add_all(day_bids)
                if day_orders:
                    session.add_all(day_orders)
                if day_events:
                    session.add_all(day_events)

                await session.commit()

            print(
                f"Seeded: {total_intakes} intakes, {total_tickets} weight tickets, "
                f"{total_lots} lots, {total_listings} listings, {total_orders} orders across 90 days"
            )
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed 90 days of analytics data.")
    parser.add_argument("--reset", action="store_true", help="Wipe previously seeded analytics rows first.")
    args = parser.parse_args()
    asyncio.run(run_seed(reset=args.reset))


if __name__ == "__main__":
    main()
