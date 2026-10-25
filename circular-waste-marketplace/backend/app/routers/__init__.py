"""Routers package."""
from __future__ import annotations

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
from app.routers.fleet import router as fleet_router
from app.routers import fleet
from app.routers import sorting
from app.routers import marketplace
from app.routers import traceability

__all__ = [
    "fleet_router",
    "fleet",
    "sorting",
    "marketplace",
    "traceability",
]
