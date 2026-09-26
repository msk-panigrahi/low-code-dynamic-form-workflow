"""
Day 18 — Form duplication tests (POST /api/forms/{form_id}/duplicate).

Covers:
- New form id + draft status
- Fields copied with order preserved
- Field options copied
- Conditional rules re-mapped to the NEW field ids (critical)
- Historical data isolation (versions / submissions / sessions NOT copied)
- Collision-free naming ("(Copy)", "(Copy 2)", ...)
- Atomicity: a mid-copy failure leaves no partial duplicate
- Authorization: owner allowed, non-owner 403, unauthenticated 401, legacy 200
"""
import sys
import os
from contextlib import contextmanager

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.database import Base  # noqa: E402
from app.models import (  # noqa: E402
    Form,
    FormVersion,
    Field,
    FieldOption,
    ConditionalRule,
    Submission,
    FormSession,
)
from app.services.form_service import FormService  # noqa: E402


# ─── Fixtures / helpers ─────────────────────────────────────────────

@pytest.fixture()
def db():
    """In-memory SQLite session shared across the test (StaticPool)."""
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


def make_field(version, field_type, label, order, config=None):
    return Field(
        form_version_id=version.id,
        field_type=field_type,
        label=label,
        is_required=1,
        order=order,
        configuration=config or {},
    )


def make_source_form(db, title="Customer Feedback Form", owner_id=1, with_options=True):
    """Create a source form: 4 fields (text, dropdown, rating, checkbox)."""
    form = Form(title=title, description="Help us improve", user_id=owner_id)
    db.add(form)
    db.flush()

    version = FormVersion(
        form_id=form.id,
        version_number=1,
        title=title,
        description="Help us improve",
        status="draft",
    )
    db.add(version)
    db.flush()

    dropdown_config = {
        "options": [
            {"label": "Social Media", "value": "Social Media"},
            {"label": "Friend / Referral", "value": "Friend / Referral"},
            {"label": "Search Engine", "value": "Search Engine"},
        ]
    }
    text = make_field(version, "text", "Full Name", 1)
    dropdown = make_field(version, "dropdown", "How did you hear about us?", 2, dropdown_config)
    rating = make_field(version, "rating", "Overall rating", 3, {"maxStars": 5})
    checkbox = make_field(version, "checkbox", "Interests", 4)
    db.add_all([text, dropdown, rating, checkbox])
    db.flush()

    if with_options:
        for i, opt in enumerate(dropdown_config["options"]):
            db.add(FieldOption(
                field_id=dropdown.id,
                label=opt["label"],
                value=opt["value"],
                order=i,
            ))

    db.commit()
    return form


def get_latest_version(db, form_id):
    return (
        db.query(FormVersion)
        .filter(FormVersion.form_id == form_id)
        .order_by(FormVersion.version_number.desc())
        .first()
    )


# ─── Service: basic duplication ─────────────────────────────────────

class TestDuplicateBasic:
    def test_new_id_draft_fields_and_order(self, db):
        source = make_source_form(db)
        result = FormService.duplicate_form(db=db, form_id=source.id, user_id=1)

        assert result["id"] != source.id
        assert result["status"] == "draft"

        dup = db.query(Form).filter(Form.id == result["id"]).first()
        assert dup is not None
        assert dup.user_id == 1
        assert dup.description == source.description
        assert dup.title == "Customer Feedback Form (Copy)"

        version = get_latest_version(db, dup.id)
        assert version.status == "draft"
        assert version.version_number == 1

        fields = (
            db.query(Field)
            .filter(Field.form_version_id == version.id)
            .order_by(Field.order)
            .all()
        )
        assert len(fields) == 4
        # Field order preserved
        assert [f.order for f in fields] == [1, 2, 3, 4]
        # Types/labels preserved
        assert [f.field_type for f in fields] == ["text", "dropdown", "rating", "checkbox"]
        assert fields[0].label == "Full Name"
        # Field config preserved (rating maxStars)
        assert fields[2].configuration.get("maxStars") == 5
        # No copied field shares the source field ids
        source_fields = (
            db.query(Field)
            .filter(Field.form_version_id == get_latest_version(db, source.id).id)
            .all()
        )
        assert all(nf.id not in {sf.id for sf in source_fields} for nf in fields)

    def test_field_options_copied(self, db):
        source = make_source_form(db)
        result = FormService.duplicate_form(db=db, form_id=source.id, user_id=1)

        dup_version = get_latest_version(db, result["id"])
        dropdown = (
            db.query(Field)
            .filter(
                Field.form_version_id == dup_version.id,
                Field.field_type == "dropdown",
            )
            .first()
        )
        options = (
            db.query(FieldOption)
            .filter(FieldOption.field_id == dropdown.id)
            .order_by(FieldOption.order)
            .all()
        )
        assert [o.label for o in options] == [
            "Social Media",
            "Friend / Referral",
            "Search Engine",
        ]
        assert [o.value for o in options] == [
            "Social Media",
            "Friend / Referral",
            "Search Engine",
        ]
        # Options belong to the NEW field, not the source
        assert all(o.field_id == dropdown.id for o in options)

    def test_duplicate_title_collision_handled(self, db):
        source = make_source_form(db, title="Annual Survey")
        first = FormService.duplicate_form(db=db, form_id=source.id, user_id=1)
        assert first["title"] == "Annual Survey (Copy)"
        second = FormService.duplicate_form(db=db, form_id=source.id, user_id=1)
        assert second["title"] == "Annual Survey (Copy 2)"
        # Both coexist independently
        titles = [f.title for f in db.query(Form).all()]
        assert titles.count("Annual Survey (Copy)") == 1
        assert titles.count("Annual Survey (Copy 2)") == 1

    def test_not_found_raises(self, db):
        with pytest.raises(ValueError, match="not found"):
            FormService.duplicate_form(db=db, form_id=99999, user_id=1)


# ─── Service: conditional-rule field-id remapping (CRITICAL) ────────

class TestRuleRemapping:
    def test_rules_reference_new_field_ids(self, db):
        source = make_source_form(db)
        src_version = get_latest_version(db, source.id)
        source_fields = (
            db.query(Field)
            .filter(Field.form_version_id == src_version.id)
            .order_by(Field.order)
            .all()
        )
        trigger, target = source_fields[1], source_fields[3]  # dropdown -> checkbox

        rule = ConditionalRule(
            form_id=source.id,
            trigger_field_id=trigger.id,
            operator="equals",
            compare_value="Social Media",
            target_field_id=target.id,
            action="show",
            is_active=True,
        )
        db.add(rule)
        db.commit()

        result = FormService.duplicate_form(db=db, form_id=source.id, user_id=1)
        assert result["rule_count"] == 1

        dup_rules = (
            db.query(ConditionalRule)
            .filter(ConditionalRule.form_id == result["id"])
            .all()
        )
        assert len(dup_rules) == 1
        new_rule = dup_rules[0]

        # CRITICAL: rule must NOT reference the original field ids
        assert new_rule.trigger_field_id != trigger.id
        assert new_rule.target_field_id != target.id
        # It must reference the duplicated form's own fields
        dup_version = get_latest_version(db, result["id"])
        dup_field_ids = {
            f.id
            for f in db.query(Field).filter(Field.form_version_id == dup_version.id).all()
        }
        assert new_rule.trigger_field_id in dup_field_ids
        assert new_rule.target_field_id in dup_field_ids
        # Condition/action preserved
        assert new_rule.operator == "equals"
        assert new_rule.compare_value == "Social Media"
        assert new_rule.action == "show"
        assert new_rule.is_active is True

    def test_stale_rule_skipped(self, db):
        """A rule pointing at a field outside the copied version is skipped."""
        source = make_source_form(db)
        src_version = get_latest_version(db, source.id)
        source_fields = (
            db.query(Field)
            .filter(Field.form_version_id == src_version.id)
            .order_by(Field.order)
            .all()
        )
        trigger = source_fields[0]

        # Orphan field (belongs to a version we will NOT copy)
        other_version = FormVersion(
            form_id=source.id,
            version_number=2,
            title="legacy",
            status="archived",
        )
        db.add(other_version)
        db.flush()
        orphan = Field(
            form_version_id=other_version.id,
            field_type="text",
            label="Orphan",
            order=1,
        )
        db.add(orphan)
        db.flush()

        db.add(ConditionalRule(
            form_id=source.id,
            trigger_field_id=trigger.id,
            operator="equals",
            compare_value="x",
            target_field_id=orphan.id,  # not in the copied structure
            action="show",
        ))
        db.commit()

        result = FormService.duplicate_form(db=db, form_id=source.id, user_id=1)
        assert result["rule_count"] == 0


# ─── Service: historical data isolation ─────────────────────────────

class TestIsolation:
    def test_versions_submissions_sessions_not_copied(self, db):
        source = make_source_form(db)
        src_version = get_latest_version(db, source.id)

        # Add a second version + a submission + a session to the source
        v2 = FormVersion(
            form_id=source.id,
            version_number=2,
            title=source.title,
            status="published",
        )
        db.add(v2)
        db.flush()
        db.add(Submission(
            form_id=source.id,
            form_version_id=src_version.id,
            link_token="abc123",
            response_id="resp_0001",
            status="completed",
        ))
        db.add(FormSession(
            form_id=source.id,
            session_id="sess_0001",
        ))
        db.commit()

        result = FormService.duplicate_form(db=db, form_id=source.id, user_id=1)
        dup_id = result["id"]

        # Duplicate has exactly ONE fresh draft version
        versions = db.query(FormVersion).filter(FormVersion.form_id == dup_id).all()
        assert len(versions) == 1
        assert versions[0].version_number == 1
        assert versions[0].status == "draft"

        # No submissions, sessions, public links
        assert db.query(Submission).filter(Submission.form_id == dup_id).count() == 0
        assert db.query(FormSession).filter(FormSession.form_id == dup_id).count() == 0

        # Source data untouched
        assert db.query(Submission).filter(Submission.form_id == source.id).count() == 1
        assert db.query(FormVersion).filter(FormVersion.form_id == source.id).count() == 2

    def test_independent_edits(self, db):
        source = make_source_form(db)
        result = FormService.duplicate_form(db=db, form_id=source.id, user_id=1)

        # Edit the duplicate's title — the source must not change
        dup = db.query(Form).filter(Form.id == result["id"]).first()
        dup.title = "Renamed Copy"
        db.commit()

        src = db.query(Form).filter(Form.id == source.id).first()
        assert src.title == "Customer Feedback Form"


# ─── Service: transaction atomicity ─────────────────────────────────

class TestAtomicity:
    def test_failure_rolls_back_no_partial_form(self, db):
        source = make_source_form(db)
        original_count = db.query(Form).count()
        original_versions = db.query(FormVersion).count()

        def boom():
            raise RuntimeError("simulated mid-copy failure")

        db.commit = boom  # force the final commit to fail

        with pytest.raises(RuntimeError):
            FormService.duplicate_form(db=db, form_id=source.id, user_id=1)

        # Discard the aborted transaction (same as get_db closing the session)
        db.rollback()

        assert db.query(Form).count() == original_count
        assert db.query(FormVersion).count() == original_versions


# ─── Router / API level ─────────────────────────────────────────────

class TestDuplicateRouter:
    @contextmanager
    def _client(self, db, current_user_id=1):
        from fastapi.testclient import TestClient
        from unittest.mock import MagicMock
        from app.main import app
        from app.database import get_db
        import app.routers.forms as forms_mod

        user = MagicMock()
        user.id = current_user_id

        def _override_db():
            yield db

        app.dependency_overrides[get_db] = _override_db
        app.dependency_overrides[forms_mod.get_current_user] = lambda: user
        client = TestClient(app)
        try:
            yield client
        finally:
            app.dependency_overrides.clear()

    def _make_form(self, db, owner_id):
        return make_source_form(db, owner_id=owner_id)

    def test_owner_can_duplicate(self, db):
        source = self._make_form(db, owner_id=1)
        with self._client(db, current_user_id=1) as client:
            resp = client.post(f"/api/forms/{source.id}/duplicate")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["message"] == "Form duplicated successfully"
        assert body["form"]["id"] != source.id
        assert body["form"]["status"] == "draft"
        assert body["form"]["title"] == "Customer Feedback Form (Copy)"

    def test_legacy_form_any_authenticated_user(self, db):
        source = self._make_form(db, owner_id=None)
        with self._client(db, current_user_id=5) as client:
            resp = client.post(f"/api/forms/{source.id}/duplicate")
        assert resp.status_code == 200

    def test_non_owner_gets_403(self, db):
        source = self._make_form(db, owner_id=1)
        with self._client(db, current_user_id=2) as client:
            resp = client.post(f"/api/forms/{source.id}/duplicate")
        assert resp.status_code == 403

    def test_unauthenticated_gets_401(self, db):
        from contextlib import contextmanager
        from fastapi.testclient import TestClient
        from app.main import app
        from app.database import get_db

        source = self._make_form(db, owner_id=1)

        def _override_db():
            yield db

        app.dependency_overrides[get_db] = _override_db
        # No get_current_user override → the real (missing) JWT path runs
        client = TestClient(app)
        try:
            resp = client.post(f"/api/forms/{source.id}/duplicate")
            assert resp.status_code == 401
        finally:
            app.dependency_overrides.clear()

    def test_missing_form_gets_404(self, db):
        with self._client(db) as client:
            resp = client.post("/api/forms/99999/duplicate")
        assert resp.status_code == 404


# ─── Regression: creating a new draft version must re-map form rules ───
#
# ConditionalRule rows are stored per FORM, but _create_new_draft_version
# copies fields with brand-new ids. Before the fix the rules kept pointing at
# the source version's field ids, so after any republish they stopped firing
# (server-side validation AND the public form's client-side evaluation) and
# duplication silently dropped them (the "duplicated form rejects hidden
# required fields" bug).

class TestDraftVersionRuleRemap:

    @staticmethod
    def _add_rule(db, form_id, trigger, target):
        db.add(ConditionalRule(
            form_id=form_id,
            trigger_field_id=trigger.id,
            operator="equals",
            compare_value="Search Engine",
            target_field_id=target.id,
            action="hide",
        ))
        db.commit()

    @staticmethod
    def _field_by_label(db, form_id, label):
        version = get_latest_version(db, form_id)
        return (
            db.query(Field)
            .filter(Field.form_version_id == version.id, Field.label == label)
            .first()
        )

    def test_create_draft_from_version_remaps_rules(self, db):
        source = make_source_form(db)
        FormService.publish_version(db=db, form_id=source.id)

        trigger = self._field_by_label(db, source.id, "How did you hear about us?")
        target = self._field_by_label(db, source.id, "Overall rating")
        self._add_rule(db, source.id, trigger, target)
        v1_ids = {trigger.id, target.id}

        # Edit-as-new-draft: copies the published version into a fresh draft
        FormService.create_draft_from_version(db=db, form_id=source.id)

        new_trigger = self._field_by_label(db, source.id, "How did you hear about us?")
        new_target = self._field_by_label(db, source.id, "Overall rating")
        assert {new_trigger.id, new_target.id}.isdisjoint(v1_ids)  # fields were copied

        rule = db.query(ConditionalRule).filter(ConditionalRule.form_id == source.id).one()
        assert rule.trigger_field_id == new_trigger.id
        assert rule.target_field_id == new_target.id

    def test_auto_draft_on_add_field_remaps_rules(self, db):
        """add_field on a published form auto-creates a draft -> rules follow."""
        source = make_source_form(db)
        FormService.publish_version(db=db, form_id=source.id)

        trigger = self._field_by_label(db, source.id, "How did you hear about us?")
        target = self._field_by_label(db, source.id, "Overall rating")
        self._add_rule(db, source.id, trigger, target)

        FormService.add_field(
            db=db, form_id=source.id, label="New field", field_type="text",
            required=False, order=99, config={},
        )

        new_trigger = self._field_by_label(db, source.id, "How did you hear about us?")
        new_target = self._field_by_label(db, source.id, "Overall rating")
        rule = db.query(ConditionalRule).filter(ConditionalRule.form_id == source.id).one()
        assert rule.trigger_field_id == new_trigger.id
        assert rule.target_field_id == new_target.id
        assert new_trigger.id != trigger.id

    def test_duplicate_after_republish_still_copies_rules(self, db):
        """End-to-end: publish -> edit (new draft) -> publish -> duplicate."""
        source = make_source_form(db)
        FormService.publish_version(db=db, form_id=source.id)
        trigger = self._field_by_label(db, source.id, "How did you hear about us?")
        target = self._field_by_label(db, source.id, "Overall rating")
        self._add_rule(db, source.id, trigger, target)

        # Round-trip through a second version, then publish it
        FormService.create_draft_from_version(db=db, form_id=source.id)
        FormService.publish_version(db=db, form_id=source.id)

        result = FormService.duplicate_form(db=db, form_id=source.id, user_id=1)

        rules = db.query(ConditionalRule).filter(
            ConditionalRule.form_id == result["id"]
        ).all()
        assert len(rules) == 1  # pre-fix this was 0 (unmappable stale ids)

        dup_trigger = self._field_by_label(db, result["id"], "How did you hear about us?")
        dup_target = self._field_by_label(db, result["id"], "Overall rating")
        assert rules[0].trigger_field_id == dup_trigger.id
        assert rules[0].target_field_id == dup_target.id
