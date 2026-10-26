"""Backfill synthetic AI assessments for demo browsing.

Creates assessment rows for recent weighed/sorted/listed intakes that don't
already have one. Uses category-aware heuristics so data looks realistic
(e.g., ORGANIC gets higher contamination, PLASTIC gets higher confidence).

Idempotent: skips intakes that already have an assessment.
Dev-only: refuses to run if APP_ENV=production.

Run:
    docker compose exec -T backend python /app/database/seed_assessments.py
    docker compose exec -T backend python /app/database/seed_assessments.py --limit 200
"""
import asyncio
import hashlib
import sys
import random
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from app.core.settings import get_settings
from app.db.session import async_session_maker
from app.models import WasteIntake, WasteCategory, WasteAssessment

# Category-aware realism profiles
PROFILES = {
    "ORGANIC_BIOMASS": {"purity": (60, 85), "conf": (0.72, 0.90), "contam_prob": 0.7,
                        "contam_options": ["food residue", "plastic film", "moisture"]},
    "PLASTIC_PET":     {"purity": (85, 98), "conf": (0.88, 0.98), "contam_prob": 0.4,
                        "contam_options": ["labels", "caps", "oil residue"]},
    "PAPER_CARDBOARD": {"purity": (75, 95), "conf": (0.82, 0.95), "contam_prob": 0.5,
                        "contam_options": ["tape", "staples", "moisture staining"]},
    "FERROUS_METAL":   {"purity": (90, 99), "conf": (0.90, 0.99), "contam_prob": 0.2,
                        "contam_options": ["rust", "paint", "plastic attachments"]},
    "GLASS":           {"purity": (80, 96), "conf": (0.84, 0.96), "contam_prob": 0.35,
                        "contam_options": ["mixed colors", "labels", "ceramic shards"]},
    "E_WASTE":         {"purity": (70, 92), "conf": (0.75, 0.90), "contam_prob": 0.45,
                        "contam_options": ["batteries", "cables mixed", "damaged boards"]},
    "HAZARDOUS":       {"purity": (65, 88), "conf": (0.70, 0.85), "contam_prob": 0.6,
                        "contam_options": ["unlabeled container", "leaking", "mixed materials"]},
    "TEXTILE":         {"purity": (72, 93), "conf": (0.78, 0.92), "contam_prob": 0.4,
                        "contam_options": ["mixed fabrics", "stains", "non-textile trimmings"]},
}

def grade_for_purity(p: float) -> str:
    if p >= 90: return "A"
    if p >= 75: return "B"
    return "C"

async def seed(limit: int = 100):
    settings = get_settings()
    if settings.app_env == "production":
        sys.exit("Refuses to run in production")

    async with async_session_maker() as session:
        # Recent intakes without assessments
        stmt = (
            select(WasteIntake)
            .where(WasteIntake.status.in_(["weighed", "sorted", "listed", "sold"]))
            .order_by(WasteIntake.created_at.desc())
            .limit(limit)
        )
        intakes = (await session.execute(stmt)).scalars().all()

        existing_ids = set(
            (await session.execute(select(WasteAssessment.intake_id))).scalars().all()
        )

        # Category code lookup
        cat_rows = (await session.execute(select(WasteCategory.id, WasteCategory.code))).all()
        cat_code_map = {row[0]: row[1] for row in cat_rows}

        inserted = 0
        for intake in intakes:
            if intake.id in existing_ids:
                continue
            code = cat_code_map.get(intake.category_id, "PLASTIC_PET")
            profile = PROFILES.get(code, PROFILES["PLASTIC_PET"])

            purity = round(random.uniform(*profile["purity"]), 1)
            confidence = round(random.uniform(*profile["conf"]), 3)
            has_contam = random.random() < profile["contam_prob"]
            contam_details = (
                random.sample(profile["contam_options"],
                              k=random.randint(1, min(2, len(profile["contam_options"]))))
                if has_contam else []
            )

            assessment = WasteAssessment(
                id=uuid.uuid4(),
                intake_id=intake.id,
                detected_category=code,
                confidence_score=confidence,
                estimated_purity_percentage=purity,
                contamination_detected=has_contam,
                contamination_details=contam_details,
                suggested_purity_grade=grade_for_purity(purity),
                model_version="waste-classifier-v1.2",
                input_hash=hashlib.sha256(str(intake.id).encode()).hexdigest(),
                latency_ms=random.randint(180, 850),
                raw_ai_response={"seeded": True, "note": "synthetic for demo"},
                created_at=intake.created_at,
            )
            session.add(assessment)
            inserted += 1

        await session.commit()
        print(f"Seeded {inserted} assessments (skipped {len(intakes) - inserted} existing)")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=100)
    args = parser.parse_args()
    asyncio.run(seed(args.limit))
