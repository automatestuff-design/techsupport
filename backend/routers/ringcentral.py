from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from services.ringcentral_service import (
    sync_new_calls,
    check_pending_jobs,
    handle_ai_callback,
    get_sync_status,
)

router = APIRouter(prefix="/ringcentral", tags=["ringcentral"])


class SyncRequest(BaseModel):
    days_back: int = 1


@router.post("/sync", dependencies=[Depends(get_current_user)])
async def trigger_sync(req: SyncRequest, db: AsyncSession = Depends(get_db)):
    """Fetch new calls from RingCentral and submit recordings for transcription."""
    try:
        return await sync_new_calls(db, days_back=req.days_back)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"RingCentral API error: {e}")


@router.post("/poll", dependencies=[Depends(get_current_user)])
async def poll_jobs(db: AsyncSession = Depends(get_db)):
    """Check status of pending transcription jobs and save any completed ones."""
    try:
        return await check_pending_jobs(db)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/ai-callback")
async def ai_callback(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Webhook endpoint for RingCentral AI job completion callbacks.
    Set RC_WEBHOOK_URL=https://your-domain.com/api/ringcentral/ai-callback
    """
    payload = await request.json()
    job_id = payload.get("jobId")
    status = payload.get("status")

    if status != "Completed" or not job_id:
        return {"received": True}

    saved = await handle_ai_callback(job_id, payload.get("response", {}), db)
    return {"received": True, "saved": saved}


@router.get("/status", dependencies=[Depends(get_current_user)])
async def sync_status(db: AsyncSession = Depends(get_db)):
    """Return sync statistics and whether RingCentral credentials are configured."""
    return await get_sync_status(db)
