from typing import Optional
from fastapi import Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from ..database import get_db
from ..errors import APIError
from ..models import User
from .jwt import verify_token

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Dependency that extracts and validates the JWT token, returning the current user."""
    if credentials is None:
        raise APIError(
            status_code=status.HTTP_401_UNAUTHORIZED,
            message="Not authenticated. Please log in again.",
            error_code="NOT_AUTHENTICATED",
        )

    payload = verify_token(credentials.credentials)
    if payload is None:
        raise APIError(
            status_code=status.HTTP_401_UNAUTHORIZED,
            message="Your session has expired. Please log in again.",
            error_code="INVALID_TOKEN",
        )

    user_id_str: str = payload.get("sub")
    if user_id_str is None:
        raise APIError(
            status_code=status.HTTP_401_UNAUTHORIZED,
            message="Invalid session. Please log in again.",
            error_code="INVALID_TOKEN",
        )

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise APIError(
            status_code=status.HTTP_401_UNAUTHORIZED,
            message="Invalid session. Please log in again.",
            error_code="INVALID_TOKEN",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise APIError(
            status_code=status.HTTP_401_UNAUTHORIZED,
            message="Your account could not be found. Please log in again.",
            error_code="USER_NOT_FOUND",
        )
    if not user.is_active:
        raise APIError(
            status_code=status.HTTP_403_FORBIDDEN,
            message="Your account has been disabled.",
            error_code="ACCOUNT_DISABLED",
        )

    return user
