"""
Unit + API tests for per-field response distributions (Day 17).

Covers:
- Dropdown / radio single-select distributions (counts + percentages sum to ~100%)
- Checkbox multi-selection expansion (each selected option counted independently)
- Rating distributions across the configured scale (incl. zero-count levels) + average
- Option value -> label mapping from field config
- Unsupported field types excluded; empty fields -> empty distributions
- `field_distributions` included in the analytics payload by default
- `?include_distributions=false` strips them (backward compatible)
"""
import sys
import os
from datetime import datetime
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.services.analytics_service import AnalyticsService  # noqa: E402
from app.models import Field, Form, FormVersion, Submission, FormSession, ResponseValue  # noqa: E402


@pytest.fixture(autouse=True)
def _clear_cache():
    AnalyticsService.invalidate_all()
    yield
    AnalyticsService.invalidate_all()


# ─── Helpers ─────────────────────────────────────────────────────────

def make_field(fid, ftype, label, config=None, order=0, form_version_id=1):
    f = MagicMock()
    f.id = fid
    f.form_version_id = form_version_id
    f.field_type = ftype
    f.label = label
    f.configuration = config or {}
    f.order = order
    return f


def make_form(form_id=1, title="Survey"):
    form = MagicMock()
    form.id = form_id
    form.title = title
    form.updated_at = datetime.utcnow()
    return form


def make_version(form_id=1, status="published", version_number=2, vid=1):
    v = MagicMock()
    v.id = vid
    v.form_id = form_id
    v.status = status
    v.version_number = version_number
    return v


# ─── Dropdown / Radio (single select) ────────────────────────────────

class TestSingleSelect:
    def test_counts_and_percentages(self):
        field = make_field(5, "dropdown", "How did you hear about us?")
        raw = [("social", 52), ("friend", 48)]
        result = AnalyticsService._single_select_distribution(field, raw)
        assert result["field_id"] == 5
        assert result["type"] == "dropdown"
        assert result["total_responses"] == 100
        total_pct = round(sum(d["percentage"] for d in result["distribution"]), 1)
        assert total_pct == pytest.approx(100.0, abs=0.2)
        # Most popular first
        assert result["distribution"][0]["count"] == 52
        assert result["distribution"][1]["count"] == 48

    def test_value_to_label_mapping(self):
        field = make_field(
            6, "radio", "Country",
            config={"options": [
                {"label": "India", "value": "india", "order": 0},
                {"label": "USA", "value": "usa", "order": 1},
            ]},
        )
        raw = [("india", 3), ("usa", 1)]
        result = AnalyticsService._single_select_distribution(field, raw)
        labels = {d["value"] for d in result["distribution"]}
        assert labels == {"India", "USA"}  # labels, not stored values

    def test_unknown_value_falls_back_to_raw(self):
        field = make_field(7, "dropdown", "Q")
        result = AnalyticsService._single_select_distribution(field, [("legacy", 2)])
        assert result["distribution"][0]["value"] == "legacy"

    def test_empty_raw(self):
        field = make_field(8, "dropdown", "Q")
        result = AnalyticsService._single_select_distribution(field, [])
        assert result["total_responses"] == 0
        assert result["distribution"] == []


# ─── Checkbox (multi select) ─────────────────────────────────────────

class TestCheckbox:
    def test_each_selection_counted_independently(self):
        # Response 1: Analytics + Reports ; Response 2: Analytics only
        field = make_field(10, "checkbox", "Features")
        raw = [('["Analytics","Reports"]', 1), ('["Analytics"]', 1)]
        result = AnalyticsService._checkbox_distribution(field, raw)
        by_value = {d["value"]: d["count"] for d in result["distribution"]}
        assert by_value["Analytics"] == 2
        assert by_value["Reports"] == 1
        assert result["total_responses"] == 2
        # Percentage is relative to respondents (2 responses)
        analytics_pct = next(d for d in result["distribution"] if d["value"] == "Analytics")
        assert analytics_pct["percentage"] == pytest.approx(100.0, abs=0.1)
        reports_pct = next(d for d in result["distribution"] if d["value"] == "Reports")
        assert reports_pct["percentage"] == pytest.approx(50.0, abs=0.1)

    def test_non_json_value_treated_as_single(self):
        field = make_field(11, "checkbox", "Q")
        result = AnalyticsService._checkbox_distribution(field, [("plain", 3)])
        assert result["distribution"][0] == {"value": "plain", "count": 3, "percentage": 100.0}

    def test_label_mapping(self):
        field = make_field(
            12, "checkbox", "Events",
            config={"options": [
                {"label": "Tech", "value": "tech", "order": 0},
                {"label": "Sports", "value": "sports", "order": 1},
            ]},
        )
        result = AnalyticsService._checkbox_distribution(field, [('["tech"]', 2), ('["sports","tech"]', 1)])
        by_value = {d["value"]: d["count"] for d in result["distribution"]}
        assert by_value == {"Tech": 3, "Sports": 1}

    def test_empty_and_null_values_skipped(self):
        field = make_field(13, "checkbox", "Q")
        result = AnalyticsService._checkbox_distribution(field, [('[""]', 1), ('["a", ""]', 1)])
        assert result["total_responses"] == 2
        # Only the non-empty selection is counted
        assert result["distribution"] == [{"value": "a", "count": 1, "percentage": 50.0}]


# ─── Rating ──────────────────────────────────────────────────────────

class TestRating:
    def test_configured_scale_includes_zero_levels(self):
        # maximumStars=4 -> buckets 1..4, missing levels shown as 0
        field = make_field(20, "rating", "Rating",
                           config={"maximumStars": 4, "defaultRating": 3})
        raw = [("3", 2), ("4", 2)]
        result = AnalyticsService._rating_distribution(field, raw)
        assert result["type"] == "rating"
        assert result["total_responses"] == 4
        assert [d["value"] for d in result["distribution"]] == ["1", "2", "3", "4"]
        counts = {d["value"]: d["count"] for d in result["distribution"]}
        assert counts == {"1": 0, "2": 0, "3": 2, "4": 2}
        # Average = (3*2 + 4*2) / 4 = 3.5
        assert result["average"] == pytest.approx(3.5)

    def test_default_scale_1_to_5(self):
        field = make_field(21, "rating", "Rating", config={"defaultRating": 4})
        result = AnalyticsService._rating_distribution(field, [("5", 2)])
        assert len(result["distribution"]) == 5
        assert result["average"] == pytest.approx(5.0)

    def test_percentages_sum_100(self):
        field = make_field(22, "rating", "Rating")
        raw = [("1", 1), ("2", 2), ("3", 3), ("4", 4), ("5", 5)]
        result = AnalyticsService._rating_distribution(field, raw)
        total_pct = round(sum(d["percentage"] for d in result["distribution"]), 1)
        assert total_pct == pytest.approx(100.0, abs=0.2)

    def test_empty_rating(self):
        field = make_field(23, "rating", "Rating")
        result = AnalyticsService._rating_distribution(field, [])
        assert result["total_responses"] == 0
        assert result["average"] is None
        assert all(d["count"] == 0 for d in result["distribution"])

    def test_non_numeric_values_ignored(self):
        field = make_field(24, "rating", "Rating")
        result = AnalyticsService._rating_distribution(field, [("N/A", 5)])
        assert result["total_responses"] == 0
        assert result["average"] is None


# ─── get_field_distributions (service integration) ───────────────────

class TestGetFieldDistributions:
    def _setup_db(self, version, fields, rows):
        """Stub db answering version/field/response_value queries + analytics base queries."""
        class StubQuery:
            def __init__(self):
                self.first_value = None
                self.all_value = []
                self.scalar_value = 0
                self.filters = []

            def filter(self, *a, **k):
                self.filters.append((a, k))
                return self

            def order_by(self, *a, **k):
                return self

            def group_by(self, *a, **k):
                return self

            def scalar(self):
                return self.scalar_value

            def _matches(self, row):
                """Emulate equality and `in_(...)` filter clauses on mock rows."""
                if isinstance(row, (tuple, list)):
                    # response_value rows are (field_id, value, count) tuples and are
                    # already constrained to supported fields by the test data.
                    return True
                for a, k in self.filters:
                    for arg in a:
                        try:
                            left_name = getattr(arg.left, "name", None)
                        except Exception:
                            continue
                        if left_name is None:
                            continue
                        right = getattr(arg, "right", None)
                        right_value = getattr(right, "value", right) if right is not None else None
                        row_value = getattr(row, left_name, None)
                        if isinstance(right_value, list):
                            # `col.in_(...)` — right is a BindParameter wrapping a list
                            if row_value not in right_value:
                                return False
                        elif right is None and right_value is None:
                            # `col.isnot(None)`
                            if row_value is None:
                                return False
                        elif right_value is not None and row_value != right_value:
                            return False
                return True

            def all(self):
                if not self.filters:
                    return self.all_value
                return [r for r in self.all_value if self._matches(r)]

            def first(self):
                return self.first_value

        queries = {
            "form": StubQuery(), "version": StubQuery(), "submission": StubQuery(),
            "session": StubQuery(), "field": StubQuery(), "response_value": StubQuery(),
            "other": StubQuery(),
        }
        queries["form"].first_value = make_form()
        queries["version"].first_value = version
        queries["field"].all_value = fields
        queries["response_value"].all_value = rows

        def _resolve(model):
            if model is Form:
                return "form"
            if model is FormVersion:
                return "version"
            if model is Submission:
                return "submission"
            if model is FormSession:
                return "session"
            if model is Field:
                return "field"
            if model is ResponseValue:
                return "response_value"
            # func.count(...) on submissions (e.g. func.count(Submission.id))
            if getattr(model, "name", None) == "count":
                return "submission"
            try:
                table = getattr(model, "table", None)
                if table is not None:
                    return {
                        "response_values": "response_value",
                        "fields": "field",
                        "submissions": "submission",
                        "forms": "form",
                        "form_versions": "version",
                        "form_sessions": "session",
                    }.get(table.name, "other")
            except Exception:
                pass
            return "other"

        db = MagicMock()
        db.query.side_effect = lambda *args: queries[_resolve(args[0])]
        return db, queries

    def test_only_supported_types_returned(self):
        fields = [
            make_field(1, "text", "Name"),
            make_field(2, "dropdown", "Source"),
            make_field(3, "email", "Email"),
            make_field(4, "checkbox", "Events"),
            make_field(5, "rating", "Rating"),
            make_field(6, "file", "Resume"),
        ]
        version = make_version()
        rows = [  # (field_id, value, count)
            (2, "social", 3), (2, "friend", 1),
            (4, '["tech"]', 2),
            (5, "4", 3),
        ]
        db, _ = self._setup_db(version, fields, rows)
        result = AnalyticsService.get_field_distributions(db, 1)
        types = {d["type"] for d in result}
        assert types == {"dropdown", "checkbox", "rating"}
        assert len(result) == 3  # text/email/file excluded

    def test_empty_version_returns_empty(self):
        db, queries = self._setup_db(None, [], [])
        queries["version"].first_value = None
        assert AnalyticsService.get_field_distributions(db, 1) == []

    def test_no_supported_fields_returns_empty(self):
        db, _ = self._setup_db(make_version(), [make_field(1, "text", "Name")], [])
        assert AnalyticsService.get_field_distributions(db, 1) == []

    def test_payload_includes_distributions(self):
        fields = [make_field(2, "dropdown", "Source")]
        version = make_version()
        rows = [(2, "social", 2), (2, "friend", 2)]
        db, queries = self._setup_db(version, fields, rows)
        queries["submission"].scalar_value = 4
        result = AnalyticsService.get_form_analytics(db, 1)
        assert "field_distributions" in result
        assert len(result["field_distributions"]) == 1
        fd = result["field_distributions"][0]
        assert fd["label"] == "Source"
        assert fd["total_responses"] == 4


# ─── Submissions over time (trend) ───────────────────────────────────

class TestSubmissionsOverTime:
    def _db(self, rows):
        """Stub db that answers the trend query with the given (day, count) rows."""
        class StubQuery:
            def __init__(self):
                self.all_value = rows

            def filter(self, *a, **k):
                return self

            def group_by(self, *a, **k):
                return self

            def order_by(self, *a, **k):
                return self

            def all(self):
                return self.all_value

        db = MagicMock()
        db.query.side_effect = lambda *a, **k: StubQuery()
        return db

    def test_zero_filled_between_first_and_last(self):
        from datetime import date
        db = self._db([(date(2026, 7, 1), 2), (date(2026, 7, 3), 1)])
        points = AnalyticsService.get_submissions_over_time(db, 1)
        assert points == [
            {"date": "2026-07-01", "count": 2},
            {"date": "2026-07-02", "count": 0},  # gap zero-filled
            {"date": "2026-07-03", "count": 1},
        ]

    def test_single_submission_day(self):
        from datetime import date
        db = self._db([(date(2026, 7, 10), 4)])
        assert AnalyticsService.get_submissions_over_time(db, 1) == [
            {"date": "2026-07-10", "count": 4}
        ]

    def test_no_submissions_returns_empty(self):
        db = self._db([])
        assert AnalyticsService.get_submissions_over_time(db, 1) == []

    def test_total_counts_preserved(self):
        from datetime import date
        db = self._db([(date(2026, 7, 1), 3), (date(2026, 7, 2), 5), (date(2026, 7, 3), 2)])
        points = AnalyticsService.get_submissions_over_time(db, 1)
        assert sum(p["count"] for p in points) == 10
        assert len(points) == 3

    def test_payload_includes_submissions_over_time(self):
        from datetime import date
        db, queries = TestGetFieldDistributions()._setup_db(
            make_version(), [make_field(2, "dropdown", "Source")], []
        )
        queries["submission"].scalar_value = 3
        # Trend query resolves to the "other" stub — return one day, 3 submissions
        queries["other"].all_value = [(date(2026, 7, 1), 3)]
        result = AnalyticsService.get_form_analytics(db, 1)
        assert result["submissions_over_time"] == [{"date": "2026-07-01", "count": 3}]


# ─── Router: include_distributions param ─────────────────────────────

class TestRouter:
    def _client(self):
        """TestClient with mocked db + an authenticated user (owner of form 1)."""
        from fastapi.testclient import TestClient
        from app.main import app
        from app.database import get_db

        db, queries = self._make_db()
        app.dependency_overrides[get_db] = lambda: db

        user = MagicMock()
        user.id = 1
        import app.routers.analytics as analytics_mod
        app.dependency_overrides[analytics_mod.get_current_user] = lambda: user
        return TestClient(app), db

    def _client_unauthenticated(self):
        """TestClient WITHOUT the get_current_user override → real JWT path (401)."""
        from fastapi.testclient import TestClient
        from app.main import app
        from app.database import get_db

        db, queries = self._make_db()
        app.dependency_overrides[get_db] = lambda: db
        return TestClient(app), db

    def _make_db(self):
        from app.database import get_db  # noqa: F401
        fields = [make_field(2, "dropdown", "Source", order=0)]
        version = make_version()
        rows = [(2, "social", 2), (2, "friend", 2)]

        class StubQuery:
            def __init__(self):
                self.first_value = None
                self.all_value = []
                self.scalar_value = 0
                self.filters = []

            def filter(self, *a, **k):
                self.filters.append((a, k))
                return self

            def order_by(self, *a, **k):
                return self

            def group_by(self, *a, **k):
                return self

            def scalar(self):
                return self.scalar_value

            def _matches(self, row):
                if isinstance(row, (tuple, list)):
                    return True
                for a, k in self.filters:
                    for arg in a:
                        try:
                            left_name = getattr(arg.left, "name", None)
                        except Exception:
                            continue
                        if left_name is None:
                            continue
                        right = getattr(arg, "right", None)
                        right_value = getattr(right, "value", right) if right is not None else None
                        row_value = getattr(row, left_name, None)
                        if isinstance(right_value, list):
                            if row_value not in right_value:
                                return False
                        elif right is None and right_value is None:
                            if row_value is None:
                                return False
                        elif right_value is not None and row_value != right_value:
                            return False
                return True

            def all(self):
                if not self.filters:
                    return self.all_value
                return [r for r in self.all_value if self._matches(r)]

            def first(self):
                return self.first_value

        queries = {m: StubQuery() for m in ["form", "version", "submission", "session", "field", "response_value", "other"]}
        # Legacy form (NULL owner) → viewable by any authenticated user,
        # matching the response-browser / export ownership policy.
        form = make_form()
        form.user_id = None
        queries["form"].first_value = form
        queries["version"].first_value = version
        queries["field"].all_value = fields
        queries["response_value"].all_value = rows
        queries["submission"].scalar_value = 4
        queries["session"].scalar_value = 0

        def _resolve(model):
            # NOTE: use `is` identity checks, never `in (Model, ...)` — SQLAlchemy
            # expressions override __eq__, so `count(...) in (Form, ...)` would build
            # a comparison and coerce the raw model class as a literal value.
            if model is Form:
                return "form"
            if model is FormVersion:
                return "version"
            if model is Submission:
                return "submission"
            if model is FormSession:
                return "session"
            if model is Field:
                return "field"
            if model is ResponseValue:
                return "response_value"
            # func.count(...) on submissions
            if getattr(model, "name", None) == "count":
                return "submission"
            try:
                table = getattr(model, "table", None)
                if table is not None:
                    return {"response_values": "response_value", "fields": "field",
                            "submissions": "submission", "forms": "form",
                            "form_versions": "version", "form_sessions": "session"}.get(table.name, "other")
            except Exception:
                pass
            return "other"

        db = MagicMock()
        db.query.side_effect = lambda *args: queries[_resolve(args[0])]
        return db, queries

    def test_unauthenticated_returns_401(self):
        """Analytics endpoints now require a valid JWT (no public analytics)."""
        client, db = self._client_unauthenticated()
        try:
            resp = client.get("/api/forms/1/analytics")
            assert resp.status_code == 401
            resp2 = client.get("/api/analytics/summary")
            assert resp2.status_code == 401
        finally:
            client.app.dependency_overrides.clear()

    def test_non_owner_gets_403(self):
        from fastapi.testclient import TestClient
        from app.main import app
        from app.database import get_db

        db, queries = self._make_db()
        # Owned by user 2 → user 1 must be denied
        queries["form"].first_value.user_id = 2
        app.dependency_overrides[get_db] = lambda: db
        user = MagicMock()
        user.id = 1
        import app.routers.analytics as analytics_mod
        app.dependency_overrides[analytics_mod.get_current_user] = lambda: user
        client = TestClient(app)
        try:
            resp = client.get("/api/forms/1/analytics")
            assert resp.status_code == 403
        finally:
            client.app.dependency_overrides.clear()

    def test_legacy_form_any_auth_user(self):
        """Legacy NULL-owner forms remain readable by any authenticated user."""
        from fastapi.testclient import TestClient
        from app.main import app
        from app.database import get_db

        db, queries = self._make_db()
        queries["form"].first_value.user_id = None
        app.dependency_overrides[get_db] = lambda: db
        user = MagicMock()
        user.id = 99
        import app.routers.analytics as analytics_mod
        app.dependency_overrides[analytics_mod.get_current_user] = lambda: user
        client = TestClient(app)
        try:
            resp = client.get("/api/forms/1/analytics")
            assert resp.status_code == 200
        finally:
            client.app.dependency_overrides.clear()

    def test_default_includes_distributions(self):
        from app.database import get_db
        client, db = self._client()
        try:
            resp = client.get("/api/forms/1/analytics")
            assert resp.status_code == 200
            body = resp.json()
            assert "field_distributions" in body
            assert len(body["field_distributions"]) == 1
            assert body["field_distributions"][0]["total_responses"] == 4
        finally:
            client.app.dependency_overrides.clear()

    def test_include_distributions_false_strips_field(self):
        from app.database import get_db
        client, db = self._client()
        try:
            resp = client.get("/api/forms/1/analytics?include_distributions=false")
            assert resp.status_code == 200
            body = resp.json()
            # Field omitted from the payload -> serialized as an empty list
            assert body["field_distributions"] == []
            # Summary fields still present (backward compatible)
            assert body["form_id"] == 1
            assert body["total_submissions"] == 4
        finally:
            client.app.dependency_overrides.clear()

    def test_strip_does_not_poison_cache(self):
        """Regression: stripping distributions must not mutate the shared cached payload."""
        from app.database import get_db
        client, db = self._client()
        try:
            r1 = client.get("/api/forms/1/analytics?include_distributions=false")
            assert r1.status_code == 200
            assert r1.json()["field_distributions"] == []

            # A subsequent default request within the cache TTL must still
            # return the populated distributions (the cache was not mutated).
            r2 = client.get("/api/forms/1/analytics")
            assert r2.status_code == 200
            fds = r2.json()["field_distributions"]
            assert len(fds) == 1
            assert fds[0]["total_responses"] == 4
        finally:
            client.app.dependency_overrides.clear()
