"""
Circular Waste Marketplace — Application Settings
=================================================
12-factor app configuration via pydantic-settings.
All values sourced from environment variables or .env file.
No secrets are hardcoded in this module.
"""
from __future__ import annotations

import json
from functools import lru_cache
from typing import Any, Literal

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        protected_namespaces=(),
    )

    # ── Application ──────────────────────────────────────────────────────────
    app_name: str = "Circular Waste Marketplace"
    app_env: Literal["development", "staging", "production"] = "development"
    app_debug: bool = False
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    api_v1_prefix: str = "/api/v1"

    # ── Security ─────────────────────────────────────────────────────────────
    secret_key: str = Field(
        default="change-me-64-character-dev-key-change-me-64-character-dev-key-change",
        validation_alias=AliasChoices("JWT_SECRET", "SECRET_KEY", "secret_key", "jwt_secret"),
    )
    refresh_token_secret: str = Field(
        default="change-me-64-character-refresh-key-change-me-64-character-refresh-ke",
        validation_alias=AliasChoices("REFRESH_TOKEN_SECRET", "refresh_token_secret"),
    )
    hmac_secret_key: str = "change-me-64-character-hmac-key-change-me-64-character-hmac-key-ch"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    algorithm: str = Field(
        default="HS256",
        validation_alias=AliasChoices("JWT_ALGORITHM", "ALGORITHM", "algorithm", "jwt_algorithm"),
    )
    allowed_origins: list[str] = Field(
        default=["http://localhost:5173", "http://localhost:3000"],
        validation_alias=AliasChoices("CORS_ORIGINS", "ALLOWED_ORIGINS", "allowed_origins", "cors_origins"),
    )

    # ── Auth Rate Limiting (slowapi / redis) ──────────────────────────────────
    auth_rate_limit_login: str = "10/minute"
    auth_rate_limit_register: str = "5/minute"
    auth_rate_limit_refresh: str = "30/minute"
    auth_rate_limit_storage_uri: str = "redis://redis:6379/3"

    # ── Database ─────────────────────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://cwm:cwm@localhost:5432/cwm"
    database_url_sync: str = "postgresql://cwm:cwm@localhost:5432/cwm"
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_recycle_seconds: int = 1800

    # ── Redis / Celery ────────────────────────────────────────────────────────
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/2"
    redis_tracking_channel_prefix: str = "tracking:transit:"

    # ── Storage ───────────────────────────────────────────────────────────────
    storage_backend: Literal["local", "s3", "minio"] = "local"
    local_upload_dir: str = Field(
        default="./static/uploads",
        validation_alias=AliasChoices("UPLOAD_DIR", "LOCAL_UPLOAD_DIR", "upload_dir", "local_upload_dir"),
    )
    s3_endpoint: str = ""
    s3_bucket: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_region: str = "ap-south-1"
    s3_public_url: str = ""
    s3_presigned_url_expire_seconds: int = 3600

    # ── Payments ──────────────────────────────────────────────────────────────
    payment_provider: Literal["stripe", "razorpay", "mock"] = "mock"
    platform_fee_percent: float = 2.5
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    mock_payment_delay_ms: int = 400
    checkout_hold_expire_minutes: int = 15

    # ── AI Engine ─────────────────────────────────────────────────────────────
    gemini_api_key: str = ""
    model_registry_path: str = "./ai_engine/models"
    waste_classifier_model: str = "waste_clf_v1.onnx"
    model_version: str = "v1.0.0"
    image_quality_min_score: float = 0.55
    image_quality_min_resolution: int = 512
    pricing_supply_demand_window_hours: int = 24
    fallback_to_heuristics: bool = True
    classifier_confidence_threshold: float = 0.60
    biogas_vs_fraction: float = 0.85
    biogas_bmp_m3_per_kg_vs: float = 0.35

    # ── Rewards ───────────────────────────────────────────────────────────────
    points_per_kg_grade_a: int = 10
    points_per_kg_grade_b: int = 7
    points_per_kg_grade_c: int = 4
    points_to_currency_rate: float = 0.01  # 100 pts = ₹1.00
    max_redemption_percent: float = 50.0

    # ── Upload Limits ─────────────────────────────────────────────────────────
    max_upload_file_size_mb: int = Field(
        default=10,
        validation_alias=AliasChoices("MAX_UPLOAD_MB", "MAX_UPLOAD_FILE_SIZE_MB", "max_upload_mb", "max_upload_file_size_mb"),
    )
    max_upload_files_per_intake: int = 5

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    rate_limit_requests_per_minute: int = 60
    rate_limit_auth_requests_per_minute: int = 10

    # ── Notifications ─────────────────────────────────────────────────────────
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "noreply@circular-waste-marketplace.io"
    smtp_tls: bool = True
    sms_provider: Literal["twilio", "msg91", "mock"] = "mock"

    # ── Observability ─────────────────────────────────────────────────────────
    log_level: str = "INFO"
    log_format: Literal["json", "console"] = "json"
    sentry_dsn: str = ""
    sentry_environment: str = "development"
    sentry_traces_sample_rate: float = 0.1
    prometheus_enabled: bool = True

    # ── Maps & Fleet Tracking ──────────────────────────────────────────────────
    maps_provider: Literal["osm", "mapbox", "google", "mock"] = "osm"
    mapbox_token: str = ""
    google_maps_api_key: str = ""
    telemetry_retention_days: int = 30
    map_tiles_provider: str = "osm"
    map_tiles_url_osm: str = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    gps_simulation_enabled: str = "true"
    gps_simulation_interval_seconds: int = 10
    gps_ping_retention_hours: int = 24
    vehicle_default_capacity_kg: int = 500
    route_search_max_stops: int = 10
    route_nearest_neighbor_start_lat: float = 19.0760
    route_nearest_neighbor_start_lng: float = 72.8777

    # ── Aliases & Derived properties ──────────────────────────────────────────
    @property
    def jwt_secret(self) -> str:
        return self.secret_key

    @property
    def jwt_algorithm(self) -> str:
        return self.algorithm

    @property
    def cors_origins(self) -> list[str]:
        return self.allowed_origins

    @property
    def upload_dir(self) -> str:
        return self.local_upload_dir

    @property
    def max_upload_mb(self) -> int:
        return self.max_upload_file_size_mb

    @property
    def is_production(self) -> bool:
        """True when running in production environment."""
        return self.app_env == "production"

    @property
    def GPS_SIMULATION_ENABLED(self) -> str:
        return self.gps_simulation_enabled

    @GPS_SIMULATION_ENABLED.setter
    def GPS_SIMULATION_ENABLED(self, value: str) -> None:
        self.gps_simulation_enabled = value

    @property
    def is_mock_payments_allowed(self) -> bool:
        """Mock payment endpoints must be disabled in production."""
        return not self.is_production

    @property
    def max_upload_bytes(self) -> int:
        """Maximum single-file upload size in bytes."""
        return self.max_upload_file_size_mb * 1024 * 1024

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_origins(cls, v: Any) -> list[str]:
        """Accept comma-separated string, JSON array string, or list."""
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                try:
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return [str(origin).strip() for origin in parsed if str(origin).strip()]
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        if isinstance(v, (list, tuple, set)):
            return [str(origin).strip() for origin in v if str(origin).strip()]
        return v

    @model_validator(mode="after")
    def validate_secrets(self) -> "Settings":
        """Enforce production security rules and CORS constraints."""
        if "*" in self.allowed_origins:
            raise ValueError("Wildcard CORS origin '*' is forbidden when credentials are enabled.")
        if self.is_production:
            if "change-me" in self.secret_key or "dev-only" in self.secret_key:
                raise ValueError("JWT_SECRET / SECRET_KEY must be changed from default in production.")
            if "change-me" in self.refresh_token_secret or "dev-only" in self.refresh_token_secret:
                raise ValueError("REFRESH_TOKEN_SECRET must be changed from default in production.")
            if self.refresh_token_secret == self.secret_key:
                raise ValueError("REFRESH_TOKEN_SECRET must be distinct from JWT_SECRET in production.")
            if "change-me" in self.hmac_secret_key:
                raise ValueError("HMAC_SECRET_KEY must be changed from default in production.")
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Return cached Settings singleton.

    Uses lru_cache so the .env file is read exactly once per process lifetime.
    In tests, call ``get_settings.cache_clear()`` to reload settings.
    """
    return Settings()
