"""
Circular Waste Marketplace — Dependencies Package
=================================================
"""
from app.dependencies.auth import (
    get_bearer_token,
    get_current_active_user,
    get_current_user,
    require_admin,
    require_any_authenticated,
    require_generator,
    require_logistics,
    require_recycler,
    require_roles,
)

__all__ = [
    "get_bearer_token",
    "get_current_user",
    "get_current_active_user",
    "require_roles",
    "require_admin",
    "require_generator",
    "require_recycler",
    "require_logistics",
    "require_any_authenticated",
]
