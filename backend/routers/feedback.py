from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import SearchFeedback, SearchQuery
from services.ai_service import process_feedback

router = APIRouter(prefix="/feedback", tags=["feedback"])


class FeedbackCreate(BaseModel):
    query_id: int
    was_helpful: bool
    transcript_id: int | None = None


@router.post("/", status_code=201)
async def submit_feedback(data: FeedbackCreate, db: AsyncSession = Depends(get_db)):
    # Validate query exists
    result = await db.execute(select(SearchQuery).where(SearchQuery.id == data.query_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Search query not found")

    feedback = SearchFeedback(
        query_id=data.query_id,
        transcript_id=data.transcript_id,
        was_helpful=data.was_helpful,
    )
    db.add(feedback)
    await db.flush()

    # Trigger learning pipeline
    await process_feedback(data.query_id, data.was_helpful, db)

    return {"status": "ok", "feedback_id": feedback.id}
