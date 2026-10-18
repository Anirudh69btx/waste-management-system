"""
Circular Waste Marketplace — Auth Service Re-export
===================================================
Re-exports AuthService from app.services.auth_service for clean import compatibility.
"""
from app.services.auth_service import AuthService

__all__ = ["AuthService"]
