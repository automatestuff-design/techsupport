"""
AI service: Claude-powered search with prompt caching + knowledge-base learning.

Learning loop:
1. Each search builds context from relevant transcripts and asks Claude.
2. Users rate answers (helpful / not helpful).
3. After N helpful ratings for similar queries, a KnowledgeEntry is created/updated.
4. Future semantically-similar queries reuse the KnowledgeEntry (faster + cheaper).
5. Confidence scores rise with use and positive feedback.
"""

import json
import os
from datetime import datetime
from anthropic import AsyncAnthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import KnowledgeEntry, SearchQuery, Transcript

def _get_client() -> AsyncAnthropic:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set. Add it to your .env file.")
    return AsyncAnthropic(api_key=key)
SYSTEM_PROMPT = """You are an expert technical support knowledge analyst. \
Your job is to help support teams find answers to customer problems by analyzing \
call transcripts.

When given a search query and relevant transcripts, you:
1. Identify the core problem and any solutions mentioned in the transcripts.
2. Synthesize a clear, actionable answer.
3. Note which transcripts were most relevant.
4. Flag patterns that indicate a common, recurring issue.

Be concise and practical. Format your response as JSON with these fields:
{
  "answer": "Clear, actionable answer to the query",
  "problem_pattern": "Short description of the underlying problem pattern (for knowledge base)",
  "confidence": 0.0-1.0,
  "source_transcript_ids": [list of transcript IDs that were most helpful],
  "is_recurring": true/false
}"""


async def _find_knowledge_entry(
    query: str, db: AsyncSession
) -> KnowledgeEntry | None:
    """Check if we have a high-confidence learned answer for this query."""
    result = await db.execute(
        select(KnowledgeEntry)
        .where(KnowledgeEntry.confidence_score >= 0.7)
        .order_by(KnowledgeEntry.confidence_score.desc())
        .limit(10)
    )
    entries = result.scalars().all()
    if not entries:
        return None

    # Use Claude to find the best semantic match (cheap call — small context)
    candidates = "\n".join(
        f"ID {e.id}: {e.problem_pattern}" for e in entries
    )
    response = await _get_client().messages.create(
        model="claude-opus-4-7",
        max_tokens=256,
        system=(
            "You match support queries to known problem patterns. "
            "Reply with just the numeric ID of the best match, or 0 if none fits. "
            "Only match if the query is genuinely about the same underlying problem."
        ),
        messages=[
            {
                "role": "user",
                "content": f"Query: {query}\n\nCandidates:\n{candidates}",
            }
        ],
    )
    text = response.content[0].text.strip()
    try:
        matched_id = int(text)
    except ValueError:
        return None

    if matched_id == 0:
        return None

    for entry in entries:
        if entry.id == matched_id:
            return entry
    return None


async def search_with_ai(
    query: str,
    transcripts: list[Transcript],
    db: AsyncSession,
    query_id: int,
) -> dict:
    """
    Run AI-powered search against relevant transcripts.
    Returns a structured response dict.
    """
    # --- Check knowledge base first ---
    knowledge_entry = await _find_knowledge_entry(query, db)
    if knowledge_entry:
        # Increment use count
        knowledge_entry.use_count += 1
        await db.commit()
        return {
            "answer": knowledge_entry.solution_summary,
            "problem_pattern": knowledge_entry.problem_pattern,
            "confidence": knowledge_entry.confidence_score,
            "source_transcript_ids": json.loads(knowledge_entry.source_transcript_ids),
            "is_recurring": True,
            "from_knowledge_base": True,
            "knowledge_entry_id": knowledge_entry.id,
        }

    if not transcripts:
        return {
            "answer": "No relevant transcripts found for your query. Try different keywords.",
            "problem_pattern": "",
            "confidence": 0.0,
            "source_transcript_ids": [],
            "is_recurring": False,
            "from_knowledge_base": False,
        }

    # --- Build transcript context with prompt caching ---
    transcript_blocks = []
    for t in transcripts[:8]:  # Cap at 8 to keep context manageable
        transcript_blocks.append({
            "type": "text",
            "text": (
                f"=== Transcript #{t.id}: {t.title} ===\n"
                f"Date: {t.call_date or 'Unknown'} | "
                f"Agent: {t.agent_name or 'Unknown'} | "
                f"Caller: {t.caller_name or 'Unknown'} | "
                f"Category: {t.category or 'General'}\n\n"
                f"{t.content}\n"
            ),
        })

    # Mark the last transcript block for caching — stable content per session
    if transcript_blocks:
        transcript_blocks[-1]["cache_control"] = {"type": "ephemeral"}

    response = await _get_client().messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[
            {
                "role": "user",
                "content": [
                    *transcript_blocks,
                    {
                        "type": "text",
                        "text": f"\nSearch query: {query}\n\nAnalyze the transcripts above and answer the query. Reply with valid JSON only.",
                    },
                ],
            }
        ],
    )

    answer_text = next(
        (b.text for b in response.content if hasattr(b, "text")), "{}"
    )

    try:
        parsed = json.loads(answer_text)
    except json.JSONDecodeError:
        # Claude occasionally wraps JSON in markdown fences
        import re
        match = re.search(r"\{.*\}", answer_text, re.DOTALL)
        parsed = json.loads(match.group()) if match else {}

    result = {
        "answer": parsed.get("answer", "Unable to generate answer."),
        "problem_pattern": parsed.get("problem_pattern", ""),
        "confidence": float(parsed.get("confidence", 0.5)),
        "source_transcript_ids": parsed.get("source_transcript_ids", []),
        "is_recurring": parsed.get("is_recurring", False),
        "from_knowledge_base": False,
    }
    return result


async def process_feedback(
    query_id: int,
    was_helpful: bool,
    db: AsyncSession,
) -> None:
    """
    Process user feedback on an AI answer.
    Creates or updates KnowledgeEntry when answers accumulate positive signals.
    """
    result = await db.execute(
        select(SearchQuery).where(SearchQuery.id == query_id)
    )
    query_obj = result.scalar_one_or_none()
    if not query_obj or not query_obj.ai_answer:
        return

    try:
        answer_data = json.loads(query_obj.ai_answer)
    except (json.JSONDecodeError, TypeError):
        return

    problem_pattern = answer_data.get("problem_pattern", "")
    solution = answer_data.get("answer", "")
    source_ids = answer_data.get("source_transcript_ids", [])

    if not problem_pattern or not solution:
        return

    # Find existing knowledge entry for this pattern
    existing = await db.execute(
        select(KnowledgeEntry).where(
            KnowledgeEntry.problem_pattern == problem_pattern
        )
    )
    entry = existing.scalar_one_or_none()

    if entry is None:
        entry = KnowledgeEntry(
            problem_pattern=problem_pattern,
            solution_summary=solution,
            source_transcript_ids=json.dumps(source_ids),
            confidence_score=0.0,
            use_count=1,
            helpful_count=1 if was_helpful else 0,
        )
        db.add(entry)
    else:
        entry.use_count += 1
        if was_helpful:
            entry.helpful_count += 1
            # Update solution with newer answer (keeps it fresh)
            entry.solution_summary = solution
            # Merge source IDs
            existing_ids = set(json.loads(entry.source_transcript_ids))
            merged = list(existing_ids | set(source_ids))
            entry.source_transcript_ids = json.dumps(merged)
        entry.updated_at = datetime.utcnow()

    # Confidence = helpful / total, smoothed with a Laplace prior
    total = entry.use_count
    helpful = entry.helpful_count
    entry.confidence_score = round((helpful + 1) / (total + 2), 3)

    await db.commit()


async def get_knowledge_stats(db: AsyncSession) -> dict:
    result = await db.execute(select(KnowledgeEntry))
    entries = result.scalars().all()
    return {
        "total_entries": len(entries),
        "high_confidence": sum(1 for e in entries if e.confidence_score >= 0.7),
        "total_uses": sum(e.use_count for e in entries),
        "avg_confidence": round(
            sum(e.confidence_score for e in entries) / len(entries), 3
        ) if entries else 0,
    }
