"""
Unit tests for the Analytics Service (Day 14).

Covers:
- Completion rate calculation (completed / started * 100)
- Average completion time (seconds + human readable)
- Latest submission timestamp
- In-memory cache + invalidation on new submission / session tracking
- Started-session tracking
- Cross-form summary
"""
import sys
import os
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

# Add backend directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.services.analytics_service import AnalyticsService


@pytest.fixture(autouse=True)
def _clear_cache():
    """Clear the module-level analytics cache before every test."""
    AnalyticsService.invalidate_all()
    yield
    AnalyticsService.invalidate_all()


# ─── Helpers ─────────────────────────────────────────────────────────

def make_submission(submitted_at, started_at=None, status="completed", form_id=1):
    sub = MagicMock()
    sub.id = 1
    sub.form_id = form_id
    sub.status = status
    sub.submitted_at = submitted_at
    sub.started_at = started_at
    return sub


def make_session(form_id=1, session_id="s-1", started_at=None):
    sess = MagicMock()
    sess.id = 1
    sess.form_id = form_id
    sess.session_id = session_id
    sess.started_at = started_at or datetime.utcnow()
    return sess


def make_form(form_id=1, title="Customer Feedback"):
    form = MagicMock()
    form.id = form_id
    form.title = title
    form.updated_at = datetime.utcnow()
    return form


def make_version(form_id=1, status="published", version_number=2):
    v = MagicMock()
    v.form_id = form_id
    v.status = status
    v.version_number = version_number
    return v


def setup_db(*, forms=None, submissions=None, sessions=None, versions=None):
    """Build a mock DB whose scalar()/all()/first() return the given data."""
    from app.models import Form, FormVersion, Submission, FormSession

    class StubQuery:
        def __init__(self):
            self.scalar_value = 0
            self.all_value = []
            self.first_value = None
            self.filters = []
            # Optional per-form counts used by the summary aggregation test.
            self.scalar_by_form = {}
            self.current_form_id = None

        def filter(self, *a, **k):
            self.filters.append((a, k))
            # Extract form_id from `Submission.form_id == <id>` filters without
            # evaluating SQLAlchemy clauses (which raises on bool()).
            for arg in a:
                left_name = None
                right_val = None
                try:
                    left_name = getattr(arg.left, "name", None)
                    right = arg.right
                    right_val = getattr(right, "value", right)
                except Exception:
                    continue
                if left_name == "form_id" and right_val is not None:
                    self.current_form_id = right_val
            return self

        def order_by(self, *a, **k):
            return self

        def group_by(self, *a, **k):
            return self

        def count(self):
            return len(self.all_value) if self.all_value else 0

        def scalar(self):
            if self.current_form_id is not None and self.current_form_id in self.scalar_by_form:
                return self.scalar_by_form[self.current_form_id]
            return self.scalar_value

        def _matches_filters(self, row):
            """Apply recorded equality / inequality / is-not-null filters to a mock row."""
            import sqlalchemy.sql.operators as _ops

            for a, k in self.filters:
                for arg in a:
                    try:
                        left_name = getattr(arg.left, "name", None)
                    except Exception:
                        continue
                    if left_name is None:
                        continue
                    right = getattr(arg, "right", None)
                    if right is None:
                        continue
                    right_value = getattr(right, "value", None)
                    op = getattr(arg, "operator", None)
                    is_ne = op is _ops.ne or (
                        op is not None and getattr(op, "__name__", "") == "ne"
                    )
                    if right_value is None and not isinstance(right_value, bool):
                        # `X.isnot(None)` renders as a Null right-hand side ->
                        # the row must have a non-None value for this column.
                        if getattr(row, left_name, None) is None:
                            return False
                    elif is_ne:
                        # `X != value` — row must NOT equal the value.
                        if getattr(row, left_name, None) == right_value:
                            return False
                    else:
                        if getattr(row, left_name, None) != right_value:
                            return False
            return True

        def all(self):
            if not self.filters:
                return self.all_value
            return [r for r in self.all_value if self._matches_filters(r)]

        def first(self):
            return self.first_value

    # Pre-create one stub per model so configuration below always succeeds.
    queries = {
        "form": StubQuery(),
        "version": StubQuery(),
        "submission": StubQuery(),
        "session": StubQuery(),
        "other": StubQuery(),
    }

    def _resolve_model(model):
        """Resolve the SQLAlchemy model behind a query arg (handles func.count(...))."""
        if model is Form:
            return "form"
        if model is FormVersion:
            return "version"
        if model is Submission:
            return "submission"
        if model is FormSession:
            return "session"
        # func.date(...) — submissions-over-time trend query; these mocks have no rows.
        if getattr(model, "name", None) == "date":
            return "other"
        # SQL functions like func.count(Submission.id) wrap the underlying table.
        try:
            table_name = getattr(list(model._from_objects)[0], "name", None)
        except Exception:
            table_name = None
        if table_name == "submissions":
            return "submission"
        if table_name == "form_sessions":
            return "session"
        if table_name == "forms":
            return "form"
        if table_name == "form_versions":
            return "version"
        return "other"

    def query(model, *args):
        return queries[_resolve_model(model)]

    db = MagicMock()
    db.query.side_effect = query

    # Configure returns
    if forms:
        queries["form"].first_value = forms[0]
        queries["form"].all_value = forms
    if versions:
        queries["version"].first_value = versions[0]
    if submissions is not None:
        queries["submission"].scalar_value = len(submissions)
        queries["submission"].all_value = submissions
        queries["submission"].first_value = submissions[0] if submissions else None
    if sessions is not None:
        queries["session"].scalar_value = len(sessions)
        queries["session"].all_value = sessions

    return db, queries


# ─── format_duration ─────────────────────────────────────────────────

class TestFormatDuration:
    def test_seconds(self):
        assert AnalyticsService.format_duration(35) == "35s"

    def test_minutes_and_seconds(self):
        assert AnalyticsService.format_duration(138) == "2m 18s"

    def test_exact_minutes(self):
        # Never "14m 0s"
        assert AnalyticsService.format_duration(840) == "14m"

    def test_hours_and_minutes(self):
        assert AnalyticsService.format_duration(3661) == "1h 1m"
        assert AnalyticsService.format_duration(3900) == "1h 5m"

    def test_exact_hour(self):
        # Never "1h 0m"
        assert AnalyticsService.format_duration(3600) == "1h"
        assert AnalyticsService.format_duration(7200) == "2h"

    def test_zero(self):
        assert AnalyticsService.format_duration(0) == "0s"

    def test_negative_clamped(self):
        assert AnalyticsService.format_duration(-5) == "0s"


# ─── Completion rate (validation cases) ─────────────────────────────

class TestCompletionRate:
    # Case 1: started=10, completed=8 -> 80%
    def test_case1_started10_completed8(self):
        db, _ = setup_db(
            forms=[make_form()],
            submissions=[make_submission(datetime.utcnow())] * 8,
            sessions=[make_session()] * 10,
            versions=[make_version()],
        )
        result = AnalyticsService.get_form_analytics(db, 1)
        assert result["completed_submissions"] == 8
        assert result["started_sessions"] == 10
        assert result["completion_rate"] == pytest.approx(80.0, abs=0.1)

    # Case 2: started=3, completed=3 -> 100%
    def test_case2_started3_completed3(self):
        db, _ = setup_db(
            forms=[make_form()],
            submissions=[make_submission(datetime.utcnow())] * 3,
            sessions=[make_session()] * 3,
            versions=[make_version()],
        )
        result = AnalyticsService.get_form_analytics(db, 1)
        assert result["completion_rate"] == pytest.approx(100.0, abs=0.1)

    # Case 3: started=0, completed=0 -> 0% (no data)
    def test_case3_no_data(self):
        db, _ = setup_db(
            forms=[make_form()],
            submissions=[],
            sessions=[],
            versions=[make_version()],
        )
        result = AnalyticsService.get_form_analytics(db, 1)
        assert result["completion_rate"] == 0.0
        assert result["average_completion_time"] == "0s"

    # Case 4: started=5, completed=0 -> 0%
    def test_case4_started5_completed0(self):
        db, _ = setup_db(
            forms=[make_form()],
            submissions=[],
            sessions=[make_session()] * 5,
            versions=[make_version()],
        )
        result = AnalyticsService.get_form_analytics(db, 1)
        assert result["completion_rate"] == 0.0

    # Case 5: legacy started=2, completed=5 -> 100%, never 250%
    def test_case5_legacy_capped_at_100(self):
        db, _ = setup_db(
            forms=[make_form()],
            submissions=[make_submission(datetime.utcnow())] * 5,
            sessions=[make_session()] * 2,
            versions=[make_version()],
        )
        result = AnalyticsService.get_form_analytics(db, 1)
        assert result["completion_rate"] == pytest.approx(100.0, abs=0.1)

    # Legacy: submissions exist but NO sessions tracked -> must NOT show 0%
    def test_legacy_submissions_no_sessions(self):
        db, _ = setup_db(
            forms=[make_form()],
            submissions=[make_submission(datetime.utcnow())] * 4,
            sessions=[],
            versions=[make_version()],
        )
        result = AnalyticsService.get_form_analytics(db, 1)
        assert result["completion_rate"] == pytest.approx(100.0, abs=0.1)

    def test_rate_with_sessions(self):
        # 152 completed / 178 started * 100 = 85.39 -> rounds to 85.4
        db, _ = setup_db(
            forms=[make_form()],
            submissions=[make_submission(datetime.utcnow())] * 152,
            sessions=[make_session()] * 178,
            versions=[make_version()],
        )
        result = AnalyticsService.get_form_analytics(db, 1)
        assert result["total_submissions"] == 152
        assert result["started_sessions"] == 178
        assert result["completed_submissions"] == 152
        assert result["completion_rate"] == pytest.approx(85.4, abs=0.1)

    def test_rate_partial_completion(self):
        db, _ = setup_db(
            forms=[make_form()],
            submissions=[make_submission(datetime.utcnow())] * 3,
            sessions=[make_session()] * 4,
            versions=[make_version()],
        )
        result = AnalyticsService.get_form_analytics(db, 1)
        assert result["completion_rate"] == pytest.approx(75.0, abs=0.1)


# ─── Average completion time ─────────────────────────────────────────

class TestAverageCompletionTime:
    def test_average_across_responses(self):
        base = datetime(2026, 7, 27, 10, 0, 0)
        submissions = [
            make_submission(base + timedelta(seconds=200), started_at=base),
            make_submission(base + timedelta(seconds=300), started_at=base),
        ]
        db, _ = setup_db(
            forms=[make_form()],
            submissions=submissions,
            sessions=[],
            versions=[make_version()],
        )
        result = AnalyticsService.get_form_analytics(db, 1)
        assert result["average_completion_time_seconds"] == 250
        assert result["average_completion_time"] == "4m 10s"

    def test_spec_case_2min_3min(self):
        # Start 10:00 -> submit 10:02 (2 min); start 10:05 -> submit 10:08 (3 min)
        # Average = 2m 30s
        submissions = [
            make_submission(
                datetime(2026, 7, 27, 10, 2, 0),
                started_at=datetime(2026, 7, 27, 10, 0, 0),
            ),
            make_submission(
                datetime(2026, 7, 27, 10, 8, 0),
                started_at=datetime(2026, 7, 27, 10, 5, 0),
            ),
        ]
        db, _ = setup_db(
            forms=[make_form()],
            submissions=submissions,
            sessions=[],
            versions=[make_version()],
        )
        result = AnalyticsService.get_form_analytics(db, 1)
        assert result["average_completion_time_seconds"] == 150
        assert result["average_completion_time"] == "2m 30s"

    def test_only_completed_counted(self):
        # An abandoned/incomplete submission with timestamps must be ignored.
        base = datetime(2026, 7, 27, 10, 0, 0)
        submissions = [
            make_submission(base + timedelta(seconds=120), started_at=base, status="completed"),
            make_submission(base + timedelta(seconds=480), started_at=base + timedelta(seconds=60), status="abandoned"),
        ]
        db, _ = setup_db(
            forms=[make_form()],
            submissions=submissions,
            sessions=[],
            versions=[make_version()],
        )
        result = AnalyticsService.get_form_analytics(db, 1)
        assert result["average_completion_time_seconds"] == 120
        assert result["average_completion_time"] == "2m"

    def test_invalid_timestamp_ignored(self):
        # started_at AFTER submitted_at is invalid -> skipped
        submissions = [
            make_submission(
                datetime(2026, 7, 27, 10, 2, 0),
                started_at=datetime(2026, 7, 27, 10, 5, 0),
            ),
            make_submission(
                datetime(2026, 7, 27, 11, 2, 0),
                started_at=datetime(2026, 7, 27, 11, 0, 0),
            ),
        ]
        db, _ = setup_db(
            forms=[make_form()],
            submissions=submissions,
            sessions=[],
            versions=[make_version()],
        )
        result = AnalyticsService.get_form_analytics(db, 1)
        # Only the valid 2-minute entry counts
        assert result["average_completion_time_seconds"] == 120
        assert result["average_completion_time"] == "2m"

    def test_no_started_at(self):
        submissions = [make_submission(datetime.utcnow(), started_at=None)]
        db, _ = setup_db(
            forms=[make_form()],
            submissions=submissions,
            sessions=[],
            versions=[make_version()],
        )
        result = AnalyticsService.get_form_analytics(db, 1)
        assert result["average_completion_time_seconds"] == 0
        assert result["average_completion_time"] == "0s"

    def test_latest_submission(self):
        base = datetime(2026, 7, 27, 10, 0, 0)
        submissions = [
            make_submission(base),
            make_submission(base + timedelta(minutes=5)),
        ]
        # first() returns the latest because the query orders by submitted_at desc
        db, queries = setup_db(
            forms=[make_form()],
            submissions=submissions,
            sessions=[],
            versions=[make_version()],
        )
        queries["submission"].first_value = submissions[1]
        result = AnalyticsService.get_form_analytics(db, 1)
        assert result["last_submission"].startswith("2026-07-27T10:05:00")


# ─── Cache + invalidation ───────────────────────────────────────────

class TestCacheInvalidation:
    def test_cache_serves_repeat_call(self):
        db, queries = setup_db(
            forms=[make_form()],
            submissions=[make_submission(datetime.utcnow())] * 5,
            sessions=[make_session()] * 6,
            versions=[make_version()],
        )
        AnalyticsService.invalidate(1)
        first = AnalyticsService.get_form_analytics(db, 1)
        # Second call should hit cache (same payload object)
        second = AnalyticsService.get_form_analytics(db, 1)
        assert first == second
        assert first["total_submissions"] == 5

    def test_invalidate_recomputes(self):
        db, queries = setup_db(
            forms=[make_form()],
            submissions=[make_submission(datetime.utcnow())] * 2,
            sessions=[make_session()] * 2,
            versions=[make_version()],
        )
        AnalyticsService.invalidate(1)
        AnalyticsService.get_form_analytics(db, 1)

        # New submission arrives → invalidate
        AnalyticsService.invalidate(1)
        queries["submission"].scalar_value = 3
        result = AnalyticsService.get_form_analytics(db, 1)
        assert result["total_submissions"] == 3

    def test_session_tracking_invalidates(self):
        db, queries = setup_db(
            forms=[make_form()],
            submissions=[],
            sessions=[],
            versions=[make_version()],
        )
        AnalyticsService.invalidate(1)
        AnalyticsService.get_form_analytics(db, 1)

        AnalyticsService.track_session(db, 1, "session-abc", started_at=datetime.utcnow())
        # After tracking, the session count query should reflect 1 session
        queries["session"].scalar_value = 1
        result = AnalyticsService.get_form_analytics(db, 1)
        assert result["started_sessions"] == 1


# ─── Session tracking ───────────────────────────────────────────────

class TestTrackSession:
    def _mock_db(self, form=None, existing_session=None):
        """Build a db mock that answers Form and FormSession queries separately."""
        from app.models import Form, FormSession

        db = MagicMock()
        form_q = MagicMock()
        form_q.filter.return_value.first.return_value = form
        session_q = MagicMock()
        session_q.filter.return_value.first.return_value = existing_session

        def _query(model):
            if model is Form:
                return form_q
            if model is FormSession:
                return session_q
            return form_q

        db.query.side_effect = _query
        return db

    def test_track_session_creates_row(self):
        db = self._mock_db(form=make_form(), existing_session=None)

        with patch("app.services.analytics_service.AnalyticsService.invalidate") as mock_inv:
            result = AnalyticsService.track_session(
                db, 1, "session-xyz", started_at=datetime(2026, 7, 27, 10, 5, 0),
                ip_address="127.0.0.1", user_agent="test-agent",
            )
            assert result["form_id"] == 1
            assert result["session_id"] == "session-xyz"
            assert result["started_at"] == "2026-07-27T10:05:00"
            mock_inv.assert_called_once_with(1)

    def test_track_session_missing_form_raises(self):
        db = self._mock_db(form=None)

        with pytest.raises(ValueError):
            AnalyticsService.track_session(db, 999, "session-xyz")


# ─── Cross-form summary ─────────────────────────────────────────────

class TestSummary:
    def test_summary_aggregates(self):
        db, queries = setup_db(
            forms=[make_form(1), make_form(2, "NPS Survey")],
            submissions=[make_submission(datetime.utcnow(), form_id=1)] * 10,
            sessions=[make_session(form_id=1)] * 12,
            versions=[make_version(1)],
        )
        # Per-form counts: form 1 has 10 subs / 12 sessions,
        # form 2 has 0 subs / 0 sessions.
        queries["submission"].scalar_by_form = {1: 10, 2: 0}
        queries["session"].scalar_by_form = {1: 12, 2: 0}
        result = AnalyticsService.get_summary(db)
        assert result["total_forms"] == 2
        assert result["total_submissions"] == 10
        assert result["total_started_sessions"] == 12
        assert result["completion_rate"] == pytest.approx(83.3, abs=0.1)

    def test_summary_legacy_caps_at_100(self):
        """Cross-form rate must also never exceed 100%."""
        db, queries = setup_db(
            forms=[make_form(1), make_form(2, "NPS Survey")],
            submissions=[make_submission(datetime.utcnow(), form_id=1)] * 5,
            sessions=[make_session(form_id=1)] * 2,
            versions=[make_version(1)],
        )
        queries["submission"].scalar_by_form = {1: 5, 2: 0}
        queries["session"].scalar_by_form = {1: 2, 2: 0}
        result = AnalyticsService.get_summary(db)
        assert result["total_submissions"] == 5
        assert result["total_started_sessions"] == 2
        assert result["completion_rate"] == pytest.approx(100.0, abs=0.1)


# ─── Submission timestamp normalization (root-cause regression) ───────

class TestSubmissionTimestampNormalization:
    def test_store_submission_writes_naive_utc(self):
        """
        Regression: submitted_at must be stored as NAIVE UTC.

        The DB session timezone is not UTC (e.g. Asia/Calcutta). Writing an
        AWARE datetime makes the driver shift it to session-local time in the
        naive column, which made submitted_at - started_at = +5h30m and
        produced bogus "5h 30m" average completion times.
        """
        from app.services.form_service import FormService
        from app.models import Submission, ResponseValue

        db = MagicMock()
        captured = {}

        def fake_add(obj):
            if isinstance(obj, Submission):
                captured["submission"] = obj

        db.add.side_effect = fake_add
        db.flush.return_value = None
        db.commit.return_value = None
        db.refresh.return_value = None

        # started_at arrives as an AWARE UTC datetime (as parsed from an ISO
        # string with a Z/offset in the submit endpoint).
        aware_start = datetime(2026, 8, 2, 10, 0, 0, tzinfo=timezone.utc)

        FormService.store_submission(
            db=db,
            form_id=1,
            form_version_id=2,
            link_token="abc",
            form_values={},
            field_states={},
            started_at=aware_start,
            session_id="s-1",
        )

        sub = captured["submission"]
        # started_at normalized to naive UTC
        assert sub.started_at.tzinfo is None
        assert sub.started_at == datetime(2026, 8, 2, 10, 0, 0)
        # submitted_at must ALSO be naive UTC (no tzinfo), matching the
        # stored column convention, otherwise the driver shifts it.
        assert sub.submitted_at.tzinfo is None

    def test_store_submission_keeps_naive_started_at(self):
        from app.services.form_service import FormService
        from app.models import Submission

        db = MagicMock()
        captured = {}
        db.add.side_effect = lambda obj: captured.update(submission=obj) if isinstance(obj, Submission) else None
        db.flush.return_value = None
        db.commit.return_value = None
        db.refresh.return_value = None

        naive_start = datetime(2026, 8, 2, 10, 0, 0)
        FormService.store_submission(
            db=db, form_id=1, form_version_id=2, link_token="abc",
            form_values={}, field_states={}, started_at=naive_start,
        )
        assert captured["submission"].started_at == naive_start
        assert captured["submission"].started_at.tzinfo is None


# ─── Session idempotency ────────────────────────────────────────────

class TestTrackSessionIdempotency:
    def test_duplicate_session_id_not_reinserted(self):
        """Tracking the same session_id twice must NOT double-count sessions."""
        db = MagicMock()
        # Form lookup returns a form
        form_q = MagicMock()
        form_q.filter.return_value.first.return_value = make_form()

        existing = MagicMock()
        existing.session_id = "session-dup"
        existing.started_at = datetime(2026, 7, 27, 10, 5, 0)
        dup_q = MagicMock()
        dup_q.filter.return_value.first.return_value = existing

        db.query.side_effect = lambda model: dup_q if model.__name__ == "FormSession" else form_q

        result = AnalyticsService.track_session(db, 1, "session-dup")
        assert result["session_id"] == "session-dup"
        # db.add must NOT be called (no new row inserted)
        db.add.assert_not_called()
