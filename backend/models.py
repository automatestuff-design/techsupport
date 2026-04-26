from datetime import datetime
from sqlalchemy import String, Text, Float, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class Transcript(Base):
    __tablename__ = "transcripts"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    caller_name: Mapped[str | None] = mapped_column(String(100))
    agent_name: Mapped[str | None] = mapped_column(String(100))
    call_date: Mapped[datetime | None] = mapped_column(DateTime)
    category: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    feedback: Mapped[list["SearchFeedback"]] = relationship(back_populates="transcript")


class SearchQuery(Base):
    __tablename__ = "search_queries"

    id: Mapped[int] = mapped_column(primary_key=True)
    query_text: Mapped[str] = mapped_column(Text)
    ai_answer: Mapped[str | None] = mapped_column(Text)
    result_count: Mapped[int] = mapped_column(Integer, default=0)
    knowledge_entry_used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    feedback: Mapped[list["SearchFeedback"]] = relationship(back_populates="query")


class SearchFeedback(Base):
    __tablename__ = "search_feedback"

    id: Mapped[int] = mapped_column(primary_key=True)
    query_id: Mapped[int] = mapped_column(ForeignKey("search_queries.id"))
    transcript_id: Mapped[int | None] = mapped_column(ForeignKey("transcripts.id"), nullable=True)
    was_helpful: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    query: Mapped["SearchQuery"] = relationship(back_populates="feedback")
    transcript: Mapped["Transcript | None"] = relationship(back_populates="feedback")


class SyncedRecording(Base):
    """Tracks RingCentral recordings that have been synced to avoid duplicates."""

    __tablename__ = "synced_recordings"

    id: Mapped[int] = mapped_column(primary_key=True)
    recording_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    transcript_id: Mapped[int | None] = mapped_column(ForeignKey("transcripts.id"), nullable=True)
    ai_job_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    # pending → transcribing → done | failed
    status: Mapped[str] = mapped_column(String(20), default="pending")
    call_metadata: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class KnowledgeEntry(Base):
    """Learned Q&A pairs that accumulate from positive-feedback searches."""

    __tablename__ = "knowledge_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    problem_pattern: Mapped[str] = mapped_column(Text)
    solution_summary: Mapped[str] = mapped_column(Text)
    # JSON-encoded list of source transcript IDs
    source_transcript_ids: Mapped[str] = mapped_column(Text, default="[]")
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0)
    use_count: Mapped[int] = mapped_column(Integer, default=0)
    helpful_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
