"""
Export API router (Day 15 / Milestone 3).

Exposes:
    GET /api/forms/{form_id}/export?format=csv|json&version=latest|<version_id>

- Only authenticated form owners can export (legacy forms with no owner are
  exportable by any authenticated user).
- 403 when a non-owner attempts an export; 404 when the form/version is missing.
- CSV is streamed lazily (StreamingResponse) for memory efficiency.
"""
import logging
import traceback

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Form, User
from ..auth.deps import get_current_user
from ..services.export_service import ExportService

router = APIRouter(prefix="/api", tags=["export"])

logger = logging.getLogger("dynamic_form_workflow")


@router.get(
    "/forms/{form_id}/export",
    summary="Export form responses as CSV or JSON",
    description="""
    Download all responses collected for a form.

    **Query parameters:**

    - **format** – `csv` (default) or `json`. Any other value is rejected.
- **version** – `latest` (default) exports **all** responses for the form
  (column headers come from the latest version). A specific version id
  exports only that version's responses.

    **CSV output** uses the form's **field labels** as column headers
    (never internal ids), plus system metadata columns:

    `Submission ID, Submitted At, Created At, Updated At, Form Version,
    Response Status, Completion Time, Submission Duration`

    **File upload fields** export as download URLs (never binary).

    **Security:** requires authentication. Only the form owner may export
    (403 otherwise); legacy forms without an owner are exportable by any
    authenticated user. The response is streamed row-by-row, so large
    datasets stay memory efficient.
    """,
    responses={
        200: {
            "description": "Export generated. CSV is streamed as text/csv, JSON as application/json.",
            "content": {
                "text/csv": {
                    "example": (
                        "Customer Name,Email,Rating,Resume,Submission ID,Submitted At,Created At,Updated At,Form Version,Response Status,Completion Time,Submission Duration\r\n"
                        "John,john@gmail.com,5,http://localhost:8000/api/files/download/abc,resp_1,2026-07-27T10:31:12,2026-07-27T10:31:12,2026-07-27T10:31:12,2,completed,4m 13s,253\r\n"
                    )
                },
                "application/json": {
                    "example": [
                        {
                            "Customer Name": "John",
                            "Email": "john@gmail.com",
                            "Rating": 5,
                            "Resume": "http://localhost:8000/api/files/download/abc",
                            "Submission ID": "resp_1",
                            "Submitted At": "2026-07-27T10:31:12",
                            "Form Version": 2,
                            "Response Status": "completed",
                            "Completion Time": "4m 13s",
                            "Submission Duration": 253,
                        }
                    ]
                },
            },
        },
        401: {
            "description": "Not authenticated",
            "content": {"application/json": {"example": {"detail": "Not authenticated"}}},
        },
        403: {
            "description": "Not the form owner",
            "content": {"application/json": {"example": {"detail": "You do not have permission to export this form."}}},
        },
        404: {
            "description": "Form or version not found",
            "content": {"application/json": {"example": {"detail": "Form with id 999 not found"}}},
        },
        422: {
            "description": "Invalid format or version parameter",
            "content": {"application/json": {"example": {"detail": "Unsupported export format 'xml'. Supported: csv, json."}}},
        },
    },
)
async def export_form_responses(
    form_id: int,
    request: Request,
    format: str = Query("csv", description="Export format: 'csv' (default) or 'json'"),
    version: str = Query("latest", description="Version to export: 'latest' (default) or a version id"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export responses for a form as CSV or JSON (authenticated, owner-only)."""
    # ── Format validation (reject everything except csv/json) ────────
    if format not in ExportService.SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported export format '{format}'. Supported: csv, json.",
        )

    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail=f"Form with id {form_id} not found")

    # ── Ownership check ──────────────────────────────────────────────
    # Legacy forms (user_id NULL, created before ownership tracking) are
    # exportable by any authenticated user. Owned forms are owner-only.
    if form.user_id is not None and form.user_id != current_user.id:
        logger.info(
            "Export denied | user=%s form=%s (not owner)", current_user.id, form_id
        )
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to export this form.",
        )

    try:
        base_url = str(request.base_url).rstrip("/")
        payload = ExportService.build_export(
            db=db,
            form_id=form_id,
            export_format=format,
            version=version,
            base_url=base_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to export responses: {str(e)}")

    filename = payload["filename"]
    return StreamingResponse(
        payload["iterator"],
        media_type=payload["content_type"],
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
