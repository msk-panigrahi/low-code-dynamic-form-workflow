from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, Tuple
from jose import JWTError, jwt
from ..config import settings


def _compute_expiry(expires_delta: Optional[timedelta]) -> datetime:
    """Compute the token expiry instant (single source of truth)."""
    return datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.jwt_access_token_expire_minutes)
    )


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    to_encode.update({"exp": _compute_expiry(expires_delta)})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token_with_expiry(
    data: Dict[str, Any], expires_delta: Optional[timedelta] = None
) -> Tuple[str, datetime]:
    """Create a JWT and return ``(token, expires_at)``.

    ``expires_at`` is the exact expiry used inside the token, so callers that
    surface it (e.g. the login/register response ``expires`` field) never
    re-implement or drift from the expiry formula.
    """
    expire = _compute_expiry(expires_delta)
    to_encode = data.copy()
    to_encode.update({"exp": expire})
    token = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, expire


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and verify a JWT token. Returns the payload or None."""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        return None
