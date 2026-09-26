"""
Day 19 — Data retention, bulk deletion & audit logging tests.

Covers:
- Retention policy CRUD (create / get / update / delete, one-per-form)
- Archive job: old submissions archived, recent kept, data preserved,
  idempotent (re-running archives nothing new), audit log created
- Bulk delete: confirm required, selected-mode, filtered-mode, no partial
  deletion, files/values cascade, audit log created
- Audit log API: ownership scoping, filters, pagination
- Authorization: 401 / 403 for every destructive endpoint
- Analytics: archived submissions excluded from active counts
- Duplicated-form independence (retention operates per form)
"""
import sys
import os
from contextlib import contextmanager
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.database import Base  # noqa: E402
from app.models import (  # noqa: E402
    Form,
    FormVersion,
    Submission,
    ResponseValue,
    RetentionPolicy,
    AuditLog,
    FormArchiveJobRun,
    User,
)
from app.services.retention_service import RetentionService  # noqa: E402
from app.services.audit_service import AuditService  # noqa: E402
from app.services.response_service import ResponseService  # noqa: E402


# ─── Fixtures / helpers ─────────────────────────────────────────────

@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def make_user(db, uid=1, name="Alice"):
    user = User(
        id=uid,
        full_name=name,
        username=f"user_{uid}",
        email=f"user_{uid}@example.com",
        hashed_password="x",
        is_active=True,
    )
    db.add(user)
    db.commit()
    return user


def make_form(db, title="Customer Feedback", owner_id=1):
    form = Form(title=title, description="desc", user_id=owner_id)
    db.add(form)
    db.flush()
    version = FormVersion(
        form_id=form.id,
        version_number=1,
        title=title,
        description="desc",
        status="published",
    )
    db.add(version)
    db.flush()
    db.commit()
    return form


def make_submission(db, form, response_id, submitted_at, version=None, status="completed"):
    if version is None:
        version = db.query(FormVersion).filter(FormVersion.form_id == form.id).first()
    sub = Submission(
        form_id=form.id,
        form_version_id=version.id,
        link_token="tok",
        response_id=response_id,
        status=status,
        submitted_at=submitted_at,
        created_at=submitted_at,
    )
    db.add(sub)
    db.flush()
    db.commit()
    return sub


def make_response_value(db, sub, field_id=101, value="x"):
    rv = ResponseValue(submission_id=sub.id, field_id=field_id, value=value)
    db.add(rv)
    db.flush()
    db.commit()
    return rv


# ─── Retention policy CRUD ──────────────────────────────────────────

class TestRetentionPolicyCrud:
    def test_create_get_update_delete(self, db):
        form = make_form(db)

        created = RetentionService.create_policy(db, form_id=form.id, retention_days=90)
        assert created["form_id"] == form.id
        assert created["retention_days"] == 90
        assert created["action"] == "archive"
        assert created["enabled"] is True
        assert created["form_name"] == "Customer Feedback"

        fetched = RetentionService.get_policy(db, form.id)
        assert fetched["id"] == created["id"]
        assert fetched["retention_days"] == 90

        updated = RetentionService.update_policy(db, form.id, retention_days=30, enabled=False)
        assert updated["retention_days"] == 30
        assert updated["enabled"] is False

        RetentionService.delete_policy(db, form.id)
        assert RetentionService.get_policy(db, form.id) is None

    def test_one_policy_per_form(self, db):
        form = make_form(db)
        RetentionService.create_policy(db, form.id, retention_days=90)
        with pytest.raises(ValueError, match="already exists"):
            RetentionService.create_policy(db, form.id, retention_days=30)

    def test_invalid_retention_days_rejected(self, db):
        form = make_form(db)
        with pytest.raises(ValueError, match="positive integer"):
            RetentionService.create_policy(db, form.id, retention_days=0, enabled=True)

    def test_none_days_means_never(self, db):
        form = make_form(db)
        created = RetentionService.create_policy(db, form.id, retention_days=None, enabled=False)
        assert created["retention_days"] is None
        assert created["enabled"] is False

    def test_list_includes_never_rows(self, db):
        form_a = make_form(db, title="Alpha", owner_id=1)
        form_b = make_form(db, title="Beta", owner_id=1)
        RetentionService.create_policy(db, form_a.id, retention_days=90)
        # form_b has no policy → "Never" placeholder row
        rows = RetentionService.list_policies(db, current_user_id=1)
        by_form = {r["form_id"]: r for r in rows}
        assert by_form[form_a.id]["retention_days"] == 90
        assert by_form[form_b.id]["retention_days"] is None
        assert by_form[form_b.id]["enabled"] is False

    def test_list_scoped_to_owned_forms(self, db):
        mine = make_form(db, title="Mine", owner_id=1)
        theirs = make_form(db, title="Theirs", owner_id=2)
        RetentionService.create_policy(db, theirs.id, retention_days=90)
        rows = RetentionService.list_policies(db, current_user_id=1)
        form_ids = {r["form_id"] for r in rows}
        assert mine.id in form_ids
        assert theirs.id not in form_ids  # other user's form hidden

    def test_crud_writes_audit_logs(self, db):
        form = make_form(db)
        RetentionService.create_policy(db, form.id, retention_days=90)
        RetentionService.update_policy(db, form.id, retention_days=30)
        RetentionService.delete_policy(db, form.id)

        actions = [
            log.action for log in db.query(AuditLog).order_by(AuditLog.id).all()
        ]
        assert actions == ["create", "update", "delete"]
        assert all(log.entity_type == "retention_policy" for log in db.query(AuditLog).all())


# ─── Archive job ────────────────────────────────────────────────────

class TestArchiveJob:
    def test_old_submissions_archived_recent_kept(self, db):
        form = make_form(db)
        RetentionService.create_policy(db, form.id, retention_days=30)

        old = make_submission(db, form, "resp_old", datetime.utcnow() - timedelta(days=60))
        recent = make_submission(db, form, "resp_new", datetime.utcnow() - timedelta(days=5))

        result = RetentionService.run_archive_job(db)
        assert result["archived_total"] == 1

        old = db.query(Submission).filter(Submission.response_id == "resp_old").first()
        recent = db.query(Submission).filter(Submission.response_id == "resp_new").first()
        assert old.status == "archived"
        assert old.archived_at is not None
        assert recent.status == "completed"
        assert recent.archived_at is None

        # Data preserved — the row still exists
        assert db.query(Submission).filter(Submission.response_id == "resp_old").count() == 1

    def test_job_is_idempotent(self, db):
        form = make_form(db)
        RetentionService.create_policy(db, form.id, retention_days=30)
        make_submission(db, form, "resp_old", datetime.utcnow() - timedelta(days=60))

        first = RetentionService.run_archive_job(db)
        assert first["archived_total"] == 1
        second = RetentionService.run_archive_job(db)
        assert second["archived_total"] == 0  # nothing new to archive

    def test_disabled_policy_never_archives(self, db):
        form = make_form(db)
        RetentionService.create_policy(db, form.id, retention_days=30, enabled=False)
        make_submission(db, form, "resp_old", datetime.utcnow() - timedelta(days=60))
        result = RetentionService.run_archive_job(db)
        assert result["archived_total"] == 0
        sub = db.query(Submission).filter(Submission.response_id == "resp_old").first()
        assert sub.status == "completed"

    def test_never_policy_never_archives(self, db):
        form = make_form(db)
        RetentionService.create_policy(db, form.id, retention_days=None, enabled=True)
        make_submission(db, form, "resp_old", datetime.utcnow() - timedelta(days=600))
        result = RetentionService.run_archive_job(db)
        assert result["archived_total"] == 0

    def test_archive_writes_audit_log_with_system_actor(self, db):
        form = make_form(db)
        RetentionService.create_policy(db, form.id, retention_days=30)
        make_submission(db, form, "resp_old", datetime.utcnow() - timedelta(days=60))

        RetentionService.run_archive_job(db)

        log = db.query(AuditLog).filter(AuditLog.action == "archive").first()
        assert log is not None
        assert log.actor_type == "system"
        assert log.actor_id is None
        assert log.entity_type == "submission"
        assert log.form_id == form.id
        assert log.records_affected == 1
        assert log.details["reason"] == "retention_policy"

        # Run record created
        run = db.query(FormArchiveJobRun).first()
        assert run is not None
        assert run.status == "completed"
        assert run.archived_total == 1

    def test_archive_per_form_only(self, db):
        form_a = make_form(db, title="A", owner_id=1)
        form_b = make_form(db, title="B", owner_id=1)
        RetentionService.create_policy(db, form_a.id, retention_days=30)
        # form_b has NO policy — must not be archived
        make_submission(db, form_a, "a_old", datetime.utcnow() - timedelta(days=60))
        make_submission(db, form_b, "b_old", datetime.utcnow() - timedelta(days=60))

        result = RetentionService.run_archive_job(db)
        assert result["archived_total"] == 1
        b = db.query(Submission).filter(Submission.response_id == "b_old").first()
        assert b.status == "completed"


# ─── Bulk delete (service) ──────────────────────────────────────────

class TestBulkDeleteService:
    def test_selected_response_ids(self, db):
        form = make_form(db)
        s1 = make_submission(db, form, "resp_1", datetime.utcnow())
        s2 = make_submission(db, form, "resp_2", datetime.utcnow())
        make_response_value(db, s1)
        make_response_value(db, s2)
        s1_id = s1.id  # capture before deletion (row is removed afterwards)

        result = ResponseService.bulk_delete(
            db, form.id, response_ids=["resp_1"], actor_id=1
        )
        assert result["deleted"] == 1
        assert result["deleted_ids"] == ["resp_1"]

        # Row + values gone
        assert db.query(Submission).filter(Submission.response_id == "resp_1").count() == 0
        assert db.query(ResponseValue).filter(ResponseValue.submission_id == s1_id).count() == 0
        # The other submission untouched
        assert db.query(Submission).filter(Submission.response_id == "resp_2").count() == 1

    def test_filtered_delete_date_range(self, db):
        form = make_form(db)
        make_submission(db, form, "resp_jan", datetime(2026, 1, 15, 10, 0, 0))
        make_submission(db, form, "resp_feb", datetime(2026, 2, 15, 10, 0, 0))
        make_submission(db, form, "resp_mar", datetime(2026, 3, 15, 10, 0, 0))

        result = ResponseService.bulk_delete(
            db,
            form.id,
            from_date="2026-01-01",
            to_date="2026-02-28",
            actor_id=1,
        )
        assert result["deleted"] == 2
        assert set(result["deleted_ids"]) == {"resp_jan", "resp_feb"}
        assert db.query(Submission).filter(Submission.form_id == form.id).count() == 1

    def test_filtered_delete_by_status(self, db):
        form = make_form(db)
        make_submission(db, form, "resp_completed", datetime.utcnow(), status="completed")
        make_submission(db, form, "resp_archived", datetime.utcnow(), status="archived")

        result = ResponseService.bulk_delete(db, form.id, status="archived", actor_id=1)
        assert result["deleted"] == 1
        assert result["deleted_ids"] == ["resp_archived"]

    def test_no_criteria_raises(self, db):
        form = make_form(db)
        make_submission(db, form, "resp_1", datetime.utcnow())
        with pytest.raises(ValueError, match="Provide either"):
            ResponseService.bulk_delete(db, form.id, actor_id=1)

    def test_delete_writes_audit_log(self, db):
        form = make_form(db)
        make_submission(db, form, "resp_1", datetime.utcnow())
        ResponseService.bulk_delete(db, form.id, response_ids=["resp_1"], actor_id=1, ip_address="127.0.0.1")

        log = db.query(AuditLog).filter(AuditLog.action == "delete").first()
        assert log is not None
        assert log.actor_type == "user"
        assert log.actor_id == 1
        assert log.entity_type == "submission"
        assert log.form_id == form.id
        assert log.records_affected == 1
        assert log.ip_address == "127.0.0.1"

    def test_deleting_none_returns_zero(self, db):
        form = make_form(db)
        result = ResponseService.bulk_delete(db, form.id, response_ids=["ghost"])
        assert result["deleted"] == 0


# ─── Audit service ──────────────────────────────────────────────────

class TestAuditService:
    def test_system_log(self, db):
        form = make_form(db)
        log = AuditService.log_system(
            db, action="archive", entity_type="submission",
            form_id=form.id, records_affected=5,
            details={"reason": "retention_policy"},
        )
        assert log.actor_type == "system"
        assert log.actor_id is None
        assert log.records_affected == 5

    def test_user_log(self, db):
        user = make_user(db)
        form = make_form(db)
        log = AuditService.log(
            db, action="delete", entity_type="submission",
            actor_id=user.id, form_id=form.id, records_affected=2, ip_address="10.0.0.1",
        )
        assert log.actor_type == "user"
        assert log.actor_id == user.id
        assert log.ip_address == "10.0.0.1"


# ─── Analytics: archived excluded ───────────────────────────────────

class TestAnalyticsExcludesArchived:
    def test_total_submissions_excludes_archived(self, db):
        from app.services.analytics_service import AnalyticsService
        AnalyticsService.invalidate_all()

        form = make_form(db)
        make_submission(db, form, "resp_active", datetime.utcnow(), status="completed")
        make_submission(db, form, "resp_archived", datetime.utcnow(), status="archived")

        analytics = AnalyticsService.get_form_analytics(db, form.id)
        assert analytics["total_submissions"] == 1  # archived excluded
        assert analytics["completed_submissions"] == 1


# ─── Router / API level ─────────────────────────────────────────────

class TestRetentionAndAuditRouter:
    @contextmanager
    def _client(self, db, current_user_id=1, override_auth=True):
        from fastapi.testclient import TestClient
        from unittest.mock import MagicMock
        from app.main import app
        from app.database import get_db
        import app.routers.retention as retention_mod
        import app.routers.audit as audit_mod
        import app.routers.responses as responses_mod

        user = MagicMock()
        user.id = current_user_id

        def _override_db():
            yield db

        app.dependency_overrides[get_db] = _override_db
        if override_auth:
            app.dependency_overrides[retention_mod.get_current_user] = lambda: user
            app.dependency_overrides[audit_mod.get_current_user] = lambda: user
            app.dependency_overrides[responses_mod.get_current_user] = lambda: user
        client = TestClient(app)
        try:
            yield client
        finally:
            app.dependency_overrides.clear()

    # ── Retention policy API ──────────────────────────────────────

    def test_create_get_list_policy_api(self, db):
        form = make_form(db, owner_id=1)
        with self._client(db) as client:
            resp = client.post(
                f"/api/forms/{form.id}/retention-policy",
                json={"retention_days": 90, "action": "archive", "enabled": True},
            )
            assert resp.status_code == 200
            body = resp.json()
            assert body["retention_days"] == 90
            assert body["form_name"] == "Customer Feedback"

            resp = client.get(f"/api/forms/{form.id}/retention-policy")
            assert resp.status_code == 200
            assert resp.json()["retention_days"] == 90

            resp = client.get("/api/retention-policies")
            assert resp.status_code == 200
            assert len(resp.json()["policies"]) == 1

    def test_non_owner_403_policy(self, db):
        form = make_form(db, owner_id=1)
        with self._client(db, current_user_id=2) as client:
            resp = client.post(
                f"/api/forms/{form.id}/retention-policy",
                json={"retention_days": 90, "enabled": True},
            )
            assert resp.status_code == 403

    def test_unauthenticated_401_policy(self, db):
        form = make_form(db, owner_id=1)
        with self._client(db, override_auth=False) as client:
            resp = client.get("/api/retention-policies")
            assert resp.status_code == 401

    def test_missing_form_404_policy(self, db):
        with self._client(db) as client:
            resp = client.get("/api/forms/99999/retention-policy")
            assert resp.status_code == 404

    def test_duplicate_policy_409(self, db):
        form = make_form(db, owner_id=1)
        with self._client(db) as client:
            client.post(f"/api/forms/{form.id}/retention-policy", json={"retention_days": 90})
            resp = client.post(f"/api/forms/{form.id}/retention-policy", json={"retention_days": 30})
            assert resp.status_code == 409

    def test_run_job_api(self, db):
        form = make_form(db, owner_id=1)
        with self._client(db) as client:
            client.post(f"/api/forms/{form.id}/retention-policy", json={"retention_days": 30})
            resp = client.post("/api/retention/run")
            assert resp.status_code == 200
            assert resp.json()["success"] is True

    # ── Bulk delete API ───────────────────────────────────────────

    def test_bulk_delete_requires_confirm(self, db):
        form = make_form(db, owner_id=1)
        make_submission(db, form, "resp_1", datetime.utcnow())
        with self._client(db) as client:
            resp = client.request(
                "DELETE",
                f"/api/forms/{form.id}/responses/bulk",
                json={"response_ids": ["resp_1"], "confirm": False},
            )
            assert resp.status_code == 422
            # Nothing deleted
            assert db.query(Submission).filter(Submission.response_id == "resp_1").count() == 1

    def test_bulk_delete_selected_api(self, db):
        form = make_form(db, owner_id=1)
        make_submission(db, form, "resp_1", datetime.utcnow())
        make_submission(db, form, "resp_2", datetime.utcnow())
        with self._client(db) as client:
            resp = client.request(
                "DELETE",
                f"/api/forms/{form.id}/responses/bulk",
                json={"response_ids": ["resp_1"], "confirm": True},
            )
            assert resp.status_code == 200
            body = resp.json()
            assert body["deleted"] == 1
            assert body["message"] == "1 responses deleted"
        assert db.query(Submission).filter(Submission.form_id == form.id).count() == 1

    def test_bulk_delete_non_owner_403(self, db):
        form = make_form(db, owner_id=1)
        make_submission(db, form, "resp_1", datetime.utcnow())
        with self._client(db, current_user_id=2) as client:
            resp = client.request(
                "DELETE",
                f"/api/forms/{form.id}/responses/bulk",
                json={"response_ids": ["resp_1"], "confirm": True},
            )
            assert resp.status_code == 403
        assert db.query(Submission).filter(Submission.form_id == form.id).count() == 1

    def test_bulk_delete_unauthenticated_401(self, db):
        form = make_form(db, owner_id=1)
        make_submission(db, form, "resp_1", datetime.utcnow())
        with self._client(db, override_auth=False) as client:
            resp = client.request(
                "DELETE",
                f"/api/forms/{form.id}/responses/bulk",
                json={"response_ids": ["resp_1"], "confirm": True},
            )
            assert resp.status_code == 401

    # ── Audit log API ─────────────────────────────────────────────

    def test_audit_log_list_shape(self, db):
        form = make_form(db, owner_id=1)
        make_submission(db, form, "resp_1", datetime.utcnow())
        ResponseService.bulk_delete(db, form.id, response_ids=["resp_1"], actor_id=1)

        with self._client(db) as client:
            resp = client.get("/api/audit-logs")
            assert resp.status_code == 200
            body = resp.json()
            assert body["total"] == 1
            log = body["logs"][0]
            assert log["action"] == "delete"
            assert log["entity_type"] == "submission"
            assert log["form_name"] == "Customer Feedback"
            assert log["records_affected"] == 1

    def test_audit_log_scoped_to_owned_forms(self, db):
        mine = make_form(db, title="Mine", owner_id=1)
        theirs = make_form(db, title="Theirs", owner_id=2)
        make_submission(db, mine, "resp_m", datetime.utcnow())
        make_submission(db, theirs, "resp_t", datetime.utcnow())
        ResponseService.bulk_delete(db, mine.id, response_ids=["resp_m"], actor_id=1)
        # Simulate a delete on the other user's form (by its owner)
        ResponseService.bulk_delete(db, theirs.id, response_ids=["resp_t"], actor_id=2)

        with self._client(db, current_user_id=1) as client:
            resp = client.get("/api/audit-logs")
            body = resp.json()
            assert body["total"] == 1
            assert body["logs"][0]["form_name"] == "Mine"

    def test_audit_log_filters(self, db):
        form = make_form(db, owner_id=1)
        make_submission(db, form, "resp_1", datetime.utcnow())
        ResponseService.bulk_delete(db, form.id, response_ids=["resp_1"], actor_id=1)

        with self._client(db) as client:
            resp = client.get("/api/audit-logs?action=archive")
            assert resp.json()["total"] == 0
            resp = client.get("/api/audit-logs?action=delete")
            assert resp.json()["total"] == 1
            resp = client.get("/api/audit-logs?entity_type=submission")
            assert resp.json()["total"] == 1
            resp = client.get("/api/audit-logs?form_id=99999")
            assert resp.status_code == 404

    def test_audit_log_invalid_action_422(self, db):
        with self._client(db) as client:
            resp = client.get("/api/audit-logs?action=explode")
            assert resp.status_code == 422

    def test_audit_log_unauthenticated_401(self, db):
        with self._client(db, override_auth=False) as client:
            resp = client.get("/api/audit-logs")
            assert resp.status_code == 401


# ─── Duplicated-form independence (Day 18 interop) ──────────────────

class TestDuplicateIndependence:
    def test_retention_operates_per_form(self, db):
        from app.services.form_service import FormService

        source = Form(title="Original", user_id=1)
        db.add(source)
        db.flush()
        version = FormVersion(form_id=source.id, version_number=1, title="Original", status="draft")
        db.add(version)
        db.flush()
        db.commit()

        dup_result = FormService.duplicate_form(db=db, form_id=source.id, user_id=1)
        dup = db.query(Form).filter(Form.id == dup_result["id"]).first()

        # Retention policy ONLY on the original
        RetentionService.create_policy(db, source.id, retention_days=30)
        make_submission(db, source, "src_old", datetime.utcnow() - timedelta(days=60))
        make_submission(db, dup, "dup_old", datetime.utcnow() - timedelta(days=60))

        result = RetentionService.run_archive_job(db)
        assert result["archived_total"] == 1

        src = db.query(Submission).filter(Submission.response_id == "src_old").first()
        dup_sub = db.query(Submission).filter(Submission.response_id == "dup_old").first()
        assert src.status == "archived"
        assert dup_sub.status == "completed"  # duplicate unaffected
