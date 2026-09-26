"""
Regression tests for the Day 18 submission bug.

Reproduces the exact reported failure: a duplicated form with a conditional
HIDE rule (`Age < 18 → hide Email`) fails submission with
`{'102': ['This field is required']}` because the backend rule evaluator
looked up trigger values with string keys while the public-submit endpoint
passes an int-keyed dict — so hide rules never fired server-side and the
frontend-hidden field was still validated as visible + required.

The fix makes `RuleEvaluationService.evaluate` read trigger values with both
int and str keys, so the backend agrees with the frontend's evaluation.
"""
import sys
import os
from unittest.mock import MagicMock

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
    ConditionalRule,
    Submission,
)
from app.services.form_service import FormService  # noqa: E402
from app.services.rule_evaluator_service import RuleEvaluationService  # noqa: E402
from app.services.validation_service import ValidationService  # noqa: E402


# ─── Unit: int-keyed trigger values now fire rules ──────────────────

def _create_mock_rule(rule_id, trigger_field_id, operator, compare_value,
                      target_field_id, action, is_active=True):
    rule = MagicMock()
    rule.id = rule_id
    rule.form_id = 1
    rule.trigger_field_id = trigger_field_id
    rule.operator = operator
    rule.compare_value = compare_value
    rule.target_field_id = target_field_id
    rule.action = action
    rule.is_active = is_active
    return rule


def _setup_mock_db(rules):
    db = MagicMock()
    active = [r for r in rules if r.is_active]
    db.query.return_value.filter.return_value.order_by.return_value.all.return_value = active
    return db


class TestIntKeyedTriggerLookup:
    def test_hide_rule_fires_with_int_keys(self):
        """Regression: {'101': '12'} (int key, as sent by the submit endpoint)
        must trigger the rule instead of silently missing."""
        rules = [_create_mock_rule(1, 101, "less_than", "18", 102, "hide")]
        db = _setup_mock_db(rules)

        # int-keyed dict — exactly what /submit builds (form_values_int)
        states, triggered = RuleEvaluationService.evaluate(db, 1, {101: "12"})
        assert 1 in triggered
        assert states[102]["visible"] is False

    def test_hide_rule_not_fired_when_condition_false(self):
        rules = [_create_mock_rule(1, 101, "less_than", "18", 102, "hide")]
        db = _setup_mock_db(rules)

        states, triggered = RuleEvaluationService.evaluate(db, 1, {101: "20"})
        assert 1 not in triggered
        assert states[102]["visible"] is True

    def test_str_keys_still_work(self):
        """The /evaluate-rules endpoint passes str keys — must keep working."""
        rules = [_create_mock_rule(1, 101, "equals", "Yes", 102, "hide")]
        db = _setup_mock_db(rules)

        states, triggered = RuleEvaluationService.evaluate(db, 1, {"101": "Yes"})
        assert 1 in triggered
        assert states[102]["visible"] is False

    def test_none_value_triggers_is_empty_with_int_keys(self):
        """A present-but-None trigger value must not fall back to the default;
        it is a legitimate 'empty' value for is_empty semantics."""
        rules = [_create_mock_rule(1, 101, "is_empty", None, 102, "hide")]
        db = _setup_mock_db(rules)

        states, triggered = RuleEvaluationService.evaluate(db, 1, {101: None})
        assert 1 in triggered
        assert states[102]["visible"] is False

        states2, triggered2 = RuleEvaluationService.evaluate(db, 1, {101: "Hello"})
        assert 1 not in triggered2
        assert states2[102]["visible"] is True

    def test_zero_value_not_treated_as_missing(self):
        """A 0 trigger value is a real value — must be found (not the default)."""
        rules = [_create_mock_rule(1, 101, "is_not_empty", None, 102, "require")]
        db = _setup_mock_db(rules)

        states, triggered = RuleEvaluationService.evaluate(db, 1, {101: 0})
        assert 1 in triggered
        assert states[102]["required"] is True


# ─── End-to-end: duplicate → publish → submit ───────────────────────

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


def make_customer_survey(db, title="Customer Survey", owner_id=3):
    """Mirror the real form 8/24: Name, Age, Email(required), File, Rating, Country
    with the rule `Age < 18 → hide Email`."""
    form = Form(title=title, description="desc", user_id=owner_id)
    db.add(form)
    db.flush()

    version = FormVersion(form_id=form.id, version_number=1, title=title, status="draft")
    db.add(version)
    db.flush()

    fields = [
        Field(form_version_id=version.id, field_type="text", label="Name", is_required=1, order=1),
        Field(form_version_id=version.id, field_type="number", label="Age", is_required=1, order=2),
        Field(form_version_id=version.id, field_type="email", label="Email", is_required=1, order=3),
        Field(form_version_id=version.id, field_type="file", label="Attach File", is_required=0, order=4),
        Field(form_version_id=version.id, field_type="rating", label="Rating", is_required=1, order=5),
        Field(form_version_id=version.id, field_type="checkbox", label="Country", is_required=0, order=6),
    ]
    db.add_all(fields)
    db.flush()

    # Rule: Age < 18 → hide Email (same as real rule 15 / original rule)
    age_field = fields[1]   # Age
    email_field = fields[2]  # Email
    db.add(ConditionalRule(
        form_id=form.id,
        trigger_field_id=age_field.id,
        operator="less_than",
        compare_value="18",
        target_field_id=email_field.id,
        action="hide",
        is_active=True,
    ))

    db.commit()
    return form


def submit_like_endpoint(db, link_token, payload):
    """Replicate the public submit endpoint's core flow:
    resolve form → evaluate rules (int-keyed) → validate."""
    form_data = FormService.get_public_form(db, link_token=link_token)
    fields = form_data["fields"]
    form_id = form_data["form"]["id"]

    form_values_int = {}
    for k, v in payload.items():
        try:
            form_values_int[int(k)] = v
        except (ValueError, TypeError):
            form_values_int[k] = v

    field_states, triggered = RuleEvaluationService.evaluate(
        db=db, form_id=form_id, form_values=form_values_int,
    )
    errors = ValidationService.validate_form_submission(
        fields=fields, form_values=form_values_int, field_states=field_states,
    )
    return field_states, triggered, errors, form_id


class TestDuplicateSubmitFlow:
    def _publish_and_link(self, db, form_id):
        FormService.publish_version(db=db, form_id=form_id)
        link = FormService.generate_link(db=db, form_id=form_id)
        return link["link_token"]

    def test_hidden_email_submission_succeeds(self, db):
        """The reported bug: Age=12 → Email hidden by rule → submit must succeed."""
        original = make_customer_survey(db)
        dup = FormService.duplicate_form(db=db, form_id=original.id, user_id=3)
        token = self._publish_and_link(db, dup["id"])

        dup_fields = FormService.get_public_form(db, token)["fields"]
        by_label = {f["label"]: f for f in dup_fields}
        age_id = by_label["Age"]["id"]
        email_id = by_label["Email"]["id"]
        assert age_id != original.id  # sanity: independent

        # Age=12 (under 18) → Email hidden → not required
        payload = {str(age_id): "12", str(by_label["Name"]["id"]): "mithun ",
                   str(by_label["Rating"]["id"]): "3", str(by_label["Country"]["id"]): ["india"]}
        states, triggered, errors, form_id = submit_like_endpoint(db, token, payload)

        assert triggered  # the hide rule now fires
        assert states[email_id]["visible"] is False
        assert errors == {}
        assert form_id == dup["id"]

    def test_email_required_when_not_hidden(self, db):
        """Age=20 → Email visible + required → missing Email must 400; present must pass."""
        original = make_customer_survey(db)
        dup = FormService.duplicate_form(db=db, form_id=original.id, user_id=3)
        token = self._publish_and_link(db, dup["id"])

        dup_fields = FormService.get_public_form(db, token)["fields"]
        by_label = {f["label"]: f for f in dup_fields}
        age_id = by_label["Age"]["id"]
        email_id = by_label["Email"]["id"]

        # Age=20, no Email → Email required error (correct behavior)
        payload = {str(age_id): "20", str(by_label["Name"]["id"]): "mithun ",
                   str(by_label["Rating"]["id"]): "3"}
        _, _, errors, _ = submit_like_endpoint(db, token, payload)
        assert str(email_id) in errors
        assert "This field is required" in errors[str(email_id)]

        # Age=20, Email present → passes
        payload2 = {**payload, str(email_id): "mithun@gmail.com"}
        _, _, errors2, _ = submit_like_endpoint(db, token, payload2)
        assert errors2 == {}

    def test_response_stored_under_duplicate_only(self, db):
        original = make_customer_survey(db)
        dup = FormService.duplicate_form(db=db, form_id=original.id, user_id=3)
        token = self._publish_and_link(db, dup["id"])

        dup_fields = FormService.get_public_form(db, token)["fields"]
        by_label = {f["label"]: f for f in dup_fields}
        payload = {str(by_label["Name"]["id"]): "mithun ", str(by_label["Age"]["id"]): "20",
                   str(by_label["Email"]["id"]): "m@gmail.com", str(by_label["Rating"]["id"]): "3"}

        states, _, errors, form_id = submit_like_endpoint(db, token, payload)
        assert errors == {}
        FormService.store_submission(
            db=db, form_id=form_id,
            form_version_id=FormService.get_public_form(db, token)["form_version_id"],
            link_token=token, form_values=payload, field_states=states,
        )

        assert db.query(Submission).filter(Submission.form_id == dup["id"]).count() == 1
        assert db.query(Submission).filter(Submission.form_id == original.id).count() == 0
