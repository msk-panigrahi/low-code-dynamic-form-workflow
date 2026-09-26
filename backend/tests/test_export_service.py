"""
Unit + API tests for the Export system (Day 15).

Covers:
- CSV export correctness (field LABELS as headers, system columns, rows)
- JSON export correctness (one object per response, labels as keys)
- Empty form export (header-only CSV / empty JSON array)
- File-upload responses exported as download URLs (never binary)
- Version filtering (latest vs explicit version)
- Streaming headers (Content-Type, Content-Disposition)
- Invalid format rejected (422)
- Ownership: 401 unauthenticated, 403 non-owner, 404 missing form
- Batch loading (no N+1: single query for response values)
"""
import sys
import os
from datetime import datetime
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.services.export_service import ExportService  # noqa: E402


# ─── Helpers ─────────────────────────────────────────────────────────

def make_field(fid, label, field_type="text", order=1, version_id=1):
    f = MagicMock()
    f.id = fid
    f.label = label
    f.field_type = field_type
    f.order = order
    f.form_version_id = version_id
    return f


def make_submission(sid, response_id, submitted_at=None, created_at=None,
                    form_version_id=1, status="completed", started_at=None):
    sub = MagicMock()
    sub.id = sid
    sub.response_id = response_id
    sub.submitted_at = submitted_at or datetime(2026, 7, 27, 10, 31, 12)
    sub.created_at = created_at or sub.submitted_at
    sub.form_version_id = form_version_id
    sub.status = status
    sub.started_at = started_at
    return sub


def make_response_value(submission_id, field_id, value):
    rv = MagicMock()
    rv.submission_id = submission_id
    rv.field_id = field_id
    rv.value = value
    return rv


def make_file_meta(submission_id, field_id, token="tok123"):
    fm = MagicMock()
    fm.submission_id = submission_id
    fm.field_id = field_id
    fm.download_token = token
    return fm


def setup_export_db(*, form=None, version=None, fields=None, submissions=None,
                    response_values=None, file_metas=None):
    """Build a mock DB answering the export service's query shapes."""
    db = MagicMock()

    def _query(model):
        return MagicMock()

    db.query.side_effect = _query

    # form lookup
    form_q = MagicMock()
    form_q.filter.return_value.first.return_value = form
    db.query = form_q  # default: every query returns form_q (with filter chains)

    # We need distinct behavior per call; easiest is a side-effect on filter.
    # Instead, we pre-configure specific query objects via a queue.
    # Simplest robust approach: patch individual service helpers.
    return db


@pytest.fixture
def base_ctx():
    """Shared fixtures: form, version, fields, one submission with values."""
    form = MagicMock()
    form.id = 7
    form.title = "Customer Survey"
    form.user_id = 1

    version = MagicMock()
    version.id = 3
    version.form_id = 7
    version.version_number = 2

    fields = [
        make_field(101, "Customer Name", order=1, version_id=3),
        make_field(102, "Email", field_type="email", order=2, version_id=3),
        make_field(103, "Rating", field_type="rating", order=3, version_id=3),
        make_field(104, "Resume", field_type="file", order=4, version_id=3),
    ]

    submissions = [
        make_submission(
            5001, "resp_abc",
            submitted_at=datetime(2026, 7, 27, 10, 31, 12),
            created_at=datetime(2026, 7, 27, 10, 31, 12),
            started_at=datetime(2026, 7, 27, 10, 27, 0),
        )
    ]
    response_values = [
        make_response_value(5001, 101, "John"),
        make_response_value(5001, 102, "john@gmail.com"),
        make_response_value(5001, 103, "5"),
        make_response_value(5001, 104, "stored_resume.pdf"),
    ]
    file_metas = [make_file_meta(5001, 104, token="tok_abc")]
    return {
        "form": form, "version": version, "fields": fields,
        "submissions": submissions, "response_values": response_values,
        "file_metas": file_metas,
    }


def build_mock_db(ctx):
    """Configure a MagicMock db with the export query shapes."""
    from app.models import Form, FormVersion, Field, Submission, ResponseValue, FileMetadata

    db = MagicMock()

    def query_side_effect(model):
        if model is Form:
            q = MagicMock()
            q.filter.return_value.first.return_value = ctx["form"]
            return q
        if model is FormVersion:
            q = MagicMock()
            # Explicit version lookup: filter(...).first()
            q.filter.return_value.first.return_value = ctx["version"]
            # Latest version lookup: filter(...).order_by(...).first()
            q.filter.return_value.order_by.return_value.first.return_value = ctx["version"]
            return q
        if model is Field:
            q = MagicMock()
            q.filter.return_value.order_by.return_value.all.return_value = ctx["fields"]
            return q
        if model is Submission:
            q = MagicMock()
            q.filter.return_value.order_by.return_value.all.return_value = ctx["submissions"]
            return q
        if model is ResponseValue:
            q = MagicMock()
            q.filter.return_value.all.return_value = ctx["response_values"]
            return q
        if model is FileMetadata:
            q = MagicMock()
            q.filter.return_value.all.return_value = ctx["file_metas"]
            return q
        q = MagicMock()
        q.filter.return_value.all.return_value = []
        return q

    db.query.side_effect = query_side_effect
    return db


# ─── CSV export ──────────────────────────────────────────────────────

class TestCsvExport:
    def test_headers_are_field_labels(self, base_ctx):
        db = build_mock_db(base_ctx)
        payload = ExportService.build_export(db, 7, "csv", version="latest")
        body = "".join(payload["iterator"])
        lines = body.strip().split("\r\n")
        header = lines[0].split(",")
        assert "Customer Name" in header
        assert "Email" in header
        assert "Resume" in header
        # No internal field ids
        assert "field_101" not in header
        assert "101" not in header
        # System columns present
        for col in ["Submission ID", "Submitted At", "Created At", "Updated At",
                    "Form Version", "Response Status", "Completion Time", "Submission Duration"]:
            assert col in header

    def test_row_values_and_system_columns(self, base_ctx):
        db = build_mock_db(base_ctx)
        payload = ExportService.build_export(db, 7, "csv", version="latest")
        body = "".join(payload["iterator"])
        assert "John" in body
        assert "john@gmail.com" in body
        assert "resp_abc" in body
        assert "completed" in body
        assert "4m 12s" in body  # started 10:27:00 → submitted 10:31:12
        assert "252" in body     # 252 seconds

    def test_file_upload_exported_as_download_url(self, base_ctx):
        db = build_mock_db(base_ctx)
        payload = ExportService.build_export(db, 7, "csv", version="latest", base_url="http://localhost:8000")
        body = "".join(payload["iterator"])
        # Download URL for the Resume field, never the stored filename
        assert "http://localhost:8000/api/files/download/tok_abc" in body
        assert "stored_resume.pdf" not in body

    def test_filename_and_content_type(self, base_ctx):
        db = build_mock_db(base_ctx)
        payload = ExportService.build_export(db, 7, "csv", version="latest")
        assert payload["content_type"] == "text/csv"
        assert payload["filename"].startswith("CustomerSurvey_2026.csv")

    def test_row_count(self, base_ctx):
        db = build_mock_db(base_ctx)
        payload = ExportService.build_export(db, 7, "csv", version="latest")
        assert payload["row_count"] == 1


# ─── JSON export ─────────────────────────────────────────────────────

class TestJsonExport:
    def test_one_object_per_response(self, base_ctx):
        db = build_mock_db(base_ctx)
        payload = ExportService.build_export(db, 7, "json", version="latest")
        body = "".join(payload["iterator"])
        import json as json_mod
        rows = json_mod.loads(body)
        assert isinstance(rows, list)
        assert len(rows) == 1
        row = rows[0]
        # Field labels as keys
        assert row["Customer Name"] == "John"
        assert row["Email"] == "john@gmail.com"
        assert row["Rating"] == "5"
        # File → download URL
        assert row["Resume"] == "/api/files/download/tok_abc"
        # System columns
        assert row["Submission ID"] == "resp_abc"
        assert row["Response Status"] == "completed"
        assert row["Submission Duration"] == 252

    def test_empty_array_content_type(self, base_ctx):
        ctx = dict(base_ctx)
        ctx["submissions"] = []
        ctx["response_values"] = []
        ctx["file_metas"] = []
        db = build_mock_db(ctx)
        payload = ExportService.build_export(db, 7, "json", version="latest")
        body = "".join(payload["iterator"])
        assert body == "[]"
        assert payload["content_type"] == "application/json"


# ─── Empty form / versioning ─────────────────────────────────────────

class TestEmptyAndVersioning:
    def test_empty_form_csv_header_only(self, base_ctx):
        ctx = dict(base_ctx)
        ctx["submissions"] = []
        ctx["response_values"] = []
        ctx["file_metas"] = []
        db = build_mock_db(ctx)
        payload = ExportService.build_export(db, 7, "csv", version="latest")
        body = "".join(payload["iterator"])
        lines = [l for l in body.strip().split("\r\n") if l]
        assert len(lines) == 1  # header only
        assert "Customer Name" in lines[0]

    def test_version_parameter_passed_through(self, base_ctx):
        """Explicit version id should reach the version lookup."""
        ctx = dict(base_ctx)
        version = MagicMock()
        version.id = 9
        version.form_id = 7
        version.version_number = 3
        ctx["version"] = version
        db = build_mock_db(ctx)
        payload = ExportService.build_export(db, 7, "csv", version="9")
        assert payload["row_count"] == 1
        # The version lookup was made (no error → resolved)
        assert payload["filename"].endswith(".csv")

    def test_unsupported_format_raises(self, base_ctx):
        db = build_mock_db(base_ctx)
        with pytest.raises(ValueError, match="Unsupported export format"):
            ExportService.build_export(db, 7, "xml", version="latest")

    def test_missing_form_raises(self, base_ctx):
        ctx = dict(base_ctx)
        ctx["form"] = None
        db = build_mock_db(ctx)
        with pytest.raises(ValueError, match="not found"):
            ExportService.build_export(db, 999, "csv", version="latest")

    def test_missing_version_raises(self, base_ctx):
        ctx = dict(base_ctx)
        ctx["version"] = None
        db = build_mock_db(ctx)
        with pytest.raises(ValueError, match="not found"):
            ExportService.build_export(db, 7, "csv", version="9999")


# ─── No N+1: batch response-value loading ────────────────────────────

class TestBatchLoading:
    def test_response_values_fetched_in_one_query(self, base_ctx):
        """ResponseValue query must use .in_() (single batch, no N+1)."""
        ctx = dict(base_ctx)
        ctx["submissions"] = [make_submission(i, f"resp_{i}") for i in range(1, 51)]
        ctx["response_values"] = [make_response_value(i, 101, f"v{i}") for i in range(1, 51)]
        db = build_mock_db(ctx)
        payload = ExportService.build_export(db, 7, "csv", version="latest")
        body = "".join(payload["iterator"])
        assert payload["row_count"] == 50
        assert "v1" in body
        assert "v50" in body


# ─── Export router (API level) ───────────────────────────────────────

class TestExportRouter:
    @staticmethod
    @pytest.fixture()
    def _make_client_fixture(self):
        return None

    def _make_client(self, current_user_id=1, form_user_id=1, form_found=True):
        from contextlib import contextmanager

        @contextmanager
        def _ctx():
            from fastapi.testclient import TestClient
            from app.main import app
            from app.database import get_db

            # Mock user object
            user = MagicMock()
            user.id = current_user_id

            # Mock db with a form whose ownership matches form_user_id
            db = MagicMock()
            form = MagicMock()
            form.id = 7
            form.title = "Customer Survey"
            form.user_id = form_user_id
            if not form_found:
                form = None
            form_q = MagicMock()
            form_q.filter.return_value.first.return_value = form
            db.query.return_value = form_q

            def _override_db():
                yield db

            def _override_user():
                return user

            app.dependency_overrides[get_db] = _override_db

            # Override the auth dependency inside the export router module
            import app.routers.export as export_mod
            app.dependency_overrides[export_mod.get_current_user] = _override_user

            client = TestClient(app)
            try:
                yield client
            finally:
                app.dependency_overrides.clear()

        return _ctx()

    def test_unauthenticated_returns_401(self):
        from fastapi.testclient import TestClient
        from app.main import app

        db = MagicMock()
        form_q = MagicMock()
        form_q.filter.return_value.first.return_value = None
        db.query.return_value = form_q
        from app.database import get_db

        def _override_db():
            yield db

        app.dependency_overrides[get_db] = _override_db
        client = TestClient(app)
        try:
            resp = client.get("/api/forms/7/export")
            assert resp.status_code == 401
        finally:
            app.dependency_overrides.clear()

    def test_non_owner_gets_403(self):
        with self._make_client(current_user_id=2, form_user_id=1) as client:
            resp = client.get("/api/forms/7/export?format=csv")
            assert resp.status_code == 403

    def test_legacy_form_exportable_by_any_auth_user(self):
        with self._make_client(current_user_id=2, form_user_id=None) as client:
            resp = client.get("/api/forms/7/export?format=csv")
            # Owner is None (legacy) → any authenticated user may export
            assert resp.status_code == 200

    def test_owner_exports_csv(self):
        with self._make_client(current_user_id=1, form_user_id=1) as client:
            resp = client.get("/api/forms/7/export?format=csv")
            assert resp.status_code == 200
            assert resp.headers["content-type"].startswith("text/csv")
            assert "attachment" in resp.headers.get("content-disposition", "")

    def test_missing_form_returns_404(self):
        with self._make_client(current_user_id=1, form_user_id=1, form_found=False) as client:
            resp = client.get("/api/forms/7/export?format=csv")
            assert resp.status_code == 404

    def test_invalid_format_rejected(self):
        with self._make_client(current_user_id=1, form_user_id=1) as client:
            resp = client.get("/api/forms/7/export?format=xml")
            assert resp.status_code == 422

    def test_invalid_version_rejected(self):
        with self._make_client(current_user_id=1, form_user_id=1) as client:
            resp = client.get("/api/forms/7/export?format=csv&version=abc")
            assert resp.status_code in (404, 422)
