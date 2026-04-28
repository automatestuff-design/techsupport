import csv
import io
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from auth import get_current_user
from database import get_db
from models import Transcript

router = APIRouter(
    prefix="/transcripts",
    tags=["transcripts"],
    dependencies=[Depends(get_current_user)],
)


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


@router.get("/categories/list")
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Transcript.category).distinct().where(Transcript.category.isnot(None))
    )
    return [row[0] for row in result.all()]


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


CSV_COLUMNS = ["title", "content", "caller_name", "agent_name", "call_date", "category"]


@router.post("/upload-csv")
async def upload_transcripts_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv")

    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))

    if not reader.fieldnames or "title" not in reader.fieldnames or "content" not in reader.fieldnames:
        raise HTTPException(
            status_code=422,
            detail=f"CSV must have at least 'title' and 'content' columns. Found: {reader.fieldnames}",
        )

    created, skipped = 0, 0
    errors: list[str] = []

    for i, row in enumerate(reader, start=2):
        title = (row.get("title") or "").strip()
        content = (row.get("content") or "").strip()
        if not title or not content:
            skipped += 1
            errors.append(f"Row {i}: skipped (missing title or content)")
            continue

        call_date = None
        raw_date = (row.get("call_date") or "").strip()
        if raw_date:
            for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y"):
                try:
                    call_date = datetime.strptime(raw_date, fmt)
                    break
                except ValueError:
                    continue

        db.add(Transcript(
            title=title,
            content=content,
            caller_name=(row.get("caller_name") or "").strip() or None,
            agent_name=(row.get("agent_name") or "").strip() or None,
            call_date=call_date,
            category=(row.get("category") or "").strip() or None,
        ))
        created += 1

    await db.commit()
    return {"created": created, "skipped": skipped, "errors": errors}


_DOC_EXTENSIONS = {".pdf", ".docx", ".jpg", ".jpeg", ".png", ".gif", ".webp"}
_IMAGE_MEDIA_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}
_MAX_FILE_BYTES = 20 * 1024 * 1024  # 20 MB


@router.post("/upload-doc", response_model=TranscriptResponse, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Extract text from a PDF, Word document, or image and save it as a transcript."""
    from services.document_service import (
        extract_text_from_pdf,
        extract_text_from_docx,
        extract_from_image,
        generate_metadata,
    )

    filename = file.filename or "document"
    ext = Path(filename).suffix.lower()

    if ext not in _DOC_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Supported: PDF, DOCX, JPG, PNG, GIF, WEBP.",
        )

    data = await file.read()
    if len(data) > _MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 20 MB.")

    if ext == ".pdf":
        content = extract_text_from_pdf(data)
        if not content or len(content) < 50:
            raise HTTPException(
                status_code=422,
                detail="Could not extract text from this PDF — it may be image-based. Try uploading a screenshot instead.",
            )
        meta = await generate_metadata(content, filename)

    elif ext == ".docx":
        content = extract_text_from_docx(data)
        if not content:
            raise HTTPException(status_code=422, detail="Could not extract text from this document.")
        meta = await generate_metadata(content, filename)

    else:  # image
        media_type = _IMAGE_MEDIA_TYPES[ext]
        meta = await extract_from_image(data, media_type, filename)
        content = meta.get("content") or ""
        if not content:
            raise HTTPException(status_code=422, detail="Could not extract content from this image.")

    title = (meta.get("title") or Path(filename).stem.replace("_", " ").replace("-", " ").title())[:200]
    category = meta.get("category") or None

    transcript = Transcript(title=title, content=content, category=category)
    db.add(transcript)
    await db.commit()
    await db.refresh(transcript)
    return transcript
