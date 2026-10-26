"""Seed eco_products (voucher catalog) for the rewards system.

Idempotent — skips existing titles.
Run: docker compose exec -T backend python /app/database/seed_eco_products.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from sqlalchemy import select
from app.core.settings import get_settings
from app.db.session import async_session_maker
from app.models.eco_store import EcoStoreProduct

PRODUCTS = [
    # (title, description, price, stock, category, unit, weight_kg, points_cost)
    ("Fortified Organic Compost (25kg)", "Circular compost from segregated municipal waste", 280.00, 450, "AGRICULTURE", "bag", 25.0, 500),
    ("Recycled PET Pellets (50kg)", "Extruded rPET pellets for injection molding", 1150.00, 120, "MANUFACTURING", "bag", 50.0, 2000),
    ("Compressed Biomethane Cylinder (14kg)", "Purified biomethane fuel (96% CH4)", 850.00, 80, "ENERGY", "canister", 14.0, 1500),
    ("RDF Alternative Fuel Pellets (1 ton)", "High-calorific fuel for cement kilns", 3200.00, 30, "ENERGY", "ton", 1000.0, 5000),
    ("Recycled Cotton Tote Bag", "Durable tote from post-consumer textile", 150.00, 200, "LIFESTYLE", "piece", 0.3, 300),
    ("Recycled Glass Tumbler Set (4)", "Cullet-sourced drinking glasses", 450.00, 100, "LIFESTYLE", "set", 1.2, 800),
    ("Grow-Your-Own Herb Kit", "Compost + seeds starter kit", 320.00, 150, "LIFESTYLE", "kit", 0.8, 600),
    ("Eco Cleaning Kit", "Refillable cleaning products in recycled packaging", 380.00, 100, "LIFESTYLE", "kit", 1.5, 700),
    ("Recycled Paper Notebook (A5)", "100% post-consumer paper journal", 95.00, 500, "LIFESTYLE", "piece", 0.2, 200),
    ("Tree Plantation Certificate (10 trees)", "Verified plantation with GPS-tracked saplings", 500.00, 999, "IMPACT", "cert", 0.0, 1000),
]


async def seed():
    settings = get_settings()
    if settings.app_env == "production":
        sys.exit("Refuses to run in production")
    async with async_session_maker() as session:
        existing = {row[0] for row in (await session.execute(select(EcoStoreProduct.title))).all()}
        inserted = 0
        for title, desc, price, stock, cat, unit, weight, points in PRODUCTS:
            if title in existing:
                print(f"Skipping (exists): {title}")
                continue
            p = EcoStoreProduct(
                title=title,
                description=desc,
                price=price,
                stock_quantity=stock,
                category=cat,
                unit=unit,
                weight_kg=weight,
                is_active=True,
                points_cost=points,
            )
            session.add(p)
            inserted += 1
            print(f"Inserted: {title}")
        await session.commit()
        print(f"Seeded {inserted} products")


if __name__ == "__main__":
    asyncio.run(seed())
