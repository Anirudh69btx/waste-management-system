"""
Circular Waste Marketplace — Database Seed Script
==================================================
Seeds the database with baseline reference data and demo test accounts.

Seed Data:
1. Canonical Waste Categories (8 materials)
2. Production-like Pricing Rules per category
3. Role-based test users (admin, supplier, recycler/sorter, buyer, driver)
4. Eco-store products (compost, pellets, biogas canisters, RDF blocks)
5. Active marketplace listings

Usage:
    python database/seed.py
"""
import asyncio
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Add backend directory to sys.path so app imports work
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.settings import get_settings
from app.core.security import hash_password
from app.db.base import Base
from app.models import (
    User,
    UserRole,
    Supplier,
    WasteCategory,
    PricingRule,
    MarketplaceListing,
    ListingStatus,
    WastePurityGrade,
    EcoStoreProduct,
    RewardWallet,
)

settings = get_settings()


async def seed() -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    print("Connecting to database and verifying schema...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        print("Seeding canonical waste categories...")
        categories_data = [
            ("ORGANIC_BIOMASS", "Organic & Food Waste", "Fruit peels, vegetables, raw food scraps, biodegradable hotel waste", 3.50),
            ("PLASTIC_PET", "PET Plastics (Grade 1)", "Clean water bottles, soft drink containers, thermoformed sheets", 18.00),
            ("PAPER_CARDBOARD", "Corrugated Cardboard & Paper", "Corrugated shipping cartons, clean kraft paper, shredded paper", 9.50),
            ("FERROUS_METAL", "Ferrous Scrap Metal", "Tin cans, steel straps, light iron scrap, construction rebar offcuts", 28.00),
            ("GLASS", "Cullet & Bottle Glass", "Flint (clear), amber, and green glass beverage containers", 4.00),
            ("E_WASTE", "Electronic Waste (Non-hazardous)", "Printed circuit boards, cables, adapters, obsolete IT peripherals", 65.00),
            ("HAZARDOUS", "Industrial Hazardous Waste", "Battery scrap, paint sludge, used oil containers (manifest regulated)", 12.00),
            ("TEXTILE", "Industrial Textile & Fabric Offcuts", "Cotton rags, synthetic trimmings, apparel factory spinning waste", 14.00),
        ]

        cat_map: dict[str, WasteCategory] = {}
        for code, name, desc, base_price in categories_data:
            cat = WasteCategory(code=code, name=name, description=desc, base_price_per_kg=base_price, is_active=True)
            session.add(cat)
            cat_map[code] = cat

        await session.flush()

        print("Seeding demo users...")
        users = [
            ("admin@cwm.io", "Platform Administrator", UserRole.ADMIN, "CWM Operations Central", "+919876543210"),
            ("supplier@cwm.io", "Green Earth Organics Ltd", UserRole.GENERATOR, "Green Earth Farms & Food", "+919876543211"),
            ("sorter@cwm.io", "Apex Sorting Hub", UserRole.RECYCLER, "Apex Resource Recovery", "+919876543212"),
            ("buyer@cwm.io", "BioPower Industrial Corp", UserRole.RECYCLER, "BioPower Energy Solutions", "+919876543213"),
            ("driver@cwm.io", "Ramesh Kumar (Logistics)", UserRole.LOGISTICS, "City Green Fleet Logistics", "+919876543214"),
        ]

        user_map: dict[str, User] = {}
        for email, name, role, org, phone in users:
            u = User(
                email=email,
                hashed_password=hash_password("Password123!@#"),
                full_name=name,
                role=role,
                organization_name=org,
                phone_number=phone,
                is_active=True,
                is_verified=True,
            )
            session.add(u)
            user_map[email] = u

        await session.flush()

        print("Seeding supplier profile & reward wallet...")
        supplier_user = user_map["supplier@cwm.io"]
        supplier_profile = Supplier(
            user_id=supplier_user.id,
            business_name="Green Earth Organics Ltd",
            business_type="Commercial Restaurant / Agro",
            tax_id="27AAACG0123M1Z5",
            pickup_address="Plot 42, Agro Industrial Estate, Sector 18",
            latitude=19.0760,
            longitude=72.8777,
            is_verified=True,
        )
        session.add(supplier_profile)

        # Rewards wallet for supplier
        wallet = RewardWallet(
            user_id=supplier_user.id,
            points_balance=1250,
            lifetime_points=4500,
            streak_days=14,
        )
        session.add(wallet)

        print("Seeding pricing rules...")
        for code, cat in cat_map.items():
            rule = PricingRule(
                category_id=cat.id,
                base_benchmark=cat.base_price_per_kg,
                floor_price=round(cat.base_price_per_kg * 0.5, 2),
                ceiling_price=round(cat.base_price_per_kg * 1.8, 2),
                moisture_benchmark_percent=8.0 if "ORGANIC" in code else 2.0,
                moisture_penalty_per_percent=0.015,
                contamination_benchmark_percent=1.0,
                contamination_penalty_per_percent=0.03,
                effective_from=datetime.now(timezone.utc),
            )
            session.add(rule)

        print("Seeding active marketplace feedstock listings...")
        sorter_user = user_map["sorter@cwm.io"]
        listings_data = [
            ("High-Purity PET Flakes (Washed)", "PLASTIC_PET", WastePurityGrade.GRADE_A, 2500.0, 24.50, "Baled and pre-washed cold PET flakes, <100ppm PVC"),
            ("Shredded Organic Compost Feedstock", "ORGANIC_BIOMASS", WastePurityGrade.GRADE_A, 5000.0, 4.20, "Screened organic mass ideal for industrial vermicompost or anaerobic digestion"),
            ("OCC Baled Cardboard Mill Spec", "PAPER_CARDBOARD", WastePurityGrade.GRADE_A, 8000.0, 11.00, "Baled corrugated containers, dry warehouse stored"),
            ("Clean Aluminum & Light Steel Scrap", "FERROUS_METAL", WastePurityGrade.GRADE_B, 3200.0, 31.00, "Segregated ferrous scrap, ready for electric arc induction smelting"),
        ]

        for title, cat_code, grade, qty, price, notes in listings_data:
            listing = MarketplaceListing(
                seller_id=sorter_user.id,
                category_id=cat_map[cat_code].id,
                title=title,
                purity_grade=grade,
                quantity_kg=qty,
                price_per_kg=price,
                status=ListingStatus.ACTIVE,
                pickup_latitude=19.0800,
                pickup_longitude=72.8850,
                pickup_address="Apex Aggregation Yard 3, Navi Mumbai",
                notes=notes,
            )
            session.add(listing)

        print("Seeding Eco-Store circular products...")
        eco_products = [
            ("Fortified Organic Humus Compost (25kg)", "Enriched circular compost derived from segregated municipal vegetable and flower waste.", 280.00, 450, "AGRICULTURE", "kg", 25.0),
            ("High-Density Recycled Plastic Pellets (50kg)", "Extruded rPET pellets for injection moulding, packaging trays and polyester yarn.", 1150.00, 120, "MANUFACTURING", "kg", 50.0),
            ("Compressed Bio-Methane Cylinder (14kg)", "Purified circular biomethane fuel (96% CH4) generated from biomethanation facilities.", 850.00, 80, "ENERGY", "canister", 14.0),
            ("Refuse-Derived Fuel (RDF) Pellets (1 Ton)", "High-calorific alternative fuel pellets for industrial cement kilns and thermal boilers.", 3200.00, 30, "ENERGY", "ton", 1000.0),
        ]

        for title, desc, price, stock, cat_name, unit, weight in eco_products:
            prod = EcoStoreProduct(
                title=title,
                description=desc,
                price=price,
                stock_quantity=stock,
                category=cat_name,
                unit=unit,
                weight_kg=weight,
                is_active=True,
            )
            session.add(prod)

        await session.commit()
        print("Database seeding completed successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
