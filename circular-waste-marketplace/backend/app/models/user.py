"""Re-export User and UserRole from app.models for sub-module compatibility."""
from __future__ import annotations

from app.models import User, UserRole

__all__ = ["User", "UserRole"]
