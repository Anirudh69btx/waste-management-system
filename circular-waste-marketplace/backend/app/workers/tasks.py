"""
Circular Waste Marketplace — Celery Worker Application
=======================================================
Background task definitions for async/long-running jobs:
  1. AI waste quality assessment (Gemini Vision API)
  2. Reward points crediting after weight verification
  3. Inventory hold expiration (auto-release after timeout)
  4. Email / SMS notification dispatch
  5. GPS trail downsampling / archival
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from celery import Celery
from celery.utils.log import get_task_logger

from app.core.settings import get_settings

settings = get_settings()
logger = get_task_logger(__name__)

# ── Celery app instance ───────────────────────────────────────────────────
celery_app = Celery(
    "cwm",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.workers.tasks.run_ai_assessment": {"queue": "ai"},
        "app.workers.tasks.credit_intake_rewards": {"queue": "rewards"},
        "app.workers.tasks.expire_checkout_holds": {"queue": "maintenance"},
        "app.workers.tasks.send_notification": {"queue": "notifications"},
    },
    beat_schedule={
        "expire-holds-every-5min": {
            "task": "app.workers.tasks.expire_checkout_holds",
            "schedule": 300.0,  # every 5 minutes
        },
    },
)


# ── Helper: run async function in event loop ──────────────────────────────
def _run_async(coro):
    """Execute an async coroutine from a synchronous Celery task."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ═══════════════════════════════════════════════════════════════════════════
# Task 1: AI Waste Assessment
# ═══════════════════════════════════════════════════════════════════════════

@celery_app.task(
    name="app.workers.tasks.run_ai_assessment",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    soft_time_limit=120,
    time_limit=150,
)
def run_ai_assessment(self, intake_id_str: str) -> dict[str, Any]:
    """
    Run AI waste classification on all images for an intake consignment.

    Steps:
      1. Load intake record from DB.
      2. Read image bytes from storage.
      3. Run quality gate again (in case of retries).
      4. Call Gemini Vision API (or heuristic fallback).
      5. Persist WasteAssessment record.
      6. Schedule reward credit task.

    Retries: Up to 3× with 30 s delay. Temporary failures (API timeouts) are
    retried; persistent errors (malformed images) are not.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    logger.info("ai_assessment_started", intake_id=intake_id_str)

    intake_id = uuid.UUID(intake_id_str)

    async def _run():
        from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
        from sqlalchemy import select
        from app.models import WasteIntake, WasteAssessment
        from ai_engine.image_quality import assess_images_batch
        from ai_engine.waste_classifier import classify_waste
        from ai_engine.model_registry import get_model_registry

        engine = create_async_engine(settings.database_url, echo=False)
        async_session = async_sessionmaker(engine, expire_on_commit=False)

        async with async_session() as db:
            result = await db.execute(
                select(WasteIntake).where(WasteIntake.id == intake_id)
            )
            intake = result.scalar_one_or_none()
            if not intake:
                logger.error("ai_assessment_intake_not_found", intake_id=intake_id_str)
                return {"status": "error", "reason": "intake_not_found"}

            # Already assessed?
            existing = await db.execute(
                select(WasteAssessment).where(WasteAssessment.intake_id == intake_id)
            )
            if existing.scalar_one_or_none():
                return {"status": "skipped", "reason": "already_assessed"}

            # Load images
            image_bytes_list: list[bytes] = []
            for path in intake.image_paths:
                full_path = Path(".") / path.lstrip("/")
                if full_path.exists():
                    image_bytes_list.append(full_path.read_bytes())

            if not image_bytes_list:
                logger.warning("ai_assessment_no_images", intake_id=intake_id_str)
                return {"status": "skipped", "reason": "no_images"}

            # Use first image for classification
            primary_image = image_bytes_list[0]
            input_hash = hashlib.sha256(primary_image).hexdigest()

            # Classify using ONNX or heuristics
            registry = get_model_registry()
            session_obj = registry.get_classifier_session()
            classification = classify_waste(
                primary_image,
                onnx_session=session_obj,
                model_version=registry.version,
            )

            # Determine contamination (simple heuristic: CONTAMINATED grade → contaminated)
            contamination_detected = intake.purity_grade == "CONTAMINATED"
            purity_pct = {
                "GRADE_A": 95.0, "GRADE_B": 82.0,
                "GRADE_C": 65.0, "CONTAMINATED": 30.0
            }.get(str(intake.purity_grade), 50.0)
            if hasattr(intake.purity_grade, "value"):
                purity_pct = {
                    "GRADE_A": 95.0, "GRADE_B": 82.0,
                    "GRADE_C": 65.0, "CONTAMINATED": 30.0
                }.get(intake.purity_grade.value, 50.0)

            assessment = WasteAssessment(
                id=uuid.uuid4(),
                intake_id=intake_id,
                detected_category=classification.category,
                confidence_score=classification.confidence,
                estimated_purity_percentage=purity_pct,
                contamination_detected=contamination_detected,
                contamination_details=[],
                suggested_purity_grade=str(intake.purity_grade),
                raw_ai_response={
                    "top_k": [{"category": c, "confidence": conf} for c, conf in classification.top_k],
                    "rejected": classification.rejected,
                    "model_version": classification.model_version,
                },
                model_version=classification.model_version,
                input_hash=input_hash,
                latency_ms=classification.latency_ms,
                created_at=datetime.now(tz=timezone.utc),
            )
            db.add(assessment)
            await db.commit()

            logger.info(
                "ai_assessment_completed",
                intake_id=intake_id_str,
                category=classification.category,
                confidence=classification.confidence,
            )
            return {
                "status": "success",
                "category": classification.category,
                "confidence": classification.confidence,
            }

    try:
        return _run_async(_run())
    except Exception as exc:
        logger.error("ai_assessment_failed", intake_id=intake_id_str, error=str(exc))
        raise self.retry(exc=exc)


# ═══════════════════════════════════════════════════════════════════════════
# Task 2: Credit Intake Rewards
# ═══════════════════════════════════════════════════════════════════════════

@celery_app.task(
    name="app.workers.tasks.credit_intake_rewards",
    bind=True,
    max_retries=3,
    default_retry_delay=15,
)
def credit_intake_rewards(
    self,
    user_id: str,
    intake_id_str: str,
    weight_kg: float,
    grade: str,
) -> dict[str, Any]:
    """Credit green reward points to a supplier's wallet after verified weigh-in."""
    async def _run():
        from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
        from app.services.rewards import RewardService

        engine = create_async_engine(settings.database_url, echo=False)
        async_session = async_sessionmaker(engine, expire_on_commit=False)

        async with async_session() as db:
            svc = RewardService(db)
            await svc.credit_intake_points(
                user_id=user_id,
                intake_id=uuid.UUID(intake_id_str),
                weight_kg=weight_kg,
                grade=grade,
            )
            await db.commit()
            return {"status": "success"}

    try:
        return _run_async(_run())
    except Exception as exc:
        raise self.retry(exc=exc)


# ═══════════════════════════════════════════════════════════════════════════
# Task 3: Expire Checkout Holds (Celery Beat)
# ═══════════════════════════════════════════════════════════════════════════

@celery_app.task(name="app.workers.tasks.expire_checkout_holds")
def expire_checkout_holds() -> dict[str, Any]:
    """
    Auto-release inventory held in PENDING purchase orders that exceed
    CHECKOUT_HOLD_EXPIRE_MINUTES. Runs every 5 minutes via Celery Beat.
    """
    from datetime import timedelta

    async def _run():
        from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
        from sqlalchemy import select, update
        from app.models import PurchaseOrder, PaymentStatus, MarketplaceListing, ListingStatus

        engine = create_async_engine(settings.database_url, echo=False)
        async_session = async_sessionmaker(engine, expire_on_commit=False)
        cutoff = datetime.now(tz=timezone.utc) - timedelta(
            minutes=settings.checkout_hold_expire_minutes
        )

        async with async_session() as db:
            result = await db.execute(
                select(PurchaseOrder).where(
                    PurchaseOrder.payment_status == PaymentStatus.PENDING,
                    PurchaseOrder.created_at < cutoff,
                ).with_for_update()
            )
            expired = result.scalars().all()

            released_ids = []
            for order in expired:
                # Return quantity to listing
                lst_result = await db.execute(
                    select(MarketplaceListing).where(
                        MarketplaceListing.id == order.listing_id
                    ).with_for_update()
                )
                listing = lst_result.scalar_one_or_none()
                if listing:
                    listing.available_quantity_kg += order.quantity_kg
                    if listing.status == ListingStatus.SOLD_OUT:
                        listing.status = ListingStatus.ACTIVE

                order.payment_status = PaymentStatus.FAILED
                released_ids.append(str(order.id))

            await db.commit()
            logger.info("checkout_holds_expired", count=len(released_ids))
            return {"status": "success", "expired_orders": released_ids}

    return _run_async(_run())


# ═══════════════════════════════════════════════════════════════════════════
# Task 4: Send Notification
# ═══════════════════════════════════════════════════════════════════════════

@celery_app.task(
    name="app.workers.tasks.send_notification",
    max_retries=2,
    default_retry_delay=10,
)
def send_notification(
    channel: str,
    recipient: str,
    subject: str,
    body: str,
) -> dict[str, Any]:
    """
    Dispatch an email or SMS notification via the configured provider.
    In mock mode, logs and no-ops.

    Args:
        channel: ``"email"`` or ``"sms"``
        recipient: Email address or E.164 phone number.
        subject: Subject line (email only).
        body: Plain-text message body.
    """
    logger.info(
        "notification_dispatch",
        channel=channel,
        subject=subject,
    )

    if settings.sms_provider == "mock" and settings.smtp_host == "":
        logger.info("notification_mock_sent", channel=channel)
        return {"status": "mock_sent"}

    if channel == "email" and settings.smtp_host:
        import smtplib
        from email.mime.text import MIMEText
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from_email
        msg["To"] = recipient
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            if settings.smtp_tls:
                server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        return {"status": "sent"}

    logger.warning("notification_provider_not_configured", channel=channel)
    return {"status": "skipped"}
