"""
Analytics API router (Day 14 / Milestone 3).

Exposes:
    GET  /api/forms/{form_id}/analytics        – per-form aggregated analytics
    GET  /api/analytics/summary                – cross-form summary (admin dashboard)
    POST /api/public/forms/{link_token}/sessions – lightweight started-session tracking

All endpoints are documented in Swagger with response models + status codes.
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Form, User
from ..auth.deps import get_current_user
from ..schemas import (
    FormAnalyticsResponse,
    AnalyticsSummaryResponse,
    TrackSessionRequest,
    TrackSessionResponse,
)
from ..services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api", tags=["analytics"])


# ─── Ownership helper ───────────────────────────────────────────────

def _assert_owner(form: Form, current_user: User) -> None:
    """403 unless the current user owns the form (legacy NULL owner → allowed).

    Same policy as the response browser and export endpoints: forms created
    before ownership tracking existed (user_id NULL) remain viewable by any
    authenticated user; owned forms are owner-only.
    """
    if form.user_id is not None and form.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to view this form's analytics.",
        )


@router.get(
    "/forms/{form_id}/analytics",
    response_model=FormAnalyticsResponse,
    summary="Get aggregated response analytics for a form",
    description="""
    Returns aggregated analytics for a single form:

    - **total_submissions** – number of stored submissions
    - **started_sessions** – number of times the public form was opened (session tracking)
    - **completed_submissions** – submissions with status `completed`
    - **completion_rate** – `completed / started * 100` (0 if no sessions)
    - **average_completion_time_seconds** – avg `submitted_at - started_at`
    - **average_completion_time** – human readable (e.g. `4m 13s`)
    - **last_submission** – ISO timestamp of the most recent submission
    - **field_distributions** – per-question response distributions for
      `dropdown`, `radio`, `checkbox` and `rating` fields (each bucket has
      `value`, `count` and `percentage`). Pass `?include_distributions=false`
      to omit them for older clients.
    - **submissions_over_time** – daily submission counts (zero-filled
      between the first and last submission) for the trend chart.

    Results are served from an in-memory cache (60s TTL) and invalidated
    whenever submissions change.
    """,
    responses={
        200: {
            "description": "Aggregated analytics for the form",
            "content": {
                "application/json": {
                    "example": {
                        "form_id": 12,
                        "form_name": "Customer Feedback",
                        "total_submissions": 152,
                        "started_sessions": 178,
                        "completed_submissions": 152,
                        "completion_rate": 85.39,
                        "average_completion_time_seconds": 253,
                        "average_completion_time": "4m 13s",
                        "last_submission": "2026-07-27T10:31:12",
                        "last_updated": "2026-07-27T10:31:12",
                    }
                }
            },
        },
        401: {
            "description": "Not authenticated",
            "content": {"application/json": {"example": {"detail": "Not authenticated"}}},
        },
        403: {
            "description": "Not the form owner",
            "content": {"application/json": {"example": {"detail": "You do not have permission to view this form's analytics."}}},
        },
        404: {
            "description": "Form not found",
            "content": {
                "application/json": {"example": {"detail": "Form with id 12 not found"}}
            },
        },
        500: {
            "description": "Internal server error",
            "content": {
                "application/json": {"example": {"detail": "Failed to load analytics"}}
            },
        },
    },
)
async def get_form_analytics(
    form_id: int,
    include_distributions: bool = Query(
        True,
        description="Include per-field response distributions. Older clients may set "
        "this to false to keep the payload minimal.",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get aggregated analytics for a single form (authenticated, owner-only)."""
    # Ownership check (same policy as responses/export): 404 when the form is
    # missing, 403 when a non-owner tries to read it. Legacy forms (NULL owner)
    # remain readable by any authenticated user.
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail=f"Form with id {form_id} not found")
    _assert_owner(form, current_user)

    try:
        result = AnalyticsService.get_form_analytics(db=db, form_id=form_id)
        if not include_distributions:
            # Copy before mutating — the payload may be the shared cached dict.
            result = dict(result)
            result.pop("field_distributions", None)
        # Trim the future-ready extras that are not part of the public response model.
        return FormAnalyticsResponse(**{k: v for k, v in result.items() if k in FormAnalyticsResponse.model_fields})
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load analytics: {str(e)}")


@router.get(
    "/analytics/summary",
    response_model=AnalyticsSummaryResponse,
    summary="Get cross-form analytics summary",
    description="""
    Aggregated analytics across **all** forms, used by the admin Analytics
    dashboard top summary cards:

    - **total_forms**
    - **total_submissions**
    - **total_started_sessions**
    - **completion_rate**
    - **average_completion_time** / **average_completion_time_seconds**
    """,
    responses={
        200: {
            "description": "Cross-form analytics summary",
            "content": {
                "application/json": {
                    "example": {
                        "total_forms": 3,
                        "total_submissions": 210,
                        "total_started_sessions": 240,
                        "completion_rate": 87.5,
                        "average_completion_time_seconds": 253,
                        "average_completion_time": "4m 13s",
                    }
                }
            },
        },
        401: {
            "description": "Not authenticated",
            "content": {"application/json": {"example": {"detail": "Not authenticated"}}},
        },
        500: {
            "description": "Internal server error",
            "content": {
                "application/json": {"example": {"detail": "Failed to load summary"}}
            },
        },
    },
)
async def get_analytics_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get aggregated analytics across all forms (authenticated only)."""
    try:
        return AnalyticsService.get_summary(db=db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load summary: {str(e)}")


@router.post(
    "/public/forms/{link_token}/sessions",
    response_model=TrackSessionResponse,
    summary="Track a started public-form session",
    description="""
    Lightweight session tracking: call this when a public form is opened.

    Stores `form_id`, `session_id`, `started_at`, `ip` and `user_agent`
    in the `form_sessions` table. This powers the **started sessions**
    and **completion rate** analytics. It does **not** affect the
    existing submission flow.

    The frontend generates a `session_id` (UUID) once per form open and
    passes the same `session_id` along with the eventual submission so the
    backend can link `started_at` → `submitted_at` for average completion time.
    """,
    responses={
        200: {
            "description": "Session tracked",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "session_id": "8f2c1d9a-6b7e-4f1a-9c3d-2e5b8a0f1c77",
                        "started_at": "2026-07-27T10:05:00",
                        "form_id": 12,
                    }
                }
            },
        },
        404: {
            "description": "Invalid or expired link token",
            "content": {
                "application/json": {"example": {"detail": "Invalid or expired public link."}}
            },
        },
        500: {
            "description": "Internal server error",
            "content": {
                "application/json": {"example": {"detail": "Failed to track session"}}
            },
        },
    },
)
async def track_session(
    link_token: str,
    payload: TrackSessionRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Track that a public form was opened (started session)."""
    try:
        # Resolve form_id from the link token
        form_data = _get_form_id_by_token(db, link_token)
        form_id = form_data["form_id"]

        started_at = payload.started_at or datetime.now(timezone.utc)
        result = AnalyticsService.track_session(
            db=db,
            form_id=form_id,
            session_id=payload.session_id,
            started_at=started_at,
            ip_address=_client_ip(request),
            user_agent=_user_agent(request),
        )
        return TrackSessionResponse(
            success=True,
            session_id=result["session_id"],
            started_at=result["started_at"],
            form_id=form_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to track session: {str(e)}")


# ─── helpers ──────────────────────────────────────────────────────────


def _get_form_id_by_token(db: Session, link_token: str) -> dict:
    """Resolve a public link token to its form_id (no side effects)."""
    from ..models import PublicLink

    public_link = (
        db.query(PublicLink).filter(PublicLink.link_token == link_token).first()
    )
    if not public_link:
        raise ValueError("Invalid or expired public link.")
    return {"form_id": public_link.form_id}


def _client_ip(request: Request) -> Optional[str]:
    """Best-effort client IP extraction."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def _user_agent(request: Request) -> Optional[str]:
    return request.headers.get("user-agent")
