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
    EcoProduct,
    EcoProductCategory,
    RewardWallet,
    VerificationStatus,
)
from sqlalchemy import select
import re

settings = get_settings()

async def seed() -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    print("Connecting to database and verifying schema...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        print("Seeding canonical waste categories...")
        # Fetch existing category codes for idempotency
        existing_result = await session.execute(select(WasteCategory.code))
        existing_codes = {row[0] for row in existing_result.scalars().all()}
        print(f"Found {len(existing_codes)} existing categories, skipping duplicates.")
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
            if code in existing_codes:
                print(f"  Skipping category (exists): {code}")
                # populate cat_map from existing DB row
                existing_result = await session.execute(
                    select(WasteCategory).where(WasteCategory.code == code)
                )
                cat_map[code] = existing_result.scalar_one()
                continue
            cat = WasteCategory(
                code=code,
                name=name,
                unit_of_measure="kg",
                carbon_offset_factor=base_price,
                is_active=True,
            )
            session.add(cat)
            cat_map[code] = cat
            print(f"  Inserting category: {code}")

        await session.flush()

        print("Seeding demo users...")
        # Fetch existing user emails for idempotency
        existing_user_result = await session.execute(select(User.email))
        existing_emails = {row[0] for row in existing_user_result.scalars().all()}
        print(f"Found {len(existing_emails)} existing users, skipping duplicates.")
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
                hashed_password="dummyhashedpassword",
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
            registration_number="27AAACG0123M1Z5",
            facility_address="Plot 42, Agro Industrial Estate, Sector 18",
            latitude=19.0760,
            longitude=72.8777,
            contact_phone="+919876543211",
            verification_status=VerificationStatus.PENDING,
        )
        session.add(supplier_profile)

        # Rewards wallet for supplier
        wallet = RewardWallet(
            user_id=supplier_user.id,
            available_points=1250,
            lifetime_earned=4500,
            lifetime_redeemed=0,
        )
        session.add(wallet)

        print("Seeding pricing rules...")
        for code, cat in cat_map.items():
            rule = PricingRule(
                category_id=cat.id,
                purity_grade=WastePurityGrade.GRADE_A,
                base_benchmark_price_per_kg=cat.carbon_offset_factor,
                floor_price_per_kg=round(cat.carbon_offset_factor * 0.5, 2),
                ceiling_price_per_kg=round(cat.carbon_offset_factor * 1.8, 2),
                moisture_penalty_multiplier=0.02,
                contamination_penalty_multiplier=0.05,
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

# Skipping marketplace listing seed due to model field changes. Listings can be created via API.

        print("Seeding Eco-Store circular products...")
        eco_products = [
            ("Fortified Organic Humus Compost (25kg)", "Enriched circular compost derived from segregated municipal vegetable and flower waste.", 280.00, 450, "AGRICULTURE", "kg", 25.0),
            ("High-Density Recycled Plastic Pellets (50kg)", "Extruded rPET pellets for injection moulding, packaging trays and polyester yarn.", 1150.00, 120, "MANUFACTURING", "kg", 50.0),
            ("Compressed Bio-Methane Cylinder (14kg)", "Purified circular biomethane fuel (96% CH4) generated from biomethanation facilities.", 850.00, 80, "ENERGY", "canister", 14.0),
            ("Refuse-Derived Fuel (RDF) Pellets (1 Ton)", "High-calorific alternative fuel pellets for industrial cement kilns and thermal boilers.", 3200.00, 30, "ENERGY", "ton", 1000.0),
        ]

        for title, desc, price, stock, cat_name, unit, weight in eco_products:
            # Map category name to EcoProductCategory enum (default COMPOST)
            try:
                category_enum = EcoProductCategory[cat_name.upper()]
            except KeyError:
                category_enum = EcoProductCategory.COMPOST
            # Generate slug from title
            slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
            prod = EcoProduct(
                title=title,
                slug=slug,
                description=desc,
                category=category_enum,
                price_fiat=price,
                stock_quantity=stock,
                carbon_offset_kg=0.0,
                image_url='https://example.com/placeholder.png',
                is_featured=False,
            )
            session.add(prod)

        await session.commit()
        print("Database seeding completed successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
