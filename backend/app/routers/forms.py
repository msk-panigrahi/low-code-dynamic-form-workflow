import json
import traceback
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Header
from fastapi.responses import JSONResponse
from sqlalchemy import func as sql_func
from sqlalchemy.orm import Session
from ..database import get_db
from ..schemas import (
    FormCreateSchema,
    FormCreateResponse,
    FieldCreateRequest,
    FieldUpdateRequest,
    FieldReorderRequest,
    FieldResponse,
    DeleteResponse,
    FormDetailResponse,
    PublishResponse,
    ArchiveResponse,
    DraftCreateResponse,
    VersionSummary,
    FormStats,
    GenerateLinkResponse,
    PublicFormResponse,
    PublicFormFieldResponse,
    FormSubmissionResponse,
    FileMetadataResponse,
    SubmissionSummary,
    SubmissionDetail,
    SubmissionListResponse,
    SubmissionStatsResponse,
    DuplicatedFormInfo,
    FormDuplicateResponse,
)
from ..models import Submission, ResponseValue, User, Form
from ..auth.deps import get_current_user
from ..services.form_service import FormService
from ..services.validation_service import ValidationService
from ..services.rule_evaluator_service import RuleEvaluationService
from ..services.file_storage_service import FileStorageService

router = APIRouter(prefix="/api", tags=["forms"])


@router.get("/forms", response_model=List[FormStats])
async def list_forms(db: Session = Depends(get_db)):
    """Get all forms with their statistics"""
    try:
        forms = FormService.list_forms(db=db)
        return forms
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to list forms: {str(e)}")


@router.post(
    "/forms",
    response_model=FormCreateResponse,
    summary="Create a new form",
    description="Create a new form. Accepts title and description, returns the created form with id. Requires authentication — the current user becomes the form owner.",
)
async def create_form(
    request: FormCreateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new form. Accepts title and description, returns the created form with id."""
    try:
        form = FormService.create_form(
            db=db,
            title=request.title,
            description=request.description,
            user_id=current_user.id,
        )
        return FormCreateResponse(
            id=form.id,
            title=form.title,
            description=form.description,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/forms/{form_id}/duplicate",
    response_model=FormDuplicateResponse,
    summary="Duplicate a form as a new draft",
    description="""
    Duplicate an existing form as a **fresh, independent draft**.

    The copy includes the reusable structure — form details, fields (order
    preserved), field options and conditional rules (re-mapped to the new
    field ids). It does **not** copy runtime data: no versions, submissions,
    responses, analytics, sessions or public links.

    **Security:** requires authentication. Only the form owner may duplicate
    (403 otherwise); legacy forms without an owner are duplicable by any
    authenticated user (same policy as export/analytics/responses).
    """,
    responses={
        200: {
            "description": "Form duplicated successfully",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "message": "Form duplicated successfully",
                        "form": {
                            "id": 45,
                            "title": "Customer Feedback Form (Copy)",
                            "status": "draft",
                        },
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
            "content": {"application/json": {"example": {"detail": "You do not have permission to duplicate this form."}}},
        },
        404: {
            "description": "Form not found",
            "content": {"application/json": {"example": {"detail": "Form with id 999 not found"}}},
        },
        500: {
            "description": "Internal server error — no partial duplicate is left behind",
            "content": {"application/json": {"example": {"detail": "Failed to duplicate form"}}},
        },
    },
)
async def duplicate_form(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Duplicate a form as a new draft. Authenticated, owner-only."""
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail=f"Form with id {form_id} not found")

    # Ownership check — same policy as export/analytics/responses:
    # legacy forms (NULL owner) are duplicable by any authenticated user,
    # owned forms are owner-only.
    if form.user_id is not None and form.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to duplicate this form.",
        )

    try:
        result = FormService.duplicate_form(
            db=db,
            form_id=form_id,
            user_id=current_user.id,
        )
        return FormDuplicateResponse(
            success=True,
            message="Form duplicated successfully",
            form=DuplicatedFormInfo(
                id=result["id"],
                title=result["title"],
                status=result["status"],
            ),
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        # Log the real error server-side; never leak internals to the client.
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="Failed to duplicate the form. Please try again.",
        )


@router.get("/forms/{form_id}", response_model=FormDetailResponse)
async def get_form(form_id: int, db: Session = Depends(get_db)):
    """Get a complete form schema with all its fields."""
    form_data = FormService.get_form_with_fields(db=db, form_id=form_id)
    if not form_data:
        raise HTTPException(status_code=404, detail=f"Form with id {form_id} not found")
    return form_data


@router.post("/forms/{form_id}/fields", response_model=FieldResponse)
async def add_field(form_id: int, request: FieldCreateRequest, db: Session = Depends(get_db)):
    """Add a field to a form. Validates config according to the field type library."""
    try:
        field = FormService.add_field(
            db=db,
            form_id=form_id,
            label=request.label,
            field_type=request.field_type,
            required=request.required,
            order=request.order,
            config=request.config,
        )
        return FieldResponse(
            id=field.id,
            label=field.label,
            type=field.field_type,
            config=field.configuration or {},
            is_required=field.is_required == 1,
            order=field.order,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# IMPORTANT: reorder route MUST come before {field_id} route to avoid path conflicts
@router.patch("/forms/{form_id}/fields/reorder", response_model=List[FieldResponse])
async def reorder_fields(form_id: int, request: FieldReorderRequest, db: Session = Depends(get_db)):
    """Reorder fields in a form. Accepts an ordered list of field IDs."""
    try:
        ordered_fields = FormService.reorder_fields(
            db=db,
            form_id=form_id,
            ordered_field_ids=request.ordered_field_ids,
        )
        return [
            FieldResponse(
                id=f.id,
                label=f.label,
                type=f.field_type,
                config=f.configuration or {},
                is_required=f.is_required == 1,
                order=f.order,
            )
            for f in ordered_fields
        ]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/forms/{form_id}/fields/{field_id}", response_model=FieldResponse)
async def update_field(form_id: int, field_id: int, request: FieldUpdateRequest, db: Session = Depends(get_db)):
    """Update an existing field. Allows editing: label, required, config. Does NOT allow changing field type."""
    try:
        field = FormService.update_field(
            db=db,
            form_id=form_id,
            field_id=field_id,
            label=request.label,
            placeholder=request.placeholder,
            required=request.required,
            config=request.config,
        )
        return FieldResponse(
            id=field.id,
            label=field.label,
            type=field.field_type,
            config=field.configuration or {},
            is_required=field.is_required == 1,
            order=field.order,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/forms/{form_id}/fields/{field_id}", response_model=DeleteResponse)
async def delete_field(form_id: int, field_id: int, db: Session = Depends(get_db)):
    """Delete a field from a form. Only draft forms can be modified."""
    try:
        FormService.delete_field(
            db=db,
            form_id=form_id,
            field_id=field_id,
        )
        return DeleteResponse(message="Field deleted successfully")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Publish / Archive / Versioning Endpoints ──────────────

@router.post("/forms/{form_id}/publish", response_model=PublishResponse)
async def publish_form(form_id: int, db: Session = Depends(get_db)):
    """Publish the latest draft version of a form. Creates an immutable snapshot."""
    try:
        result = FormService.publish_version(db=db, form_id=form_id)
        return PublishResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/forms/{form_id}/archive", response_model=ArchiveResponse)
async def archive_form(form_id: int, db: Session = Depends(get_db)):
    """Archive a form. Archived forms become read-only."""
    try:
        result = FormService.archive_version(db=db, form_id=form_id)
        return ArchiveResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/forms/{form_id}/versions", response_model=List[VersionSummary])
async def get_versions(form_id: int, db: Session = Depends(get_db)):
    """Get all versions of a form."""
    try:
        versions = FormService.get_versions(db=db, form_id=form_id)
        return versions
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/forms/{form_id}/versions", response_model=DraftCreateResponse)
async def create_draft_version(
    form_id: int,
    version_id: int = Query(None, description="Source version ID to create draft from"),
    db: Session = Depends(get_db),
):
    """Create a new draft version from a published/archived version."""
    try:
        result = FormService.create_draft_from_version(db=db, form_id=form_id, version_id=version_id)
        return DraftCreateResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Shareable Link Endpoints (Day 6) ────────────────────────────────

@router.post("/forms/{form_id}/generate-link", response_model=GenerateLinkResponse)
async def generate_link(form_id: int, db: Session = Depends(get_db)):
    """Generate a shareable public link for a published form."""
    try:
        result = FormService.generate_link(db=db, form_id=form_id)
        return GenerateLinkResponse(
            success=True,
            link_token=result["link_token"],
            public_url=result["public_url"],
            form_version=result["form_version"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/public/forms/{link_token}", response_model=PublicFormResponse)
async def get_public_form(link_token: str, db: Session = Depends(get_db)):
    """Get a published form by its public link token. No authentication required."""
    try:
        result = FormService.get_public_form(db=db, link_token=link_token)
        return {
            "success": True,
            "form": result["form"],
            "fields": [
                PublicFormFieldResponse(
                    id=f["id"],
                    label=f["label"],
                    type=f["type"],
                    config=f["config"],
                    is_required=f["is_required"],
                    order=f["order"],
                )
                for f in result["fields"]
            ],
            "version": result["version"],
        }
    except ValueError as e:
        raise HTTPException(            status_code=404,
                    detail="Invalid or expired public link."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/public/forms/{link_token}/submit",
    response_model=FormSubmissionResponse,
    summary="Submit a public form response",
    description="""
    Submit a published form response. Supports both JSON and multipart/form-data.
    Performs **complete validation**:

    1. **Token Verification** – Validates the public link token
    2. **Conditional Rule Evaluation** – Recalculates visible/hidden/required fields server-side
    3. **Hidden Field Rejection** – Rejects hidden fields that contain values (security)
    4. **Field Validation** – Validates all visible fields (required, types, lengths, ranges, patterns)
    5. **File Validation** – Validates file type, MIME, and size
    6. **File Storage** – Stores files securely with metadata
    7. **Submission Storage** – Stores successful submissions in `submissions` and `response_values` tables
    """,
    responses={
        200: {
            "description": "Submission successful",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "message": "Thank you! Your response has been recorded successfully.",
                        "response_id": "resp_ab12cd34ef",
                        "submitted_at": "2026-07-24T12:45:18Z",
                        "form_id": 12,
                        "form_version_id": 5,
                        "summary": {"fields_submitted": 8, "files_uploaded": 2},
                        "files": [],
                    }
                }
            },
        },
        400: {
            "description": "Validation failed – field-level errors",
            "content": {
                "application/json": {
                    "example": {
                        "success": False,
                        "message": "Validation failed",
                        "errors": {
                            "email": ["Please enter a valid email address"],
                            "resume": ["Unsupported file type"],
                        },
                    }
                }
            },
        },
        404: {
            "description": "Invalid or expired link token",
            "content": {
                "application/json": {
                    "example": {"detail": "Invalid or expired public link."}
                }
            },
        },
        409: {
            "description": "Duplicate submission (idempotency key conflict)",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "message": "This submission was already recorded.",
                        "response_id": "9b7c31c0-1234-5678-9abc-def012345678",
                        "submitted_at": "2026-07-24T12:45:18Z",
                        "form_id": 12,
                        "form_version_id": 5,
                        "summary": {"fields_submitted": 8, "files_uploaded": 2},
                    }
                }
            },
        },
    },
)
async def submit_public_form(
    link_token: str,
    request: Request,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: Session = Depends(get_db),
):
    """
    Submit a public form response. Supports both JSON and multipart/form-data.

    **Idempotency**:
    Include an `Idempotency-Key` header (a UUID string) to make the request idempotent.
    If the same key is sent again, the backend returns the original submission result
    without creating a duplicate row.

    **JSON Format (no files)**:

        POST /api/public/forms/{link_token}/submit
        Content-Type: application/json
        Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

        {
            "form_values": {
                "12": "John",
                "13": 20,
                "14": "john@gmail.com"
            }
        }

    **Multipart Format (with files)**:

        POST /api/public/forms/{link_token}/submit
        Content-Type: multipart/form-data
        Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000

        form_values: '{"12": "John", "13": 20}'
        file_12: (binary file data for field 12)
        file_15: (binary file data for field 15)
    """
    try:
        # ── Detect content type ──────────────────────────────────────
        content_type = request.headers.get("content-type", "")
        if "multipart/form-data" in content_type:
            # ── Parse multipart ──────────────────────────────────────
            form = await request.form()

            # Extract form_values JSON string
            form_values_raw = form.get("form_values", "{}")
            if isinstance(form_values_raw, str):
                form_values = json.loads(form_values_raw)
            else:
                form_values = {}

            # Analytics: session tracking (optional, never blocks submission)
            session_id = str(form.get("session_id", "")) or None
            started_at_raw = str(form.get("started_at", "")) or None

            # Extract uploaded files (keys: file_{field_id})
            uploaded_files: dict = {}
            for key in form.keys():
                if key.startswith("file_") and hasattr(form[key], "read"):
                    field_id_str = key.replace("file_", "")
                    try:
                        field_id = int(field_id_str)
                        uploaded_files[field_id] = form[key]
                    except (ValueError, TypeError):
                        pass
        else:
            # ── Parse JSON ───────────────────────────────────────────
            body = await request.json()
            form_values = body.get("form_values", {})
            uploaded_files = {}

            # Analytics: session tracking (optional, never blocks submission)
            session_id = body.get("session_id") or None
            started_at_raw = body.get("started_at") or None

        # ── Parse started_at (ISO string) into a datetime if present ──
        started_at = None
        if started_at_raw:
            try:
                started_at = datetime.fromisoformat(
                    str(started_at_raw).replace("Z", "+00:00")
                )
            except (ValueError, TypeError):
                started_at = None

        # ── Step 1: Load the published form via link token ────────────
        print(f"\n{'='*60}")
        print(f"[SUBMIT] link_token: {link_token}")
        form_data = FormService.get_public_form(db=db, link_token=link_token)
        fields = form_data["fields"]
        form_id = form_data["form"]["id"]
        form_version_id = form_data["form_version_id"]
        print(f"[SUBMIT] form_id: {form_id}")
        print(f"[SUBMIT] form_version_id: {form_version_id}")

        # Build a lookup of field configs by field ID
        field_config_map = {}
        field_type_map = {}
        for f in fields:
            field_config_map[f["id"]] = f.get("config", {})
            field_type_map[f["id"]] = f.get("type", "")

        # ── Step 2: Convert form_values keys from strings to integers ─
        print(f"[SUBMIT] Raw payload: {dict(form_values)}")
        form_values_int = {}
        for k, v in form_values.items():
            try:
                form_values_int[int(k)] = v
            except (ValueError, TypeError):
                form_values_int[k] = v
        print(f"[SUBMIT] Converted form_values (int keys): {form_values_int}")

        # ── Step 3: Evaluate conditional rules server-side ────────────
        field_states, triggered_rules = RuleEvaluationService.evaluate(
            db=db,
            form_id=form_id,
            form_values=form_values_int,
        )
        print(f"[SUBMIT] Triggered rules: {triggered_rules}")
        print(f"[SUBMIT] Field states: {field_states}")

        # ── Step 4: Validate file fields (server-side) ────────────────
        file_errors: dict = {}
        for field_id_str, upload_file in uploaded_files.items():
            field_id = int(field_id_str)
            config = field_config_map.get(field_id, {})
            fe = FileStorageService.validate_upload_file(upload_file, config)
            if fe:
                file_errors[str(field_id)] = fe

        if file_errors:
            return JSONResponse(
                status_code=400,
                content=FormSubmissionResponse(
                    success=False,
                    message="Validation failed",
                    errors=file_errors,
                ).model_dump(),
            )

        # ── Step 5: Validate visible fields + reject hidden fields ────
        errors = ValidationService.validate_form_submission(
            fields=fields,
            form_values=form_values_int,
            field_states=field_states,
        )

        if errors:
            print(f"[SUBMIT] VALIDATION ERRORS: {errors}")
            return JSONResponse(
                status_code=400,
                content=FormSubmissionResponse(
                    success=False,
                    message="Validation failed",
                    errors=errors,
                ).model_dump(),
            )
        else:
            print("[SUBMIT] All validations passed")

        # ── Step 6: Idempotency check ────────────────────────────────
        # If an Idempotency-Key header is provided, check for an existing
        # submission with the same key. If found, return the original result.
        if idempotency_key:
            existing = FormService.get_submission_by_idempotency_key(
                db=db, form_id=form_id, idempotency_key=idempotency_key
            )
            if existing:
                # Calculate summary for the duplicate response
                field_count = db.query(sql_func.count(ResponseValue.id)).filter(
                    ResponseValue.submission_id == existing["id"]
                ).scalar() or 0
                file_count = len(existing.get("files", []))

                # DB stores naive UTC; attach UTC tzinfo so the API response
                # serializes consistently with the fresh-submission path
                # (both emit "...Z"/"+00:00" instead of a bare naive value).
                dup_submitted_at = existing["submitted_at"]
                if dup_submitted_at is not None and dup_submitted_at.tzinfo is None:
                    dup_submitted_at = dup_submitted_at.replace(tzinfo=timezone.utc)

                return JSONResponse(
                    status_code=200,
                    # mode="json" — JSONResponse json-encodes `content` directly,
                    # so a raw datetime in submitted_at would raise
                    # "Object of type datetime is not JSON serializable" (HTTP 500).
                    content=FormSubmissionResponse(
                        success=True,
                        message="This submission was already recorded.",
                        response_id=existing["response_id"],
                        submitted_at=dup_submitted_at,
                        form_id=form_id,
                        form_version_id=form_version_id,
                        summary={
                            "fields_submitted": field_count,
                            "files_uploaded": file_count,
                        },
                    ).model_dump(mode="json"),
                )

        # ── Step 7: Store submission in database ─────────────────────
        response_id = FormService.store_submission(
            db=db,
            form_id=form_id,
            form_version_id=form_version_id,
            link_token=link_token,
            form_values=form_values,  # Original string-keyed dict
            field_states=field_states,
            idempotency_key=idempotency_key,
            started_at=started_at,
            session_id=session_id,
        )

        # ── Step 8: Save uploaded files after submission is created ───
        # (We need a submission_id to link files)
        submission = FormService.get_submission_by_response_id(db, response_id)
        submission_id = submission.id if submission else None

        uploaded_file_responses = []
        uploaded_file_count = 0
        if submission_id and uploaded_files:
            for field_id, upload_file in uploaded_files.items():
                file_meta = FileStorageService.save_upload_file(
                    upload_file=upload_file,
                    field_id=field_id,
                    submission_id=submission_id,
                    db=db,
                )
                uploaded_file_count += 1

                # Link file to response_values (store stored_filename)
                FormService.store_field_file_reference(
                    db=db,
                    submission_id=submission_id,
                    field_id=field_id,
                    stored_filename=file_meta.stored_filename,
                )

                # Build absolute download URL for frontend
                base_url = str(request.base_url).rstrip("/")
                file_info = FileStorageService.get_file_info_response(file_meta, base_url=base_url)
                uploaded_file_responses.append(FileMetadataResponse(**file_info))

        # ── Step 9: Count submitted fields for summary ───────────────
        fields_submitted = 0
        if submission_id:
            fields_submitted = db.query(sql_func.count(ResponseValue.id)).filter(
                ResponseValue.submission_id == submission_id
            ).scalar() or 0

        db.commit()

        now_utc = datetime.now(timezone.utc)

        return FormSubmissionResponse(
            success=True,
            message="Thank you! Your response has been recorded successfully.",
            response_id=response_id,
            submitted_at=now_utc,
            form_id=form_id,
            form_version_id=form_version_id,
            summary={
                "fields_submitted": fields_submitted,
                "files_uploaded": uploaded_file_count,
            },
            files=uploaded_file_responses if uploaded_file_responses else None,
        )

    except ValueError as e:
        # JSONDecodeError inherits from ValueError; return 400 not 404
        if isinstance(e, json.JSONDecodeError):
            raise HTTPException(status_code=400, detail="Invalid JSON in request body")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Submission failed: {str(e)}")


# ─── Submission / Response Endpoints (Day 12) ─────────────────────────

@router.get(
    "/forms/{form_id}/submissions",
    response_model=SubmissionListResponse,
    summary="List all submissions for a form",
    description="Get paginated list of form submissions with response counts.",
)
async def list_submissions(
    form_id: int,
    limit: int = Query(50, description="Maximum number of submissions to return"),
    offset: int = Query(0, description="Number of submissions to skip"),
    db: Session = Depends(get_db),
):
    """Get all submissions for a form, sorted by most recent first."""
    try:
        result = FormService.list_submissions(
            db=db, form_id=form_id, limit=limit, offset=offset
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to list submissions: {str(e)}")


@router.get(
    "/forms/{form_id}/submissions/stats",
    response_model=SubmissionStatsResponse,
    summary="Get submission statistics",
    description="Get total, today, and this week submission counts for a form.",
)
async def get_submission_stats(
    form_id: int,
    db: Session = Depends(get_db),
):
    """Get submission statistics for a form."""
    try:
        stats = FormService.get_submission_stats(db=db, form_id=form_id)
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")


@router.get(
    "/forms/{form_id}/submissions/{submission_id}",
    response_model=SubmissionDetail,
    summary="Get submission details",
    description="Get a single submission with all its response values.",
)
async def get_submission_detail(
    form_id: int,
    submission_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    """Get detailed submission with all field values."""
    try:
        detail = FormService.get_submission_detail(
            db=db,
            form_id=form_id,
            submission_id=submission_id,
            base_url=str(request.base_url).rstrip("/"),
        )
        return detail
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to get submission: {str(e)}")
