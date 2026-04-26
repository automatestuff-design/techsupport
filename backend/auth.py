import os
from fastapi import Header, HTTPException
from jose import jwt, JWTError


def get_current_user(authorization: str | None = Header(None)) -> dict:
    """FastAPI dependency — validates Supabase JWT and returns the token payload."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.removeprefix("Bearer ").strip()
    secret = os.environ.get("SUPABASE_JWT_SECRET", "")

    if not secret:
        raise HTTPException(status_code=500, detail="SUPABASE_JWT_SECRET is not configured")

    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"], audience="authenticated")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
