"""
Export service (Day 15 / Milestone 3).

Generates downloadable CSV / JSON exports of form responses.

Design goals:
- Export ONLY responses belonging to the requested form (and version).
- Column headers are FIELD LABELS, never internal field ids.
- File-upload responses export as download URLs (never binary).
- System metadata columns (submission id, timestamps, version, status,
  completion time / duration) are included.
- Memory efficient: CSV rows are generated lazily and streamed via
  StreamingResponse; JSON is streamed as an array too, so large datasets
  never load fully into memory.
- Avoids N+1: response values and file metadata are fetched in batch.
- Every export is logged (user, form, rows, duration).
"""
import csv
import io
import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, Iterator, List, Optional

from sqlalchemy.orm import Session

from ..models import Form, FormVersion, Submission, ResponseValue, FileMetadata
from .file_storage_service import FileStorageService

logger = logging.getLogger("dynamic_form_workflow")

# ─── System (metadata) columns appended after the form's field labels ──
SYSTEM_COLUMNS = [
    "Submission ID",
    "Submitted At",
    "Created At",
    "Updated At",
    "Form Version",
    "Response Status",
    "Completion Time",
    "Submission Duration",
]


class ExportService:
    """CSV / JSON export of form responses."""

    SUPPORTED_FORMATS = ("csv", "json")

    # ─── Entry point ─────────────────────────────────────────────────

    @classmethod
    def build_export(
        cls,
        db: Session,
        form_id: int,
        export_format: str,
        version: Optional[str] = "latest",
        base_url: str = "",
    ) -> Dict[str, Any]:
        """
        Build the export payload.

        Returns a dict with:
            content_type  – "text/csv" | "application/json"
            filename      – e.g. "CustomerSurvey_2026.csv"
            iterator      – a generator yielding the raw body chunks
            row_count     – number of responses exported

        Raises ValueError with a user-facing message on invalid input.
        """
        start = time.perf_counter()

        if export_format not in cls.SUPPORTED_FORMATS:
            raise ValueError(
                f"Unsupported export format '{export_format}'. Supported: csv, json."
            )

        form = db.query(Form).filter(Form.id == form_id).first()
        if not form:
            raise ValueError(f"Form with id {form_id} not found")

        target_version = cls._resolve_version(db, form_id, version)
        fields = cls._get_version_fields(db, target_version.id)
        field_labels = [f.label for f in fields]

        # `latest` (default) exports EVERY response of the form — matching what
        # the response browser shows — using the latest version's fields as
        # column headers. Otherwise a form that is edited/published again would
        # silently export an empty file while responses exist. An explicit
        # version id keeps the exact version-scoped export.
        export_all_versions = version is None or str(version).lower() in ("latest", "")

        filter_criteria = [Submission.form_id == form_id]
        if not export_all_versions:
            filter_criteria.append(Submission.form_version_id == target_version.id)

        submissions = (
            db.query(Submission)
            .filter(*filter_criteria)
            .order_by(Submission.submitted_at.asc())
            .all()
        )

        rows_meta = cls._load_rows_meta(db, submissions, base_url)

        headers = field_labels + SYSTEM_COLUMNS
        filename = cls._build_filename(form.title, export_format)

        def generate() -> Iterator[str]:
            if export_format == "csv":
                yield from cls._iter_csv(headers, submissions, rows_meta, fields)
            else:
                yield from cls._iter_json(headers, submissions, rows_meta, fields)

        elapsed = time.perf_counter() - start
        logger.info(
            "Export generated | form_id=%s format=%s version=%s rows=%s base_url=%s elapsed=%.3fs",
            form_id, export_format, version, len(submissions), base_url, elapsed,
        )

        return {
            "content_type": "text/csv" if export_format == "csv" else "application/json",
            "filename": filename,
            "iterator": generate(),
            "row_count": len(submissions),
        }

    # ─── Version resolution ─────────────────────────────────────────

    @staticmethod
    def _resolve_version(
        db: Session, form_id: int, version: Optional[str]
    ) -> FormVersion:
        """Resolve 'latest' or an explicit version id to a FormVersion.

        Raises ValueError (→ 404) when the version does not belong to the form.
        """
        if version is None or str(version).lower() in ("latest", ""):
            target = (
                db.query(FormVersion)
                .filter(FormVersion.form_id == form_id)
                .order_by(FormVersion.version_number.desc())
                .first()
            )
        else:
            try:
                version_id = int(version)
            except (ValueError, TypeError):
                raise ValueError(f"Invalid version '{version}'. Use 'latest' or a version id.")
            target = (
                db.query(FormVersion)
                .filter(FormVersion.id == version_id, FormVersion.form_id == form_id)
                .first()
            )

        if not target:
            raise ValueError(f"Form with id {form_id} not found")
        return target

    # ─── Data loading (batch, no N+1) ───────────────────────────────

    @staticmethod
    def _get_version_fields(db: Session, version_id: int) -> List[Any]:
        from ..models import Field

        return (
            db.query(Field)
            .filter(Field.form_version_id == version_id)
            .order_by(Field.order)
            .all()
        )

    @staticmethod
    def _load_rows_meta(
        db: Session,
        submissions: List[Submission],
        base_url: str,
    ) -> Dict[int, Dict[str, Any]]:
        """Batch-load response values + file download URLs per submission.

        Returns a dict: submission_id -> {"values": {field_id: value},
                                          "files": {field_id: download_url},
                                          "labels": {field_id: label}}

        "labels" maps each stored field id to its label IN THE SUBMISSION'S OWN
        form version, so rows collected on an older version can still be
        matched to the export's (latest-version) column headers.
        """
        if not submissions:
            return {}

        submission_ids = [s.id for s in submissions]

        response_values = (
            db.query(ResponseValue)
            .filter(ResponseValue.submission_id.in_(submission_ids))
            .all()
        )

        file_metas = (
            db.query(FileMetadata)
            .filter(FileMetadata.submission_id.in_(submission_ids))
            .all()
        )
        file_lookup: Dict[tuple, str] = {}
        for fm in file_metas:
            if fm.download_token:
                info = FileStorageService.get_file_info_response(fm, base_url=base_url)
                file_lookup[(fm.submission_id, fm.field_id)] = info["download_url"]

        # field_id -> label, per submission version (batched, no N+1)
        version_ids = {
            s.form_version_id for s in submissions if s.form_version_id is not None
        }
        labels_by_version: Dict[int, Dict[int, str]] = {}
        if version_ids:
            from ..models import Field

            version_fields = (
                db.query(Field)
                .filter(Field.form_version_id.in_(version_ids))
                .all()
            )
            for vf in version_fields:
                labels_by_version.setdefault(vf.form_version_id, {})[vf.id] = vf.label

        meta: Dict[int, Dict[str, Any]] = {}
        for sub in submissions:
            meta[sub.id] = {
                "values": {},
                "files": {},
                "labels": labels_by_version.get(sub.form_version_id, {}),
            }

        for rv in response_values:
            meta[rv.submission_id]["values"][rv.field_id] = rv.value

        for (sid, fid), url in file_lookup.items():
            if sid in meta:
                meta[sid]["files"][fid] = url

        return meta

    # ─── Row building ────────────────────────────────────────────────

    @staticmethod
    def _value_for_field(value: Any) -> Any:
        """Normalize a stored response value for export.

        - JSON-serialized lists/dicts (checkbox multi-select) are returned
          as Python objects so CSV writers can stringify them cleanly.
        """
        if value is None:
            return ""
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, (list, dict)):
                    return parsed
            except (ValueError, TypeError):
                pass
        return value

    @classmethod
    def _build_row(
        cls,
        sub: Submission,
        row_meta: Dict[str, Any],
        fields: List[Any],
    ) -> List[Any]:
        """One export row: field values (labels order) + system columns."""
        values = row_meta["values"]
        files = row_meta["files"]
        labels = row_meta.get("labels") or {}

        # Label-keyed fallbacks: rows submitted against an older form version
        # store different field ids than the exported (latest) version, so an
        # id lookup alone would silently drop their values. Same-version rows
        # still resolve by id first and are unaffected.
        values_by_label: Dict[str, Any] = {}
        files_by_label: Dict[str, str] = {}
        if labels:
            for fid, val in values.items():
                label = labels.get(fid)
                if label is not None and label not in values_by_label:
                    values_by_label[label] = val
            for fid, url in files.items():
                label = labels.get(fid)
                if label is not None and label not in files_by_label:
                    files_by_label[label] = url

        row: List[Any] = []
        for field in fields:
            if field.field_type == "file":
                url = files.get(field.id)
                if url is None:
                    url = files_by_label.get(field.label, "")
                row.append(url)
            else:
                value = values.get(field.id)
                if value is None:
                    value = values_by_label.get(field.label)
                row.append(cls._value_for_field(value))

        # ── System columns ───────────────────────────────────────────
        duration_seconds: Optional[int] = None
        if sub.started_at and sub.submitted_at:
            delta = (sub.submitted_at - sub.started_at).total_seconds()
            if delta >= 0:
                duration_seconds = int(round(delta))

        row.append(sub.response_id)
        row.append(sub.submitted_at.isoformat() if sub.submitted_at else "")
        row.append(sub.created_at.isoformat() if sub.created_at else "")
        # Submissions are immutable — there is no updated_at column.
        row.append(sub.created_at.isoformat() if sub.created_at else "")
        row.append(sub.form_version_id)
        row.append(sub.status or "")
        row.append(cls._format_duration(duration_seconds) if duration_seconds is not None else "")
        row.append(duration_seconds if duration_seconds is not None else "")

        return row

    # ─── Serializers (streaming) ────────────────────────────────────

    @classmethod
    def _iter_csv(
        cls,
        headers: List[str],
        submissions: List[Submission],
        rows_meta: Dict[int, Dict[str, Any]],
        fields: List[Any],
    ) -> Iterator[str]:
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(headers)
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)

        for sub in submissions:
            writer.writerow(cls._build_row(sub, rows_meta[sub.id], fields))
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)

    @classmethod
    def _iter_json(
        cls,
        headers: List[str],
        submissions: List[Submission],
        rows_meta: Dict[int, Dict[str, Any]],
        fields: List[Any],
    ) -> Iterator[str]:
        yield "["
        for idx, sub in enumerate(submissions):
            row = cls._build_row(sub, rows_meta[sub.id], fields)
            obj: Dict[str, Any] = {}
            for label, value in zip(headers, row):
                obj[label] = value
            body = json.dumps(obj, ensure_ascii=False)
            yield body if idx == 0 else f",{body}"
        yield "]"

    # ─── Helpers ─────────────────────────────────────────────────────

    @staticmethod
    def _format_duration(total_seconds: int) -> str:
        """Compact human-readable duration (same convention as analytics)."""
        total_seconds = max(0, int(total_seconds))
        hours, rem = divmod(total_seconds, 3600)
        minutes, seconds = divmod(rem, 60)
        if hours:
            return f"{hours}h {minutes}m" if minutes else f"{hours}h"
        if minutes:
            return f"{minutes}m {seconds}s" if seconds else f"{minutes}m"
        return f"{seconds}s"

    @staticmethod
    def _build_filename(form_title: str, export_format: str) -> str:
        """Sanitize the form title into a safe filename, e.g. CustomerSurvey_2026.csv."""
        slug = re.sub(r"[^A-Za-z0-9]+", "", form_title or "Form") or "Form"
        year = datetime.now(timezone.utc).year
        return f"{slug}_{year}.{export_format}"
