"""
RingCentral integration: fetches call recordings, transcribes via RC AI API,
and stores results as Transcripts in the database.

Flow:
  sync_new_calls()
    → fetch call log (calls with recordings, last N days)
    → for each unseen recording, submit to speech-to-text API
    → store SyncedRecording with status=transcribing + ai_job_id

  check_pending_jobs()          ← call periodically or on-demand
    → poll each transcribing job
    → when complete, format utterances → save Transcript

  handle_ai_callback()          ← called by /ringcentral/ai-callback webhook
    → same as above but triggered by RC pushing the result to us
"""

import json
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import SyncedRecording, Transcript

RC_PLATFORM = "https://platform.ringcentral.com"
RC_AI = "https://platform.ringcentral.com"

_token: dict[str, Any] = {}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

async def _get_token() -> str:
    """Return a valid Bearer token, refreshing or fetching a new one as needed."""
    now = datetime.now(timezone.utc)

    if _token.get("access_token") and _token.get("expires_at", now) > now:
        return _token["access_token"]

    client_id = os.environ.get("RC_CLIENT_ID", "")
    client_secret = os.environ.get("RC_CLIENT_SECRET", "")
    jwt = os.environ.get("RC_JWT_TOKEN", "")

    if not (client_id and client_secret and jwt):
        raise RuntimeError(
            "Missing RingCentral credentials. Set RC_CLIENT_ID, RC_CLIENT_SECRET, "
            "and RC_JWT_TOKEN in your .env file."
        )

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{RC_PLATFORM}/restapi/oauth/token",
            auth=(client_id, client_secret),
            data={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": jwt,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    _token["access_token"] = data["access_token"]
    _token["expires_at"] = now + timedelta(seconds=data.get("expires_in", 3600) - 60)
    return _token["access_token"]


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _format_transcript(utterances: list[dict], caller_name: str, agent_name: str) -> str:
    """Convert RC AI utterance list to readable dialogue text."""
    # Speaker 1 is typically the called party (agent); Speaker 2 the caller.
    speaker_map = {1: agent_name or "Agent", 2: caller_name or "Caller"}
    lines = []
    for u in utterances:
        speaker = speaker_map.get(u.get("speaker", 0), f"Speaker {u.get('speaker', '?')}")
        text = u.get("text", "").strip()
        if text:
            lines.append(f"{speaker}: {text}")
    return "\n\n".join(lines)


def _parse_call_metadata(record: dict) -> dict:
    """Extract useful fields from a call log record."""
    from_party = record.get("from", {})
    to_party = record.get("to", {})
    return {
        "recording_id": record.get("recording", {}).get("id", ""),
        "content_uri": record.get("recording", {}).get("contentUri", ""),
        "start_time": record.get("startTime", ""),
        "duration": record.get("duration", 0),
        "caller_name": from_party.get("name") or from_party.get("phoneNumber", ""),
        "agent_name": to_party.get("name") or to_party.get("extensionNumber", ""),
        "direction": record.get("direction", ""),
        "session_id": record.get("sessionId", ""),
    }


# ---------------------------------------------------------------------------
# Main sync operations
# ---------------------------------------------------------------------------

async def sync_new_calls(db: AsyncSession, days_back: int = 1) -> dict:
    """
    Fetch recent calls with recordings from RingCentral and submit each
    unseen recording to the AI transcription API.
    Returns a summary dict.
    """
    token = await _get_token()
    date_from = (datetime.now(timezone.utc) - timedelta(days=days_back)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )

    submitted, skipped, errors = 0, 0, []

    async with httpx.AsyncClient(timeout=30) as client:
        page = 1
        while True:
            resp = await client.get(
                f"{RC_PLATFORM}/restapi/v1.0/account/~/call-log",
                headers=_auth_headers(token),
                params={
                    "recordingType": "All",
                    "view": "Detailed",
                    "dateFrom": date_from,
                    "perPage": 100,
                    "page": page,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            records = data.get("records", [])

            for record in records:
                recording = record.get("recording")
                if not recording:
                    continue
                meta = _parse_call_metadata(record)
                recording_id = meta["recording_id"]
                if not recording_id:
                    continue

                # Skip if already processed
                existing = await db.execute(
                    select(SyncedRecording).where(SyncedRecording.recording_id == recording_id)
                )
                if existing.scalar_one_or_none():
                    skipped += 1
                    continue

                # Create tracking record
                synced = SyncedRecording(
                    recording_id=recording_id,
                    status="pending",
                    call_metadata=json.dumps(meta),
                )
                db.add(synced)
                await db.flush()

                # Submit to AI speech-to-text
                try:
                    webhook_url = os.environ.get("RC_WEBHOOK_URL", "")
                    ai_url = f"{RC_AI}/ai/audio/v1/async/speech-to-text"
                    if webhook_url:
                        ai_url += f"?webhook={httpx.URL(webhook_url)}"

                    ai_resp = await client.post(
                        ai_url,
                        headers={**_auth_headers(token), "Content-Type": "application/json"},
                        json={
                            "contentUri": meta["content_uri"],
                            "encoding": "Mpeg",
                            "languageCode": "en-US",
                            "audioType": "CallCenter",
                            "enableSpeakerDiarization": True,
                            "enablePunctuation": True,
                        },
                    )
                    ai_resp.raise_for_status()
                    job_data = ai_resp.json()
                    synced.ai_job_id = job_data.get("jobId")
                    synced.status = "transcribing"
                    submitted += 1
                except httpx.HTTPError as e:
                    synced.status = "failed"
                    synced.error = str(e)
                    errors.append(f"Recording {recording_id}: {e}")

            await db.commit()

            # Check for more pages
            nav = data.get("navigation", {})
            if not nav.get("nextPage"):
                break
            page += 1

    return {"submitted": submitted, "skipped": skipped, "errors": errors}


async def check_pending_jobs(db: AsyncSession) -> dict:
    """
    Poll AI job status for all recordings in 'transcribing' state.
    Saves completed transcripts to the database.
    """
    result = await db.execute(
        select(SyncedRecording).where(SyncedRecording.status == "transcribing")
    )
    pending = result.scalars().all()
    if not pending:
        return {"checked": 0, "completed": 0, "still_pending": 0}

    token = await _get_token()
    completed, still_pending = 0, 0

    async with httpx.AsyncClient(timeout=30) as client:
        for synced in pending:
            if not synced.ai_job_id:
                continue
            try:
                resp = await client.get(
                    f"{RC_AI}/ai/audio/v1/jobs/{synced.ai_job_id}",
                    headers=_auth_headers(token),
                )
                resp.raise_for_status()
                job = resp.json()

                if job.get("status") == "Completed":
                    await _save_transcript(synced, job.get("response", {}), db)
                    completed += 1
                elif job.get("status") == "Failed":
                    synced.status = "failed"
                    synced.error = job.get("errorMessage", "Unknown error")
                    synced.updated_at = datetime.utcnow()
                else:
                    still_pending += 1

            except httpx.HTTPError as e:
                synced.error = str(e)

    await db.commit()
    return {"checked": len(pending), "completed": completed, "still_pending": still_pending}


async def handle_ai_callback(job_id: str, response: dict, db: AsyncSession) -> bool:
    """
    Handle an incoming AI webhook callback from RingCentral.
    Returns True if the transcript was saved successfully.
    """
    result = await db.execute(
        select(SyncedRecording).where(SyncedRecording.ai_job_id == job_id)
    )
    synced = result.scalar_one_or_none()
    if not synced:
        return False

    await _save_transcript(synced, response, db)
    await db.commit()
    return True


async def _save_transcript(synced: SyncedRecording, response: dict, db: AsyncSession):
    """Format utterances and create a Transcript record."""
    utterances = response.get("utterances", [])
    meta = json.loads(synced.call_metadata or "{}")

    caller_name = meta.get("caller_name", "")
    agent_name = meta.get("agent_name", "")
    content = _format_transcript(utterances, caller_name, agent_name)

    if not content:
        content = "(No transcript content returned)"

    call_date = None
    raw_date = meta.get("start_time", "")
    if raw_date:
        try:
            call_date = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
        except ValueError:
            pass

    title = f"Call: {caller_name or 'Unknown'} → {agent_name or 'Unknown'}"
    if call_date:
        title += f" ({call_date.strftime('%Y-%m-%d')})"

    transcript = Transcript(
        title=title,
        content=content,
        caller_name=caller_name or None,
        agent_name=agent_name or None,
        call_date=call_date,
        category="RingCentral",
    )
    db.add(transcript)
    await db.flush()

    synced.transcript_id = transcript.id
    synced.status = "done"
    synced.updated_at = datetime.utcnow()


async def get_sync_status(db: AsyncSession) -> dict:
    """Return a summary of all synced recording statuses."""
    result = await db.execute(select(SyncedRecording))
    all_synced = result.scalars().all()
    counts: dict[str, int] = {}
    for s in all_synced:
        counts[s.status] = counts.get(s.status, 0) + 1
    return {
        "total": len(all_synced),
        "by_status": counts,
        "configured": bool(os.environ.get("RC_CLIENT_ID")),
    }
