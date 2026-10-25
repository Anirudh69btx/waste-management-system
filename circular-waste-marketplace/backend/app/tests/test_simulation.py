"""Tests for GPS simulation service and celery task tick."""
import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta
import pytest

from app.core.settings import get_settings
from app.db.session import AsyncSessionLocal
from app.models import User, UserRole, Supplier, WasteIntake, PickupRequest
from app.models.vehicle import Vehicle
from app.models.trip import Trip, TripStop
from app.services.simulation_service import tick_simulation


@pytest.mark.asyncio
async def test_simulation_tick_disabled_returns_zero():
    settings = get_settings()
    orig = getattr(settings, "GPS_SIMULATION_ENABLED", "false")
    try:
        settings.GPS_SIMULATION_ENABLED = "false"
        async with AsyncSessionLocal() as session:
            count = await tick_simulation(session)
            assert count == 0
    finally:
        settings.GPS_SIMULATION_ENABLED = orig


@pytest.mark.asyncio
async def test_simulation_tick_active_trip_advances_vehicle():
    settings = get_settings()
    orig = getattr(settings, "GPS_SIMULATION_ENABLED", "false")
    try:
        settings.GPS_SIMULATION_ENABLED = "true"
        async with AsyncSessionLocal() as session:
            # 1. Driver
            driver = User(
                id=uuid.uuid4(),
                email=f"sim_driver_{uuid.uuid4().hex[:6]}@cwm.io",
                hashed_password="hash",
                full_name="Sim Driver",
                role=UserRole.LOGISTICS,
                is_active=True,
                is_verified=True,
            )
            session.add(driver)

            # 2. Vehicle
            plate = f"KA{uuid.uuid4().hex[:6].upper()}"
            vehicle = Vehicle(
                plate_number=plate,
                capacity_kg=Decimal("1500.00"),
                fuel_type="diesel",
                status="in_use",
                assigned_driver_user_id=driver.id,
                current_lat=Decimal("12.9700000"),
                current_lng=Decimal("77.5900000"),
            )
            session.add(vehicle)

            # 3. Supplier with coordinates
            supplier = Supplier(
                user_id=driver.id,
                business_name="Sim Target Supplier",
                registration_number=f"REG-{uuid.uuid4().hex[:8].upper()}",
                facility_address="100 Mission Road",
                latitude=12.9740,
                longitude=77.5940,
                contact_phone="+919876543210",
                verification_status="VERIFIED",
            )
            session.add(supplier)
            await session.flush()

            # 4. Intake
            intake = WasteIntake(
                supplier_id=supplier.id,
                category_id=34,
                batch_code=f"INT-{uuid.uuid4().hex[:6].upper()}",
                declared_weight_kg=100.0,
                qr_code_hash=uuid.uuid4().hex,
                purity_grade="GRADE_A",
                status="pickup_assigned",
            )
            session.add(intake)
            await session.flush()

            # 5. Pickup
            now = datetime.now(timezone.utc)
            pickup = PickupRequest(
                intake_id=intake.id,
                requested_by_user_id=driver.id,
                status="en_route",
                assigned_driver_user_id=driver.id,
                scheduled_start=now + timedelta(hours=1),
                scheduled_end=now + timedelta(hours=3),
            )
            session.add(pickup)
            await session.flush()

            # 6. Trip in progress with en_route stop
            trip = Trip(
                vehicle_id=vehicle.id,
                driver_user_id=driver.id,
                status="in_progress",
            )
            session.add(trip)
            await session.flush()

            stop = TripStop(
                trip_id=trip.id,
                pickup_request_id=pickup.id,
                sequence=1,
                status="en_route",
            )
            session.add(stop)
            await session.commit()

            # Execute simulation tick
            count = await tick_simulation(session)
            assert count >= 1

            # Verify vehicle position changed and last_ping_source is simulated
            await session.refresh(vehicle)
            assert vehicle.last_ping_source == "simulated"
            assert vehicle.current_lat != Decimal("12.9700000")
    finally:
        settings.GPS_SIMULATION_ENABLED = orig
