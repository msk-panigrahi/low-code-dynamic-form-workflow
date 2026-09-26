from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import asc
from ..models import ConditionalRule


class RuleEvaluationService:
    """Service for evaluating conditional rules against form submissions."""

    OPERATORS = {
        "equals": lambda a, b: str(a) == str(b) if b is not None else str(a) == "",
        "not_equals": lambda a, b: str(a) != str(b) if b is not None else str(a) != "",
        "greater_than": lambda a, b: _safe_numeric_compare(a, b, lambda x, y: x > y),
        "greater_or_equal": lambda a, b: _safe_numeric_compare(a, b, lambda x, y: x >= y),
        "less_than": lambda a, b: _safe_numeric_compare(a, b, lambda x, y: x < y),
        "less_or_equal": lambda a, b: _safe_numeric_compare(a, b, lambda x, y: x <= y),
        "contains": lambda a, b: b is not None and str(b).lower() in str(a).lower(),
        "starts_with": lambda a, b: b is not None and str(a).lower().startswith(str(b).lower()),
        "ends_with": lambda a, b: b is not None and str(a).lower().endswith(str(b).lower()),
        "is_empty": lambda a, b: a is None or str(a) == "",
        "is_not_empty": lambda a, b: a is not None and str(a) != "",
    }

    @staticmethod
    def evaluate(
        db: Session, form_id: int, form_values: Dict[str, Any]
    ) -> Tuple[Dict[int, Dict[str, bool]], List[int]]:
        """
        Evaluate all active conditional rules for a form against submitted values.

        Returns:
            field_states: Dict mapping field_id -> {"visible": bool, "required": bool, "disabled": bool}
            triggered_rule_ids: List of rule IDs that were triggered
        """
        rules = (
            db.query(ConditionalRule)
            .filter(
                ConditionalRule.form_id == form_id,
                ConditionalRule.is_active == True,
            )
            .order_by(asc(ConditionalRule.id))
            .all()
        )

        # Collect all field IDs referenced in rules
        all_field_ids: set = set()
        for r in rules:
            all_field_ids.add(r.trigger_field_id)
            all_field_ids.add(r.target_field_id)

        # Initialize all fields as visible, not required, not disabled
        field_states: Dict[int, Dict[str, bool]] = {}
        for fid in all_field_ids:
            field_states[fid] = {"visible": True, "required": False, "disabled": False}

        triggered_rule_ids: List[int] = []

        # Evaluate each rule in order (deterministic, by rule ID)
        for rule in rules:
            # Look up the trigger value by BOTH the int field id and its str form.
            # The public-submit endpoint passes an int-keyed dict (form_values_int);
            # the /evaluate-rules endpoint passes str keys from JSON. A str-only
            # lookup silently missed int-keyed dicts, so hide rules never fired
            # server-side and fields the frontend correctly hid were still
            # validated as visible + required (400 on duplicated forms).
            trigger_value = form_values.get(
                rule.trigger_field_id,
                form_values.get(str(rule.trigger_field_id), ""),
            )

            if RuleEvaluationService._evaluate_condition(
                trigger_value, rule.operator, rule.compare_value
            ):
                triggered_rule_ids.append(rule.id)
                target_id = rule.target_field_id

                if target_id not in field_states:
                    field_states[target_id] = {"visible": True, "required": False, "disabled": False}

                if rule.action == "hide":
                    field_states[target_id] = {"visible": False, "required": False, "disabled": False}
                elif rule.action == "show":
                    field_states[target_id]["visible"] = True
                elif rule.action == "require":
                    # Only require if field is visible
                    if field_states[target_id]["visible"]:
                        field_states[target_id]["required"] = True
                elif rule.action == "optional":
                    field_states[target_id]["required"] = False
                elif rule.action == "disable":
                    field_states[target_id]["disabled"] = True
                elif rule.action == "enable":
                    field_states[target_id]["disabled"] = False

        return field_states, triggered_rule_ids

    @staticmethod
    def evaluate_field_states(
        db: Session, form_id: int, form_values: Dict[str, Any]
    ) -> Dict[int, Dict[str, bool]]:
        """Convenience method to get only field states (without triggered rule IDs)."""
        field_states, _ = RuleEvaluationService.evaluate(db, form_id, form_values)
        return field_states

    @staticmethod
    def _evaluate_condition(
        trigger_value: Any, operator: str, compare_value: Optional[str]
    ) -> bool:
        """Evaluate a single rule condition."""
        fn = RuleEvaluationService.OPERATORS.get(operator)
        if fn is None:
            return False
        try:
            return fn(trigger_value, compare_value)
        except Exception:
            return False


def _safe_numeric_compare(a: Any, b: Any, cmp_fn) -> bool:
    """Attempt numeric comparison; fall back to string comparison."""
    if a is None or a == "":
        return False
    if b is None:
        return False
    try:
        return cmp_fn(float(a), float(b))
    except (ValueError, TypeError):
        return cmp_fn(str(a), str(b))
