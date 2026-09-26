"""
Response Browser API router (Day 16 / Milestone 3).

Exposes:
    GET /api/forms/{form_id}/responses          – paginated, filterable list
    GET /api/responses/{response_id}            – full response detail

Security:
- Both endpoints require authentication (JWT).
- Only the form owner may browse responses (403 otherwise). Legacy forms
  with no owner are browsable by any authenticated user (same policy as export).
- 404 when the form/response does not exist.
"""
import logging
import traceback
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Form, Submission, User
from ..auth.deps import get_current_user
from ..schemas import (
    ResponseListResponse,
    ResponseDetailResponse,
    BulkDeleteRequest,
    BulkDeleteResponse,
)
from ..services.response_service import ResponseService

router = APIRouter(prefix="/api", tags=["responses"])

logger = logging.getLogger("dynamic_form_workflow")


# ─── Ownership helper ───────────────────────────────────────────────

def _assert_owner(form: Form, current_user: User) -> None:
    """403 unless the current user owns the form (legacy NULL owner → allowed)."""
    if form.user_id is not None and form.user_id != current_user.id:
        logger.info("Response access denied | user=%s form=%s", current_user.id, form.id)
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to view these responses.",
        )


@router.get(
    "/forms/{form_id}/responses",
    response_model=ResponseListResponse,
    summary="Browse form responses with filters, search and pagination",
    description="""
    Paginated, filterable response browser for a form.

    **Query parameters:**

    - **limit** – page size (default 20, max 200)
    - **offset** – pagination offset (default 0)
    - **from_date** / **to_date** – filter by submitted timestamp (`YYYY-MM-DD`)
    - **status** – `all` (default), `completed`, or `partial` (abandoned sessions)
    - **field_id** + **field_value** – dynamic per-field filter (partial, case-insensitive);
      both must be provided together
    - **search** – free-text across response values + response id (partial, case-insensitive)

    Responses are ordered **newest first** (`submitted_at DESC`).

    **Note:** when `status=partial`, only the date-range filters apply — abandoned
    sessions have no field values, so `search` / `field_id` filters are ignored
    for that branch.

    Each row is a lightweight **summary** (response id, timestamp, status,
    completion time and primary field values) — not every field — so large
    datasets stay fast. Use `GET /responses/{response_id}` for full detail.
    """,
    responses={
        200: {
            "description": "Paginated response list",
            "content": {
                "application/json": {
                    "example": {
                        "total": 152,
                        "count": 20,
                        "offset": 0,
                        "limit": 20,
                        "responses": [
                            {
                                "response_id": "eff3b9ef-14b9-4548-989a-81072b14fba7",
                                "submitted_at": "2026-07-22T05:18:38",
                                "status": "completed",
                                "time_to_complete": "6m 31s",
                                "has_attachments": True,
                                "summary": {
                                    "Full Name": "John",
                                    "Email": "abc@gmail.com",
                                    "Country": "India",
                                },
                            }
                        ],
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
            "content": {"application/json": {"example": {"detail": "You do not have permission to view these responses."}}},
        },
        404: {
            "description": "Form not found",
            "content": {"application/json": {"example": {"detail": "Form with id 999 not found"}}},
        },
        422: {
            "description": "Invalid date / limit / offset parameters",
            "content": {"application/json": {"example": {"detail": "Invalid date format. Use YYYY-MM-DD."}}},
        },
    },
)
async def list_form_responses(
    form_id: int,
    request: Request,
    limit: int = Query(20, ge=1, le=200, description="Page size (max 200)"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    from_date: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD, inclusive)"),
    status: str = Query("all", description="Response status: all | completed | partial"),
    field_id: Optional[int] = Query(None, description="Filter by field id"),
    field_value: Optional[str] = Query(None, description="Filter value for field_id (partial match)"),
    search: Optional[str] = Query(None, description="Free-text search across response values"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Paginated, filterable response browser for a form."""
    # Validate status
    if status not in ("all", "completed", "partial", "archived"):
        raise HTTPException(
            status_code=422,
            detail="Invalid status. Use 'all', 'completed', 'partial' or 'archived'.",
        )

    # Field filter requires both field_id and field_value together
    if bool(field_id) != bool(field_value):
        raise HTTPException(
            status_code=422,
            detail="field_id and field_value must be provided together.",
        )

    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail=f"Form with id {form_id} not found")
    _assert_owner(form, current_user)

    try:
        result = ResponseService.list_responses(
            db=db,
            form_id=form_id,
            limit=limit,
            offset=offset,
            from_date=from_date,
            to_date=to_date,
            status=status,
            field_id=field_id,
            field_value=field_value,
            search=search,
        )
        return ResponseListResponse(**result)
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to load responses: {str(e)}")


@router.delete(
    "/forms/{form_id}/responses/bulk",
    response_model=BulkDeleteResponse,
    summary="Bulk delete responses (irreversible)",
    description="""
    Permanently delete responses for a form. **This action is irreversible.**

    Two modes (mutually exclusive):

    1. **Selected** – pass an explicit non-empty `response_ids` list.
    2. **Filtered** – pass at least one of `from_date` / `to_date` / `status`
       to delete every matching response (the backend re-evaluates the
       filters — the frontend's count is never trusted).

    `confirm` **must** be `true` or the request is rejected with 422 and
    nothing is deleted.

    Dependent rows (response values, file metadata) and the physical uploaded
    files are removed within the same transaction, then an audit log entry is
    written. Forms, versions, fields and rules are never touched.
    """,
    responses={
        200: {
            "description": "Responses deleted",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "message": "3 responses deleted",
                        "deleted": 3,
                        "deleted_ids": ["eff3b9ef-..."],
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
            "content": {"application/json": {"example": {"detail": "You do not have permission to delete these responses."}}},
        },
        404: {
            "description": "Form not found",
            "content": {"application/json": {"example": {"detail": "Form with id 999 not found"}}},
        },
        422: {
            "description": "Missing confirm / no criteria / invalid filters",
            "content": {"application/json": {"example": {"detail": "confirmation required"}}},
        },
    },
)
async def bulk_delete_responses(
    form_id: int,
    request: Request,
    payload: BulkDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk-delete a form's responses. Requires explicit confirmation."""
    if not payload.confirm:
        raise HTTPException(
            status_code=422,
            detail="confirmation required: set confirm=true to delete responses.",
        )

    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail=f"Form with id {form_id} not found")
    if form.user_id is not None and form.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to delete these responses.",
        )

    try:
        result = ResponseService.bulk_delete(
            db=db,
            form_id=form_id,
            response_ids=payload.response_ids or None,
            from_date=payload.from_date,
            to_date=payload.to_date,
            status=payload.status or "all",
            actor_id=current_user.id,
            ip_address=_client_ip(request),
        )
        return BulkDeleteResponse(
            success=True,
            message=f"{result['deleted']} responses deleted",
            deleted=result["deleted"],
            deleted_ids=result["deleted_ids"],
        )
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to delete responses: {str(e)}")


@router.get(
    "/responses/{response_id}",
    response_model=ResponseDetailResponse,
    summary="Get full response detail",
    description="""
    Full detail for a single response, powering the detail modal:

    - Every field label + value
    - Uploaded files with download URLs (images, PDFs, documents)
    - Submission timestamps (submitted / created / started)
    - Completion status and time to complete
    """,
    responses={
        200: {
            "description": "Full response detail",
            "content": {
                "application/json": {
                    "example": {
                        "response_id": "eff3b9ef-14b9-4548-989a-81072b14fba7",
                        "form_id": 17,
                        "form_title": "Student Form",
                        "form_version_id": 22,
                        "status": "completed",
                        "submitted_at": "2026-07-22T05:18:38",
                        "created_at": "2026-07-22T10:48:38",
                        "started_at": "2026-07-22T05:12:07",
                        "time_to_complete": "6m 31s",
                        "responses": [
                            {
                                "field_id": 101,
                                "field_label": "Full Name",
                                "field_type": "text",
                                "value": "John",
                                "file_download_url": None,
                            }
                        ],
                        "files": [
                            {
                                "field_id": 104,
                                "original_filename": "resume.pdf",
                                "content_type": "application/pdf",
                                "size": 204800,
                                "download_url": "http://localhost:8000/api/files/download/abc",
                            }
                        ],
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
            "content": {"application/json": {"example": {"detail": "You do not have permission to view these responses."}}},
        },
        404: {
            "description": "Response not found",
            "content": {"application/json": {"example": {"detail": "Response 'xyz' not found"}}},
        },
    },
)
async def get_response_detail(
    response_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full detail for a single response (detail modal)."""
    submission = (
        db.query(Submission).filter(Submission.response_id == response_id).first()
    )
    if not submission:
        raise HTTPException(status_code=404, detail=f"Response '{response_id}' not found")

    form = db.query(Form).filter(Form.id == submission.form_id).first()
    if not form:
        # Orphan submission — cannot verify ownership, treat as not found
        raise HTTPException(status_code=404, detail=f"Response '{response_id}' not found")
    _assert_owner(form, current_user)

    try:
        detail = ResponseService.get_response_detail(
            db=db,
            response_id=response_id,
            base_url=str(request.base_url).rstrip("/"),
        )
        return ResponseDetailResponse(**detail)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to load response: {str(e)}")


def _client_ip(request: Request) -> Optional[str]:
    """Best-effort client IP extraction."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None
