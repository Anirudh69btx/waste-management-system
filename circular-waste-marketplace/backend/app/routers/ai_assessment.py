"""AI Assessment router — /api/v1/ai/..."""
from __future__ import annotations
import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.security import require_role, TokenPayload
from app.db.session import get_async_session
from app.schemas import WasteAssessmentResponse
from app.services.ai_assessment import AIAssessmentService

router = APIRouter(prefix="/ai", tags=["AI Assessment"])

@router.get("/assessments/{intake_id}", response_model=WasteAssessmentResponse)
async def get_assessment(
    intake_id: uuid.UUID,
    token: TokenPayload = Depends(require_role(["GENERATOR", "RECYCLER", "ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> WasteAssessmentResponse:
    """Fetch AI quality assessment result for an intake."""
    return await AIAssessmentService(db).get_by_intake_id(intake_id)

@router.post("/assessments/{intake_id}/retry")
async def retry_assessment(
    intake_id: uuid.UUID,
    token: TokenPayload = Depends(require_role(["ADMIN"])),
    db: AsyncSession = Depends(get_async_session),
) -> dict[str, str]:
    """Force-re-queue an AI assessment Celery task (admin only)."""
    await AIAssessmentService(db).enqueue_assessment(intake_id)
    return {"status": "queued", "intake_id": str(intake_id)}
