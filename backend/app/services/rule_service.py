from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_
from datetime import datetime
from ..models import ConditionalRule, Field, Form


# ─── Supported Operators ──────────────────────────────────────────────
VALID_OPERATORS = [
    "equals",
    "not_equals",
    "contains",
    "greater_than",
    "less_than",
    "is_empty",
    "is_not_empty",
]

# ─── Supported Actions ────────────────────────────────────────────────
VALID_ACTIONS = ["show", "hide", "require"]


class RuleService:
    """Service for managing conditional rules on forms"""

    @staticmethod
    def validate_rule(
        db: Session,
        form_id: int,
        trigger_field_id: int,
        operator: str,
        target_field_id: int,
        action: str,
    ) -> List[str]:
        """Validate a rule and return list of error messages."""
        errors: List[str] = []

        # Validate operator
        if operator not in VALID_OPERATORS:
            errors.append(
                f"Invalid operator '{operator}'. Must be one of: {', '.join(VALID_OPERATORS)}"
            )

        # Validate action
        if action not in VALID_ACTIONS:
            errors.append(
                f"Invalid action '{action}'. Must be one of: {', '.join(VALID_ACTIONS)}"
            )

        # Validate form exists
        form = db.query(Form).filter(Form.id == form_id).first()
        if not form:
            errors.append(f"Form with id {form_id} not found")
            return errors  # Cannot validate fields without a valid form

        # Get all fields belonging to this form (across all versions)
        # We need to check fields in the context of the form
        form_field_ids = set()
        versions = form.versions
        for version in versions:
            for field in version.fields:
                form_field_ids.add(field.id)

        # Validate trigger field exists in this form
        if trigger_field_id not in form_field_ids:
            errors.append(f"Trigger field with id {trigger_field_id} not found in form {form_id}")

        # Validate target field exists in this form
        if target_field_id not in form_field_ids:
            errors.append(f"Target field with id {target_field_id} not found in form {form_id}")

        # Validate trigger and target are not the same
        if trigger_field_id == target_field_id:
            errors.append("Trigger field and target field cannot be the same")

        return errors

    @staticmethod
    def create_rule(
        db: Session,
        form_id: int,
        trigger_field_id: int,
        operator: str,
        compare_value: Optional[str],
        target_field_id: int,
        action: str,
    ) -> Dict[str, Any]:
        """Create a new conditional rule for a form."""
        # Validate
        errors = RuleService.validate_rule(
            db, form_id, trigger_field_id, operator, target_field_id, action
        )
        if errors:
            raise ValueError("; ".join(errors))

        # For is_empty and is_not_empty, compare_value should be null/empty
        if operator in ("is_empty", "is_not_empty"):
            compare_value = None

        # Check for duplicate rules
        existing = (
            db.query(ConditionalRule)
            .filter(
                ConditionalRule.form_id == form_id,
                ConditionalRule.trigger_field_id == trigger_field_id,
                ConditionalRule.operator == operator,
                ConditionalRule.target_field_id == target_field_id,
                ConditionalRule.action == action,
                ConditionalRule.compare_value == compare_value,
            )
            .first()
        )
        if existing:
            raise ValueError("A rule with the same trigger, operator, value, target, and action already exists.")

        rule = ConditionalRule(
            form_id=form_id,
            trigger_field_id=trigger_field_id,
            operator=operator,
            compare_value=compare_value,
            target_field_id=target_field_id,
            action=action,
            is_active=True,
        )
        db.add(rule)
        db.flush()
        db.commit()
        db.refresh(rule)

        return RuleService._rule_to_dict(rule)

    @staticmethod
    def get_rules(db: Session, form_id: int) -> List[Dict[str, Any]]:
        """Get all conditional rules for a form."""
        rules = (
            db.query(ConditionalRule)
            .filter(ConditionalRule.form_id == form_id)
            .order_by(desc(ConditionalRule.created_at))
            .all()
        )
        return [RuleService._rule_to_dict(r) for r in rules]

    @staticmethod
    def update_rule(
        db: Session,
        form_id: int,
        rule_id: int,
        trigger_field_id: Optional[int] = None,
        operator: Optional[str] = None,
        compare_value: Optional[str] = None,
        target_field_id: Optional[int] = None,
        action: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Update an existing conditional rule."""
        rule = (
            db.query(ConditionalRule)
            .filter(
                ConditionalRule.id == rule_id,
                ConditionalRule.form_id == form_id,
            )
            .first()
        )
        if not rule:
            raise ValueError(f"Rule with id {rule_id} not found in form {form_id}")

        # Apply updates
        new_trigger_field_id = trigger_field_id if trigger_field_id is not None else rule.trigger_field_id
        new_operator = operator if operator is not None else rule.operator
        new_target_field_id = target_field_id if target_field_id is not None else rule.target_field_id
        new_action = action if action is not None else rule.action
        new_compare_value = compare_value if compare_value is not None else rule.compare_value

        # Validate updated fields
        errors = RuleService.validate_rule(
            db, form_id, new_trigger_field_id, new_operator, new_target_field_id, new_action
        )
        if errors:
            raise ValueError("; ".join(errors))

        # For is_empty and is_not_empty, compare_value should be null
        if new_operator in ("is_empty", "is_not_empty"):
            new_compare_value = None

        # Check for duplicates (exclude self)
        existing = (
            db.query(ConditionalRule)
            .filter(
                ConditionalRule.form_id == form_id,
                ConditionalRule.trigger_field_id == new_trigger_field_id,
                ConditionalRule.operator == new_operator,
                ConditionalRule.target_field_id == new_target_field_id,
                ConditionalRule.action == new_action,
                ConditionalRule.compare_value == new_compare_value,
                ConditionalRule.id != rule_id,
            )
            .first()
        )
        if existing:
            raise ValueError("A rule with the same trigger, operator, value, target, and action already exists.")

        rule.trigger_field_id = new_trigger_field_id
        rule.operator = new_operator
        rule.compare_value = new_compare_value
        rule.target_field_id = new_target_field_id
        rule.action = new_action
        rule.updated_at = datetime.utcnow()

        db.flush()
        db.commit()
        db.refresh(rule)

        return RuleService._rule_to_dict(rule)

    @staticmethod
    def toggle_rule(db: Session, form_id: int, rule_id: int) -> Dict[str, Any]:
        """Toggle the active status of a conditional rule."""
        rule = (
            db.query(ConditionalRule)
            .filter(
                ConditionalRule.id == rule_id,
                ConditionalRule.form_id == form_id,
            )
            .first()
        )
        if not rule:
            raise ValueError(f"Rule with id {rule_id} not found in form {form_id}")

        rule.is_active = not rule.is_active
        rule.updated_at = datetime.utcnow()

        db.flush()
        db.commit()
        db.refresh(rule)

        return RuleService._rule_to_dict(rule)

    @staticmethod
    def delete_rule(db: Session, form_id: int, rule_id: int) -> None:
        """Delete a conditional rule."""
        rule = (
            db.query(ConditionalRule)
            .filter(
                ConditionalRule.id == rule_id,
                ConditionalRule.form_id == form_id,
            )
            .first()
        )
        if not rule:
            raise ValueError(f"Rule with id {rule_id} not found in form {form_id}")

        db.delete(rule)
        db.commit()

    @staticmethod
    def _rule_to_dict(rule: ConditionalRule) -> Dict[str, Any]:
        """Convert a ConditionalRule model to a dict."""
        return {
            "id": rule.id,
            "form_id": rule.form_id,
            "trigger_field_id": rule.trigger_field_id,
            "operator": rule.operator,
            "compare_value": rule.compare_value,
            "target_field_id": rule.target_field_id,
            "action": rule.action,
            "is_active": rule.is_active,
            "created_at": rule.created_at.isoformat() if rule.created_at else None,
            "updated_at": rule.updated_at.isoformat() if rule.updated_at else None,
        }
