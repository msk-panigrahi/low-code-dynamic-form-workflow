"""
Retention policy API router (Day 19).

Exposes:
    GET    /api/retention-policies                        – list policies for accessible forms
    GET    /api/forms/{form_id}/retention-policy          – get one form's policy
    POST   /api/forms/{form_id}/retention-policy          – create a policy
    PUT    /api/forms/{form_id}/retention-policy          – update a policy
    DELETE /api/forms/{form_id}/retention-policy          – remove a policy (back to "Never")
    POST   /api/retention/run                             – run the archival job manually

Security: all endpoints require authentication. Policy mutations are
owner-only (legacy NULL-owner forms are manageable by any authenticated
user, matching the rest of the platform).
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Form, User
from ..auth.deps import get_current_user
from ..schemas import (
    RetentionPolicySchema,
    RetentionPolicyCreate,
    RetentionPolicyUpdate,
    RetentionPolicyListResponse,
)
from ..services.retention_service import RetentionService

router = APIRouter(prefix="/api", tags=["retention"])


def _assert_owner(form: Form, current_user: User) -> None:
    """403 unless the current user owns the form (legacy NULL owner → allowed)."""
    if form.user_id is not None and form.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to manage this form's retention policy.",
        )


@router.get(
    "/retention-policies",
    response_model=RetentionPolicyListResponse,
    summary="List retention policies for accessible forms",
    description="""
    Returns one row per form the current user can manage (owned forms plus
    legacy forms without an owner). Forms without a policy appear as a
    **"Never"** row (`enabled=false`, `retention_days=null`) so the settings
    UI can render a complete table.
    """,
)
async def list_retention_policies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        policies = RetentionService.list_policies(db=db, current_user_id=current_user.id)
        return RetentionPolicyListResponse(policies=policies, total=len(policies))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list retention policies: {str(e)}")


@router.get(
    "/forms/{form_id}/retention-policy",
    response_model=RetentionPolicySchema,
    summary="Get a form's retention policy",
)
async def get_retention_policy(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail=f"Form with id {form_id} not found")
    _assert_owner(form, current_user)

    policy = RetentionService.get_policy(db=db, form_id=form_id)
    if not policy:
        return RetentionPolicySchema(
            form_id=form_id,
            form_name=form.title,
            retention_days=None,
            action="archive",
            enabled=False,
        )
    return RetentionPolicySchema(**policy)


@router.post(
    "/forms/{form_id}/retention-policy",
    response_model=RetentionPolicySchema,
    summary="Create a retention policy for a form",
    description="""
    Create a retention policy. One policy per form.

    - `retention_days` – how many days submissions stay active before archival.
      Omit/null = **Never** (keep everything).
    - `enabled` – disable to turn the policy off without deleting it.
    - `action` – currently only `archive` (data is preserved, never deleted).
    """,
    responses={
        403: {"description": "Not the form owner"},
        404: {"description": "Form not found"},
        409: {"description": "A policy already exists for this form (use PUT to update)"},
    },
)
async def create_retention_policy(
    form_id: int,
    request: RetentionPolicyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail=f"Form with id {form_id} not found")
    _assert_owner(form, current_user)

    try:
        policy = RetentionService.create_policy(
            db=db,
            form_id=form_id,
            retention_days=request.retention_days,
            action=request.action,
            enabled=request.enabled,
            actor_id=current_user.id,
        )
        return RetentionPolicySchema(**policy)
    except ValueError as e:
        if "already exists" in str(e):
            raise HTTPException(status_code=409, detail=str(e))
        raise HTTPException(status_code=422, detail=str(e))


@router.put(
    "/forms/{form_id}/retention-policy",
    response_model=RetentionPolicySchema,
    summary="Update a form's retention policy",
)
async def update_retention_policy(
    form_id: int,
    request: RetentionPolicyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail=f"Form with id {form_id} not found")
    _assert_owner(form, current_user)

    try:
        policy = RetentionService.update_policy(
            db=db,
            form_id=form_id,
            retention_days=request.retention_days,
            action=request.action,
            enabled=request.enabled,
            actor_id=current_user.id,
        )
        return RetentionPolicySchema(**policy)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete(
    "/forms/{form_id}/retention-policy",
    status_code=200,
    summary="Remove a form's retention policy",
    description="Removes the policy — the form returns to **Never** (keep everything).",
)
async def delete_retention_policy(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    form = db.query(Form).filter(Form.id == form_id).first()
    if not form:
        raise HTTPException(status_code=404, detail=f"Form with id {form_id} not found")
    _assert_owner(form, current_user)

    try:
        RetentionService.delete_policy(db=db, form_id=form_id, actor_id=current_user.id)
        return {"success": True, "message": "Retention policy removed."}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post(
    "/retention/run",
    summary="Run the retention archival job manually",
    description="""
    Runs the same idempotent archival job the scheduler executes daily.
    Enabled policies archive their expired submissions (status → `archived`,
    `archived_at` set). Data is preserved — nothing is physically deleted.
    """,
)
async def run_retention_job(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        result = RetentionService.run_archive_job(db=db)
        return {
            "success": True,
            "message": f"Retention job completed. {result['archived_total']} submissions archived.",
            **result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Retention job failed: {str(e)[:200]}")
