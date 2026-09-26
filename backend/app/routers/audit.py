"""
Audit log API router (Day 19).

Exposes:
    GET /api/audit-logs – paginated, filterable audit trail

Security:
- Authentication required.
- Scoped to forms the current user may manage (owned forms + legacy
  NULL-owner forms), matching the rest of the platform. Audit entries for
  forms the user cannot access are never returned.

The trail is append-only — no update/delete endpoints exist.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import desc, or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AuditLog, Form, User
from ..auth.deps import get_current_user
from ..schemas import AuditLogResponse, AuditLogListResponse

router = APIRouter(prefix="/api", tags=["audit"])

VALID_ACTIONS = {"archive", "delete", "create", "update"}
VALID_ENTITY_TYPES = {"submission", "form", "retention_policy"}


@router.get(
    "/audit-logs",
    response_model=AuditLogListResponse,
    summary="Browse audit logs",
    description="""
    Paginated audit trail of archive/delete operations.

    **Query parameters:**
    - **limit** / **offset** – pagination (default 20 / 0, max 200)
    - **action** – filter: `archive`, `delete`, `create`, `update`
    - **entity_type** – filter: `submission`, `form`, `retention_policy`
    - **form_id** – filter by form
    - **from_date** / **to_date** – filter by created timestamp (`YYYY-MM-DD`)

    Only logs for forms you own (plus legacy unowned forms) are returned.
    """,
    responses={
        200: {
            "description": "Paginated audit log list",
            "content": {
                "application/json": {
                    "example": {
                        "total": 2,
                        "count": 2,
                        "offset": 0,
                        "limit": 20,
                        "logs": [
                            {
                                "id": 1,
                                "actor_id": None,
                                "actor_name": None,
                                "actor_type": "system",
                                "action": "archive",
                                "entity_type": "submission",
                                "entity_id": None,
                                "form_id": 17,
                                "form_name": "Customer Feedback",
                                "details": {"reason": "retention_policy", "retention_days": 90},
                                "records_affected": 15,
                                "ip_address": None,
                                "created_at": "2026-08-08T02:00:00",
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
    },
)
async def list_audit_logs(
    request: Request,
    limit: int = Query(20, ge=1, le=200, description="Page size (max 200)"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    action: Optional[str] = Query(None, description="Filter by action"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    form_id: Optional[int] = Query(None, description="Filter by form id"),
    from_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD, inclusive)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Paginated, filterable audit trail (authenticated, ownership-scoped)."""
    if action and action not in VALID_ACTIONS:
        raise HTTPException(status_code=422, detail=f"Invalid action. Use one of: {', '.join(sorted(VALID_ACTIONS))}.")
    if entity_type and entity_type not in VALID_ENTITY_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid entity_type. Use one of: {', '.join(sorted(VALID_ENTITY_TYPES))}.",
        )

    # Forms the current user may see: owned + legacy NULL-owner forms.
    accessible = (
        db.query(Form.id)
        .filter(or_(Form.user_id == current_user.id, Form.user_id.is_(None)))
        .all()
    )
    accessible_ids = [row[0] for row in accessible]

    if form_id is not None and form_id not in accessible_ids:
        # Form exists but is not accessible → 403, never leak its audit logs.
        form = db.query(Form).filter(Form.id == form_id).first()
        if form:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to view audit logs for this form.",
            )
        raise HTTPException(status_code=404, detail=f"Form with id {form_id} not found")

    query = db.query(AuditLog).filter(AuditLog.form_id.in_(accessible_ids))

    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if form_id is not None:
        query = query.filter(AuditLog.form_id == form_id)
    if from_date:
        try:
            from datetime import datetime as _dt
            query = query.filter(AuditLog.created_at >= _dt.strptime(from_date.strip(), "%Y-%m-%d"))
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid from_date. Use YYYY-MM-DD.")
    if to_date:
        try:
            from datetime import datetime as _dt, time as _time
            end = _dt.strptime(to_date.strip(), "%Y-%m-%d")
            query = query.filter(AuditLog.created_at <= _dt.combine(end.date(), _time.max))
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid to_date. Use YYYY-MM-DD.")

    total = query.count()

    logs = (
        query.order_by(desc(AuditLog.created_at), desc(AuditLog.id))
        .offset(offset)
        .limit(limit)
        .all()
    )

    # Resolve actor names + form titles in batch.
    actor_ids = {log.actor_id for log in logs if log.actor_id is not None}
    users = db.query(User).filter(User.id.in_(actor_ids)).all() if actor_ids else []
    user_map = {u.id: u for u in users}

    form_ids = {log.form_id for log in logs if log.form_id is not None}
    forms = db.query(Form).filter(Form.id.in_(form_ids)).all() if form_ids else []
    form_map = {f.id: f for f in forms}

    items = []
    for log in logs:
        user = user_map.get(log.actor_id) if log.actor_id is not None else None
        form = form_map.get(log.form_id) if log.form_id is not None else None
        items.append(
            AuditLogResponse(
                id=log.id,
                actor_id=log.actor_id,
                actor_name=user.full_name if user else None,
                actor_type=log.actor_type,
                action=log.action,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                form_id=log.form_id,
                form_name=form.title if form else None,
                details=log.details,
                records_affected=log.records_affected,
                ip_address=log.ip_address,
                created_at=log.created_at,
            )
        )

    return AuditLogListResponse(
        total=total,
        count=len(items),
        offset=offset,
        limit=limit,
        logs=items,
    )
