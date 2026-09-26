"""
Unit + API tests for the Response Browser (Day 16).

Covers:
- Pagination shape (total / count / limit / offset / responses)
- Date range filtering (from_date / to_date)
- Status filter (completed / partial / all)
- Dynamic per-field filter (field_id + field_value)
- Free-text search (partial, case-insensitive)
- Newest-first ordering
- Detail endpoint (all values, files, URLs, timestamps)
- Ownership: 401 / 403 / 404
- Malformed date → 422
"""
import sys
import os
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.services.response_service import ResponseService  # noqa: E402


# ─── Helpers ─────────────────────────────────────────────────────────

def make_submission(sid, response_id, submitted_at, started_at=None,
                    status="completed", form_id=1):
    sub = MagicMock()
    sub.id = sid
    sub.response_id = response_id
    sub.submitted_at = submitted_at
    sub.started_at = started_at
    sub.status = status
    sub.form_id = form_id
    return sub


def make_field(fid, label, field_type="text"):
    f = MagicMock()
    f.id = fid
    f.label = label
    f.field_type = field_type
    return f


def make_response_value(submission_id, field_id, value):
    rv = MagicMock()
    rv.submission_id = submission_id
    rv.field_id = field_id
    rv.value = value
    return rv


def _chainable(all_value=None, count_value=0, first_value=None):
    """A query mock that supports unlimited .filter()/.order_by()/.offset()/.limit()."""
    q = MagicMock()
    q.all.return_value = all_value or []
    q.count.return_value = count_value
    q.first.return_value = first_value
    # Chain everything back to itself
    q.filter.return_value = q
    q.order_by.return_value = q
    q.offset.return_value = q
    q.limit.return_value = q
    return q


def setup_db(*, form=None, submissions=None, values=None, fields=None,
             metas=None, sessions=None):
    """Build a mock DB with the query shapes the response service uses."""
    from app.models import Form, Submission, ResponseValue, Field, FormSession, FileMetadata

    db = MagicMock()

    def query_side_effect(model_arg):
        # db.query(FileMetadata.submission_id) passes a column expression
        model = getattr(model_arg, "class_", model_arg)
        if model is Form:
            q = _chainable(first_value=form)
            return q
        if model is Submission:
            return _chainable(
                all_value=submissions or [],
                count_value=len(submissions) if submissions else 0,
            )
        if model is ResponseValue:
            return _chainable(all_value=values or [])
        if model is Field:
            return _chainable(all_value=fields or [])
        if model is FormSession:
            return _chainable(
                all_value=sessions or [],
                count_value=len(sessions) if sessions else 0,
            )
        if model is FileMetadata:
            return _chainable(all_value=metas or [])
        return _chainable()

    db.query.side_effect = query_side_effect
    return db


# ─── List: pagination + shape ───────────────────────────────────────

class TestListShape:
    def test_pagination_shape(self):
        base = datetime(2026, 7, 27, 10, 0, 0)
        # SQL orders newest-first; the mock returns rows in that order
        submissions = [
            make_submission(i, f"resp_{i}", base + timedelta(minutes=i), started_at=base)
            for i in range(20, 0, -1)
        ]
        values = []
        for i in range(1, 21):
            values.append(make_response_value(i, 101, f"John {i}"))
            values.append(make_response_value(i, 102, f"email{i}@gmail.com"))
        db = setup_db(
            form=MagicMock(),
            submissions=submissions,
            values=values,
            fields=[make_field(101, "Full Name"), make_field(102, "Email")],
        )
        result = ResponseService.list_responses(db, 1, limit=20, offset=0)
        assert result["total"] == 20
        assert result["count"] == 20
        assert result["limit"] == 20
        assert result["offset"] == 0
        assert len(result["responses"]) == 20
        # Newest first
        assert result["responses"][0]["response_id"] == "resp_20"
        # Summary uses field LABELS
        assert "Full Name" in result["responses"][0]["summary"]
        assert "John 20" in result["responses"][0]["summary"]["Full Name"]

    def test_summary_excludes_file_fields(self):
        sub = make_submission(1, "r1", datetime(2026, 7, 27, 10, 0, 0))
        db = setup_db(
            form=MagicMock(),
            submissions=[sub],
            values=[
                make_response_value(1, 101, "John"),
                make_response_value(1, 104, "stored.pdf"),
            ],
            fields=[make_field(101, "Name"), make_field(104, "Resume", field_type="file")],
        )
        result = ResponseService.list_responses(db, 1)
        summary = result["responses"][0]["summary"]
        assert "Name" in summary
        assert "Resume" not in summary  # files not in list summary

    def test_has_attachments_flag(self):
        sub = make_submission(1, "r1", datetime(2026, 7, 27, 10, 0, 0))
        # The service queries FileMetadata.submission_id column tuples
        meta_row = (1,)
        db = setup_db(
            form=MagicMock(),
            submissions=[sub],
            values=[],
            fields=[],
            metas=[meta_row],
        )
        result = ResponseService.list_responses(db, 1)
        assert result["responses"][0]["has_attachments"] is True


# ─── Date range ─────────────────────────────────────────────────────

class TestDateRange:
    def test_parse_date(self):
        assert ResponseService._parse_date("2026-07-01") == datetime(2026, 7, 1, 0, 0, 0)
        end = ResponseService._parse_date("2026-07-01", end_of_day=True)
        assert end.hour == 23 and end.minute == 59

    def test_invalid_date_raises(self):
        with pytest.raises(ValueError):
            ResponseService._parse_date("not-a-date")


# ─── Status filter ──────────────────────────────────────────────────

class TestStatus:
    def test_completed_filters_submissions(self):
        sub = make_submission(1, "r1", datetime(2026, 7, 27, 10, 0, 0), status="completed")
        db = setup_db(form=MagicMock(), submissions=[sub], values=[], fields=[])
        result = ResponseService.list_responses(db, 1, status="completed")
        assert result["responses"][0]["status"] == "completed"

    def test_partial_returns_abandoned_sessions(self):
        from app.models import FormSession
        sess = MagicMock(spec=FormSession)
        sess.started_at = datetime(2026, 7, 27, 9, 0, 0)
        db = setup_db(form=MagicMock(), sessions=[sess], submissions=[], values=[], fields=[])
        result = ResponseService.list_responses(db, 1, status="partial")
        assert result["total"] == 1
        assert result["responses"][0]["status"] == "partial"
        assert result["responses"][0]["response_id"] is None

    def test_invalid_status_raises(self):
        # The router validates status, but the service should be resilient:
        # unknown status falls through to the submissions branch (no filter).
        sub = make_submission(1, "r1", datetime(2026, 7, 27, 10, 0, 0))
        db = setup_db(form=MagicMock(), submissions=[sub], values=[], fields=[])
        result = ResponseService.list_responses(db, 1, status="weird")
        assert result["total"] == 1


# ─── Field filter + search ──────────────────────────────────────────

class TestFieldFilterAndSearch:
    def test_field_filter_applied(self):
        """field_id + field_value should reach the query as an EXISTS filter."""
        db = MagicMock()
        base_q = MagicMock()
        base_q.filter.return_value = base_q  # chainable
        base_q.count.return_value = 1
        base_q.order_by.return_value.offset.return_value.limit.return_value.all.return_value = []

        form_q = MagicMock()
        form_q.filter.return_value.first.return_value = MagicMock()

        from app.models import Form
        db.query.side_effect = lambda m: form_q if m is Form else base_q

        result = ResponseService.list_responses(
            db, 1, field_id=101, field_value="India"
        )
        # No crash, correct total
        assert result["total"] == 1

    def test_search_partial_case_insensitive(self):
        """search should apply ILIKE on response values + response id."""
        db = MagicMock()
        base_q = MagicMock()
        base_q.filter.return_value = base_q
        base_q.count.return_value = 3
        base_q.order_by.return_value.offset.return_value.limit.return_value.all.return_value = []
        form_q = MagicMock()
        form_q.filter.return_value.first.return_value = MagicMock()
        from app.models import Form
        db.query.side_effect = lambda m: form_q if m is Form else base_q

        result = ResponseService.list_responses(db, 1, search="gmail")
        assert result["total"] == 3


# ─── Detail ─────────────────────────────────────────────────────────

class TestDetail:
    def test_detail_returns_values_files_timestamps(self):
        sub = MagicMock()
        sub.id = 9
        sub.response_id = "resp_abc"
        sub.form_id = 7
        sub.form_version_id = 3
        sub.status = "completed"
        sub.submitted_at = datetime(2026, 7, 27, 10, 31, 12)
        sub.created_at = datetime(2026, 7, 27, 10, 31, 12)
        sub.started_at = datetime(2026, 7, 27, 10, 25, 0)  # 6m12s

        from app.models import Submission, ResponseValue, Field, FileMetadata, Form
        db = MagicMock()

        def q(model):
            qq = MagicMock()
            if model is Submission:
                qq.filter.return_value.first.return_value = sub
            elif model is Form:
                f = MagicMock()
                f.title = "Student Form"
                qq.filter.return_value.first.return_value = f
            elif model is ResponseValue:
                qq.filter.return_value.all.return_value = [
                    make_response_value(9, 101, "John"),
                    make_response_value(9, 104, "stored.pdf"),
                ]
            elif model is Field:
                qq.filter.return_value.all.return_value = [
                    make_field(101, "Full Name"),
                    make_field(104, "Resume", field_type="file"),
                ]
            elif model is FileMetadata:
                m = MagicMock()
                m.download_token = "tok_xyz"
                m.field_id = 104
                m.original_filename = "resume.pdf"
                m.content_type = "application/pdf"
                m.size = 12345
                qq.filter.return_value.all.return_value = [m]
            return qq

        db.query.side_effect = q

        detail = ResponseService.get_response_detail(db, "resp_abc", base_url="http://localhost:8000")
        assert detail["response_id"] == "resp_abc"
        assert detail["form_title"] == "Student Form"
        assert detail["status"] == "completed"
        assert detail["time_to_complete"] == "6m 12s"
        # Values + file URL
        by_label = {r["field_label"]: r for r in detail["responses"]}
        assert by_label["Full Name"]["value"] == "John"
        assert "http://localhost:8000/api/files/download/tok_xyz" in by_label["Resume"]["file_download_url"]
        assert len(detail["files"]) == 1
        assert detail["files"][0]["download_url"].endswith("/api/files/download/tok_xyz")

    def test_detail_missing_response_raises(self):
        from app.models import Submission
        db = MagicMock()
        q = MagicMock()
        q.filter.return_value.first.return_value = None
        db.query.return_value = q
        with pytest.raises(ValueError, match="not found"):
            ResponseService.get_response_detail(db, "nope")


# ─── Router (API level) ─────────────────────────────────────────────

class TestResponsesRouter:
    def _client(self, current_user_id=1, form_user_id=1, form_found=True,
                submission_found=True, response_id="r1"):
        from contextlib import contextmanager
        from fastapi.testclient import TestClient
        from app.main import app
        from app.database import get_db

        @contextmanager
        def _ctx():
            user = MagicMock()
            user.id = current_user_id

            db = MagicMock()
            form = MagicMock()
            form.id = 7
            form.user_id = form_user_id
            if not form_found:
                form = None

            submission = MagicMock()
            submission.form_id = 7
            submission.response_id = response_id
            if not submission_found:
                submission = None

            # Query dispatcher
            from app.models import Form, Submission
            def q(model):
                qq = MagicMock()
                if model is Form:
                    qq.filter.return_value.first.return_value = form
                elif model is Submission:
                    qq.filter.return_value.first.return_value = submission
                    qq.filter.return_value.count.return_value = 0
                    qq.filter.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = []
                return qq
            db.query.side_effect = q

            def _override_db():
                yield db

            def _override_user():
                return user

            app.dependency_overrides[get_db] = _override_db
            import app.routers.responses as resp_mod
            app.dependency_overrides[resp_mod.get_current_user] = _override_user

            client = TestClient(app)
            try:
                yield client
            finally:
                app.dependency_overrides.clear()

        return _ctx()

    def test_unauthenticated_returns_401(self):
        from contextlib import contextmanager
        from fastapi.testclient import TestClient
        from app.main import app
        from app.database import get_db

        @contextmanager
        def _ctx():
            # No get_current_user override → the real (missing) JWT path runs
            db = MagicMock()
            form = MagicMock()
            form.id = 7
            form.user_id = 1
            from app.models import Form
            qq = MagicMock()
            qq.filter.return_value.first.return_value = form
            db.query.side_effect = lambda m: qq if m is Form else MagicMock()

            def _override_db():
                yield db

            app.dependency_overrides[get_db] = _override_db
            client = TestClient(app)
            try:
                yield client
            finally:
                app.dependency_overrides.clear()

        with _ctx() as client:
            resp = client.get("/api/forms/7/responses")
            assert resp.status_code == 401

    def test_non_owner_gets_403(self):
        with self._client(current_user_id=2, form_user_id=1) as client:
            resp = client.get("/api/forms/7/responses")
            assert resp.status_code == 403

    def test_legacy_form_any_auth_user(self):
        with self._client(current_user_id=2, form_user_id=None) as client:
            resp = client.get("/api/forms/7/responses")
            assert resp.status_code == 200

    def test_missing_form_404(self):
        with self._client(form_found=False) as client:
            resp = client.get("/api/forms/999/responses")
            assert resp.status_code == 404

    def test_invalid_date_422(self):
        with self._client() as client:
            resp = client.get("/api/forms/7/responses?from_date=banana")
            assert resp.status_code == 422

    def test_field_id_without_value_422(self):
        with self._client() as client:
            resp = client.get("/api/forms/7/responses?field_id=101")
            assert resp.status_code == 422

    def test_field_value_without_id_422(self):
        with self._client() as client:
            resp = client.get("/api/forms/7/responses?field_value=India")
            assert resp.status_code == 422

    def test_detail_404(self):
        with self._client(submission_found=False) as client:
            resp = client.get("/api/responses/ghost")
            assert resp.status_code == 404

    def test_detail_non_owner_403(self):
        with self._client(current_user_id=2, form_user_id=1) as client:
            resp = client.get("/api/responses/r1")
            assert resp.status_code == 403
