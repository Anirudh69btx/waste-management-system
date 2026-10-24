"""Remaining routers — thin wrappers delegating to services."""
from __future__ import annotations
# Suppliers, Intake, Tracking, Sorting, Marketplace, Pricing, Payments,
# Rewards, Eco-Store, Analytics, AI Assessment, Pickup, Weight Ticket routers.
# Each router: zero business logic, only DI wiring + schema validation.

from fastapi import APIRouter

from app.routers.suppliers import router as _s
from app.routers.intake import router as _i
from app.routers.pickup import router as _p
from app.routers.weight_ticket import router as _wt
from app.routers.tracking import router as _t
from app.routers.sorting import router as _so
from app.routers.marketplace import router as _m
from app.routers.pricing import router as _pr
from app.routers.payments import router as _pay
from app.routers.rewards import router as _r
from app.routers.eco_store import router as _e
from app.routers.analytics import router as _a
from app.routers.ai_assessment import router as _ai
from app.routers.health import router as _h
