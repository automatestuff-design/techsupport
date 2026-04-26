import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models import SearchQuery, Transcript
from services.ai_service import get_knowledge_stats, search_with_ai

router = APIRouter(
    prefix="/search",
    tags=["search"],
    dependencies=[Depends(get_current_user)],
)


class SearchRequest(BaseModel):
    query: str
    limit: int = 10


class SearchResult(BaseModel):
    transcript_id: int
    title: str
    snippet: str
    category: str | None
    call_date: str | None
    relevance_score: float


class SearchResponse(BaseModel):
    query_id: int
    query: str
    results: list[SearchResult]
    ai_answer: str
    confidence: float
    from_knowledge_base: bool
    knowledge_entry_id: int | None
    is_recurring: bool
    source_transcript_ids: list[int]


def _snippet(content: str, query: str, length: int = 300) -> str:
    """Return a snippet of content around the first query term match."""
    lower = content.lower()
    terms = query.lower().split()
    pos = -1
    for term in terms:
        idx = lower.find(term)
        if idx != -1:
            pos = idx
            break
    if pos == -1:
        return content[:length] + ("..." if len(content) > length else "")
    start = max(0, pos - 100)
    end = min(len(content), pos + length)
    snippet = ("..." if start > 0 else "") + content[start:end]
    snippet += "..." if end < len(content) else ""
    return snippet


def _score(transcript: Transcript, terms: list[str]) -> float:
    """Simple TF-style relevance score."""
    text = (transcript.title + " " + transcript.content).lower()
    hits = sum(text.count(t) for t in terms)
    # Boost title matches
    title_hits = sum(transcript.title.lower().count(t) for t in terms) * 3
    return hits + title_hits


@router.post("/", response_model=SearchResponse)
async def search(req: SearchRequest, db: AsyncSession = Depends(get_db)):
    terms = [t for t in req.query.lower().split() if len(t) > 2]

    # Full-text keyword search via SQLite LIKE
    if terms:
        conditions = [
            or_(
                Transcript.title.ilike(f"%{term}%"),
                Transcript.content.ilike(f"%{term}%"),
            )
            for term in terms
        ]
        stmt = select(Transcript).where(or_(*conditions)).limit(req.limit * 3)
    else:
        stmt = select(Transcript).limit(req.limit)

    result = await db.execute(stmt)
    candidates = result.scalars().all()

    # Sort by relevance
    scored = sorted(candidates, key=lambda t: _score(t, terms), reverse=True)
    top = scored[: req.limit]

    results = [
        SearchResult(
            transcript_id=t.id,
            title=t.title,
            snippet=_snippet(t.content, req.query),
            category=t.category,
            call_date=t.call_date.isoformat() if t.call_date else None,
            relevance_score=round(_score(t, terms), 1),
        )
        for t in top
    ]

    # Persist the query record first (so we have an ID for AI call)
    query_record = SearchQuery(
        query_text=req.query,
        result_count=len(results),
    )
    db.add(query_record)
    await db.flush()  # get the ID without committing

    # Run AI analysis
    ai_result = await search_with_ai(req.query, top, db, query_record.id)

    # Store AI answer JSON on the query record
    query_record.ai_answer = json.dumps(ai_result)
    query_record.knowledge_entry_used = ai_result.get("from_knowledge_base", False)
    await db.commit()

    return SearchResponse(
        query_id=query_record.id,
        query=req.query,
        results=results,
        ai_answer=ai_result["answer"],
        confidence=ai_result["confidence"],
        from_knowledge_base=ai_result.get("from_knowledge_base", False),
        knowledge_entry_id=ai_result.get("knowledge_entry_id"),
        is_recurring=ai_result.get("is_recurring", False),
        source_transcript_ids=ai_result.get("source_transcript_ids", []),
    )


@router.get("/history")
async def search_history(limit: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SearchQuery).order_by(SearchQuery.created_at.desc()).limit(limit)
    )
    queries = result.scalars().all()
    return [
        {
            "id": q.id,
            "query_text": q.query_text,
            "result_count": q.result_count,
            "knowledge_entry_used": q.knowledge_entry_used,
            "created_at": q.created_at.isoformat(),
        }
        for q in queries
    ]


@router.get("/knowledge/stats")
async def knowledge_stats(db: AsyncSession = Depends(get_db)):
    return await get_knowledge_stats(db)


@router.get("/knowledge/entries")
async def knowledge_entries(db: AsyncSession = Depends(get_db)):
    from models import KnowledgeEntry
    result = await db.execute(
        select(KnowledgeEntry).order_by(KnowledgeEntry.confidence_score.desc())
    )
    entries = result.scalars().all()
    return [
        {
            "id": e.id,
            "problem_pattern": e.problem_pattern,
            "solution_summary": e.solution_summary,
            "confidence_score": e.confidence_score,
            "use_count": e.use_count,
            "helpful_count": e.helpful_count,
            "source_transcript_ids": json.loads(e.source_transcript_ids),
            "created_at": e.created_at.isoformat(),
            "updated_at": e.updated_at.isoformat(),
        }
        for e in entries
    ]
