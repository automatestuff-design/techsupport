from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import Transcript

router = APIRouter(prefix="/transcripts", tags=["transcripts"])


class TranscriptCreate(BaseModel):
    title: str
    content: str
    caller_name: str | None = None
    agent_name: str | None = None
    call_date: datetime | None = None
    category: str | None = None


class TranscriptResponse(BaseModel):
    id: int
    title: str
    content: str
    caller_name: str | None
    agent_name: str | None
    call_date: datetime | None
    category: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/", response_model=list[TranscriptResponse])
async def list_transcripts(
    skip: int = 0,
    limit: int = 50,
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Transcript).order_by(Transcript.created_at.desc()).offset(skip).limit(limit)
    if category:
        stmt = stmt.where(Transcript.category == category)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{transcript_id}", response_model=TranscriptResponse)
async def get_transcript(transcript_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Transcript).where(Transcript.id == transcript_id))
    transcript = result.scalar_one_or_none()
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    return transcript


@router.post("/", response_model=TranscriptResponse, status_code=201)
async def create_transcript(data: TranscriptCreate, db: AsyncSession = Depends(get_db)):
    transcript = Transcript(**data.model_dump())
    db.add(transcript)
    await db.commit()
    await db.refresh(transcript)
    return transcript


@router.put("/{transcript_id}", response_model=TranscriptResponse)
async def update_transcript(
    transcript_id: int, data: TranscriptCreate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Transcript).where(Transcript.id == transcript_id))
    transcript = result.scalar_one_or_none()
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    for field, value in data.model_dump().items():
        setattr(transcript, field, value)
    await db.commit()
    await db.refresh(transcript)
    return transcript


@router.delete("/{transcript_id}", status_code=204)
async def delete_transcript(transcript_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Transcript).where(Transcript.id == transcript_id))
    transcript = result.scalar_one_or_none()
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    await db.delete(transcript)
    await db.commit()


@router.get("/categories/list")
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Transcript.category).distinct().where(Transcript.category.isnot(None))
    )
    return [row[0] for row in result.all()]
