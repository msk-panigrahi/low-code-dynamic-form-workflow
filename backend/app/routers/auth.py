from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
import re

from ..database import get_db
from ..errors import APIError
from ..models import User
from ..auth.password import hash_password, verify_password
from ..auth.jwt import create_access_token_with_expiry
from ..auth.deps import get_current_user


# ─── Request / Response Schemas ──────────────────────────

class RegisterRequest(BaseModel):
    full_name: str
    username: str
    email: str
    password: str

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v):
        if not v or not v.strip():
            raise ValueError("Full name is required")
        if len(v.strip()) < 2:
            raise ValueError("Full name must be at least 2 characters")
        return v.strip()

    @field_validator("username")
    @classmethod
    def validate_username(cls, v):
        if not v or not v.strip():
            raise ValueError("Username is required")
        if not re.match(r"^[a-zA-Z0-9_]{3,20}$", v):
            raise ValueError("Username must be 3-20 characters (letters, numbers, underscores)")
        return v.strip()

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        if not v or not v.strip():
            raise ValueError("Email is required")
        if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", v):
            raise ValueError("Invalid email format")
        return v.strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if not v:
            raise ValueError("Password is required")
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email_or_username: str
    password: str


class UserResponse(BaseModel):
    id: int
    full_name: str
    username: str
    email: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires: str
    user: UserResponse


class UserDetailResponse(BaseModel):
    id: int
    full_name: str
    username: str
    email: str
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    message: str


# ─── Router ──────────────────────────────────────────────

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Create a new user account. Returns a JWT access token and user data.",
)
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user account."""
    # Check for existing email
    existing_email = db.query(User).filter(User.email == request.email).first()
    if existing_email:
        raise APIError(
            status_code=status.HTTP_409_CONFLICT,
            message="This email is already registered.",
            error_code="EMAIL_EXISTS",
        )

    # Check for existing username
    existing_username = db.query(User).filter(User.username == request.username).first()
    if existing_username:
        raise APIError(
            status_code=status.HTTP_409_CONFLICT,
            message="This username is already taken.",
            error_code="USERNAME_EXISTS",
        )

    # Create user
    user = User(
        full_name=request.full_name,
        username=request.username,
        email=request.email,
        hashed_password=hash_password(request.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Generate token
    access_token, expires_at = create_access_token_with_expiry(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=access_token,
        expires=expires_at.isoformat(),
        user=UserResponse(
            id=user.id,
            full_name=user.full_name,
            username=user.username,
            email=user.email,
        ),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Log in",
    description="Authenticate with email/username and password. Returns a JWT access token.",
)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate a user and return a JWT access token."""
    # Look up by email or username
    user = db.query(User).filter(
        (User.email == request.email_or_username) |
        (User.username == request.email_or_username)
    ).first()

    if user is None:
        raise APIError(
            status_code=status.HTTP_404_NOT_FOUND,
            message="No account found with this email.",
            error_code="USER_NOT_FOUND",
        )

    if not verify_password(request.password, user.hashed_password):
        raise APIError(
            status_code=status.HTTP_401_UNAUTHORIZED,
            message="Incorrect password.",
            error_code="INVALID_CREDENTIALS",
        )

    if not user.is_active:
        raise APIError(
            status_code=status.HTTP_403_FORBIDDEN,
            message="Your account has been disabled.",
            error_code="ACCOUNT_DISABLED",
        )

    # Generate token
    access_token, expires_at = create_access_token_with_expiry(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=access_token,
        expires=expires_at.isoformat(),
        user=UserResponse(
            id=user.id,
            full_name=user.full_name,
            username=user.username,
            email=user.email,
        ),
    )


@router.get(
    "/me",
    response_model=UserDetailResponse,
    summary="Get current user",
    description="Returns the currently authenticated user's profile.",
)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get the currently authenticated user's details."""
    return UserDetailResponse(
        id=current_user.id,
        full_name=current_user.full_name,
        username=current_user.username,
        email=current_user.email,
        is_active=current_user.is_active,
        created_at=current_user.created_at.isoformat(),
    )


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Log out",
    description="Log out the current user. (JWT is stateless — client should discard the token.)",
)
async def logout(current_user: User = Depends(get_current_user)):
    """Log out. Since JWTs are stateless, the client is responsible for discarding the token."""
    return MessageResponse(message="Logged out successfully. Please discard your token.")
