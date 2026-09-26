"""
Response browser service (Day 16 / Milestone 3).

Powerful, efficient browsing of a form's responses:

- Pagination (limit / offset) with `total`, `count`, `limit`, `offset`.
- Date-range filtering on the submitted timestamp (from_date / to_date).
- Completion status filter (completed / partial / all).
- Dynamic per-field filtering (field_id + field_value, partial, case-insensitive).
- Free-text search across response values + response id (partial, case-insensitive).
- Newest first (submitted_at DESC).
- Detail view by response_id (all values, files, metadata, timestamps).

Performance:
- Pagination is pushed down to SQL (OFFSET/LIMIT) — the page is the only
  set loaded into memory.
- Response values, field labels and file metadata are batch-loaded with
  `IN (...)` queries (no N+1).
- Partial (abandoned) sessions are queried with a NOT EXISTS join instead
  of loading every session row.
"""
import json
from datetime import datetime, time
from typing import Any, Dict, List, Optional

from sqlalchemy import desc, exists, and_, or_
from sqlalchemy.orm import Session

from ..models import Form, Submission, ResponseValue, Field, FormSession, FileMetadata
from .analytics_service import AnalyticsService
from .file_storage_service import FileStorageService
from .audit_service import AuditService


class ResponseService:
    """Filtering / searching / pagination for form responses."""

    # ─── Value helpers ─────────────────────────────────────────────

    @staticmethod
    def _display_value(value: Optional[str], field_type: Optional[str] = None) -> Optional[str]:
        """Human-friendly value for a stored response value.

        - JSON lists/dicts (e.g. checkbox multi-select) are flattened.
        - Everything else is returned as-is (never mangled).
        """
        if value is None:
            return None
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return ", ".join(str(x) for x in parsed)
                if isinstance(parsed, dict):
                    return ", ".join(f"{k}: {v}" for k, v in parsed.items())
            except (ValueError, TypeError):
                pass
        return value

    @staticmethod
    def _time_to_complete(sub: Submission) -> Optional[str]:
        """Human-readable completion time (submitted - started), if available."""
        if not sub.started_at or not sub.submitted_at:
            return None
        delta = (sub.submitted_at - sub.started_at).total_seconds()
        if delta < 0:
            return None
        return AnalyticsService.format_duration(int(round(delta)))

    @staticmethod
    def _parse_date(value: Optional[str], end_of_day: bool = False) -> Optional[datetime]:
        """Parse a 'YYYY-MM-DD' query param into a naive UTC datetime.

        - Normal date → midnight (inclusive start).
        - end_of_day=True → 23:59:59.999999 (inclusive end for to_date).
        Raises ValueError for malformed input (→ 422 upstream).
        """
        if not value:
            return None
        parsed = datetime.strptime(value.strip(), "%Y-%m-%d")
        if end_of_day:
            return datetime.combine(parsed.date(), time.max)
        return parsed

    # ─── List (filter + search + paginate) ─────────────────────────

    @classmethod
    def list_responses(
        cls,
        db: Session,
        form_id: int,
        limit: int = 20,
        offset: int = 0,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        status: str = "all",
        field_id: Optional[int] = None,
        field_value: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Paginated, filtered, searchable response list for a form.

        Returns:
            {total, count, offset, limit, responses: [{response_id, submitted_at,
              status, time_to_complete, has_attachments, summary}]}

        Raises ValueError for a missing form (→ 404 upstream) or a
        malformed date (→ 422 upstream).
        """
        form = db.query(Form).filter(Form.id == form_id).first()
        if not form:
            raise ValueError(f"Form with id {form_id} not found")

        from_dt = cls._parse_date(from_date, end_of_day=False)
        to_dt = cls._parse_date(to_date, end_of_day=True)

        # ── Partial (abandoned) sessions branch ─────────────────────
        # A partial response is a started session that never produced a
        # completed submission (session_id tracked but no linked submission).
        if status == "partial":
            return cls._list_partial_sessions(
                db, form_id=form_id, limit=limit, offset=offset,
                from_dt=from_dt, to_dt=to_dt,
            )

        # ── Completed / archived / all submissions branch ────────────
        query = db.query(Submission).filter(Submission.form_id == form_id)

        if status == "completed":
            query = query.filter(Submission.status == "completed")
        elif status == "archived":
            query = query.filter(Submission.status == "archived")
        # status == 'all' → no status restriction

        if from_dt:
            query = query.filter(Submission.submitted_at >= from_dt)
        if to_dt:
            query = query.filter(Submission.submitted_at <= to_dt)

        # Dynamic per-field filter (never hardcoded field names)
        if field_id and field_value:
            field_value_like = f"%{field_value}%"
            query = query.filter(
                exists().where(
                    and_(
                        ResponseValue.submission_id == Submission.id,
                        ResponseValue.field_id == field_id,
                        ResponseValue.value.ilike(field_value_like),
                    )
                )
            )

        # Free-text search across response values + response id
        if search:
            search_like = f"%{search}%"
            query = query.filter(
                or_(
                    Submission.response_id.ilike(search_like),
                    exists().where(
                        and_(
                            ResponseValue.submission_id == Submission.id,
                            ResponseValue.value.ilike(search_like),
                        )
                    ),
                )
            )

        total = query.count()

        rows = (
            query.order_by(desc(Submission.submitted_at))
            .offset(offset)
            .limit(limit)
            .all()
        )

        responses = cls._build_list_items(db, rows)

        return {
            "total": total,
            "count": len(responses),
            "offset": offset,
            "limit": limit,
            "responses": responses,
        }

    @classmethod
    def _build_list_items(
        cls, db: Session, rows: List[Submission]
    ) -> List[Dict[str, Any]]:
        """Build list rows with batch-loaded labels + attachment flags."""
        if not rows:
            return []

        sub_ids = [r.id for r in rows]

        # Batch-load response values for the page
        values = (
            db.query(ResponseValue)
            .filter(ResponseValue.submission_id.in_(sub_ids))
            .all()
        )
        values_by_sub: Dict[int, List[ResponseValue]] = {}
        field_ids = set()
        for v in values:
            values_by_sub.setdefault(v.submission_id, []).append(v)
            field_ids.add(v.field_id)

        # Batch-load field labels
        fields = (
            db.query(Field).filter(Field.id.in_(field_ids)).all()
            if field_ids
            else []
        )
        field_map = {f.id: f for f in fields}

        # Batch-load attachment flags (file metadata per submission)
        metas = (
            db.query(FileMetadata.submission_id)
            .filter(FileMetadata.submission_id.in_(sub_ids))
            .all()
            if sub_ids
            else []
        )
        subs_with_files = {m[0] for m in metas}

        items = []
        for sub in rows:
            summary: Dict[str, Any] = {}
            for v in values_by_sub.get(sub.id, []):
                field = field_map.get(v.field_id)
                # File fields are shown in the detail view / download action,
                # not inside the lightweight list summary.
                if field and field.field_type == "file":
                    continue
                label = field.label if field else f"Field #{v.field_id}"
                summary[label] = cls._display_value(v.value)

            items.append({
                "response_id": sub.response_id,
                "submitted_at": sub.submitted_at,
                "started_at": sub.started_at,
                "status": sub.status,
                "time_to_complete": cls._time_to_complete(sub),
                "has_attachments": sub.id in subs_with_files,
                "summary": summary,
            })

        return items

    @classmethod
    def _list_partial_sessions(
        cls,
        db: Session,
        form_id: int,
        limit: int,
        offset: int,
        from_dt: Optional[datetime],
        to_dt: Optional[datetime],
    ) -> Dict[str, Any]:
        """Abandoned sessions: started but never completed."""
        query = db.query(FormSession).filter(
            FormSession.form_id == form_id,
            # No completed submission linked to this session
            ~exists().where(
                and_(
                    Submission.form_id == form_id,
                    Submission.session_id == FormSession.session_id,
                )
            ),
        )

        if from_dt:
            query = query.filter(FormSession.started_at >= from_dt)
        if to_dt:
            query = query.filter(FormSession.started_at <= to_dt)

        total = query.count()
        sessions = (
            query.order_by(desc(FormSession.started_at))
            .offset(offset)
            .limit(limit)
            .all()
        )

        responses = [
            {
                "response_id": None,
                "submitted_at": s.started_at,
                "started_at": s.started_at,
                "status": "partial",
                "time_to_complete": None,
                "has_attachments": False,
                "summary": {},
            }
            for s in sessions
        ]

        return {
            "total": total,
            "count": len(responses),
            "offset": offset,
            "limit": limit,
            "responses": responses,
        }

    # ─── Bulk delete (Day 19) ──────────────────────────────────────

    @classmethod
    def bulk_delete(
        cls,
        db: Session,
        form_id: int,
        *,
        response_ids: Optional[List[str]] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        status: str = "all",
        actor_id: Optional[int] = None,
        ip_address: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Permanently delete submissions matching the given criteria.

        Two mutually exclusive modes:

        1. **Selected**: pass an explicit non-empty `response_ids` list.
        2. **Filtered**: pass date/status filters (at least one).

        The backend re-evaluates the criteria — the frontend's selected count
        is never trusted. Dependent rows (response values, file metadata and
        the physical files on disk) are deleted within the same transaction,
        then an audit log entry is written.

        Returns: {deleted, deleted_ids}
        """
        form = db.query(Form).filter(Form.id == form_id).first()
        if not form:
            raise ValueError(f"Form with id {form_id} not found")

        query = db.query(Submission).filter(Submission.form_id == form_id)

        if response_ids:
            query = query.filter(Submission.response_id.in_(response_ids))
        else:
            from_dt = cls._parse_date(from_date, end_of_day=False)
            to_dt = cls._parse_date(to_date, end_of_day=True)
            if from_dt:
                query = query.filter(Submission.submitted_at >= from_dt)
            if to_dt:
                query = query.filter(Submission.submitted_at <= to_dt)
            if status and status != "all":
                query = query.filter(Submission.status == status)
            # At least one filter must be present — never delete everything by accident.
            if not from_dt and not to_dt and (not status or status == "all"):
                raise ValueError(
                    "Provide either response_ids or at least one filter (from_date, to_date, status)."
                )

        submissions = query.all()
        if not submissions:
            return {"deleted": 0, "deleted_ids": []}

        submission_ids = [s.id for s in submissions]
        deleted_ids = [s.response_id for s in submissions]

        # Capture the physical file paths BEFORE deleting the metadata rows so
        # the files can be removed after commit. The DB transaction only ever
        # deletes rows — a commit failure therefore rolls back to a fully
        # consistent state (no rows pointing at files that are already gone).
        metas = (
            db.query(FileMetadata)
            .filter(FileMetadata.submission_id.in_(submission_ids))
            .all()
        )
        file_paths = [FileStorageService.get_absolute_path(m) for m in metas]

        # Delete response values (no ORM cascade configured on this side).
        db.query(ResponseValue).filter(
            ResponseValue.submission_id.in_(submission_ids)
        ).delete(synchronize_session=False)

        # Delete file metadata rows (DB side only).
        db.query(FileMetadata).filter(
            FileMetadata.submission_id.in_(submission_ids)
        ).delete(synchronize_session=False)
        db.flush()

        # Delete the submissions themselves.
        db.query(Submission).filter(
            Submission.id.in_(submission_ids)
        ).delete(synchronize_session=False)
        db.flush()

        # Audit trail for the deletion.
        AuditService.log(
            db,
            action="delete",
            entity_type="submission",
            actor_id=actor_id,
            form_id=form_id,
            details={
                "mode": "selected" if response_ids else "filtered",
                "response_ids": deleted_ids[:50],
                "filters": {
                    "from_date": from_date,
                    "to_date": to_date,
                    "status": status,
                } if not response_ids else None,
            },
            records_affected=len(submissions),
            ip_address=ip_address,
        )
        db.commit()
        # Forget any ORM instances that referenced the deleted rows so a
        # later access cannot resurrect stale objects.
        db.expire_all()

        # Archived/active analytics are stale now.
        AnalyticsService.invalidate(form_id)

        # Delete physical files AFTER the transaction committed (best effort).
        # A failure here only leaves orphaned files — never broken DB rows.
        for path in file_paths:
            FileStorageService.delete_physical_file(path)

        return {"deleted": len(submissions), "deleted_ids": deleted_ids}

    # ─── Detail ────────────────────────────────────────────────────

    @classmethod
    def get_response_detail(
        cls,
        db: Session,
        response_id: str,
        base_url: str = "",
    ) -> Dict[str, Any]:
        """
        Full detail for one response (powers the detail modal).

        Includes every field/value, file download URLs, metadata and
        submission timestamps.
        """
        submission = (
            db.query(Submission)
            .filter(Submission.response_id == response_id)
            .first()
        )
        if not submission:
            raise ValueError(f"Response '{response_id}' not found")

        form = db.query(Form).filter(Form.id == submission.form_id).first()

        values = (
            db.query(ResponseValue)
            .filter(ResponseValue.submission_id == submission.id)
            .all()
        )
        field_ids = {v.field_id for v in values}
        fields = (
            db.query(Field).filter(Field.id.in_(field_ids)).all()
            if field_ids
            else []
        )
        field_map = {f.id: f for f in fields}

        # Batch file metadata → download URLs
        metas = (
            db.query(FileMetadata)
            .filter(FileMetadata.submission_id == submission.id)
            .all()
        )
        files = []
        file_by_field: Dict[int, Dict[str, Any]] = {}
        for m in metas:
            if m.download_token:
                info = FileStorageService.get_file_info_response(m, base_url=base_url)
                files.append(info)
                file_by_field[m.field_id] = info

        response_list = []
        summary: Dict[str, Any] = {}
        for v in values:
            field = field_map.get(v.field_id)
            label = field.label if field else f"Field #{v.field_id}"
            field_type = field.field_type if field else "unknown"
            display = cls._display_value(v.value, field_type)
            if field_type != "file":
                summary[label] = display
            response_list.append({
                "field_id": v.field_id,
                "field_label": label,
                "field_type": field_type,
                "value": display,
                "file_download_url": (
                    file_by_field.get(v.field_id, {}).get("download_url")
                ),
                "file_content_type": (
                    file_by_field.get(v.field_id, {}).get("content_type")
                ),
            })

        return {
            "response_id": submission.response_id,
            "form_id": submission.form_id,
            "form_title": form.title if form else "",
            "form_version_id": submission.form_version_id,
            "status": submission.status,
            "submitted_at": submission.submitted_at,
            "created_at": submission.created_at,
            "started_at": submission.started_at,
            "time_to_complete": cls._time_to_complete(submission),
            "responses": response_list,
            "files": files,
            "summary": summary,
        }
