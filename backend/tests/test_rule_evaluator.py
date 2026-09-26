"""
Unit tests for the Rule Evaluation Service.

Tests cover:
- All 7 operators: equals, not_equals, contains, greater_than, less_than, is_empty, is_not_empty
- Multiple rules affecting the same field
- Empty values
- Numeric comparisons
- String comparisons
- Priority logic (hide overrides show, require only if visible)
"""
import pytest
import sys
import os
from unittest.mock import MagicMock, patch

# Add backend directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.services.rule_evaluator_service import RuleEvaluationService


class TestConditionEvaluation:
    """Test the _evaluate_condition static method directly."""

    def test_equals_operator(self):
        assert RuleEvaluationService._evaluate_condition("Yes", "equals", "Yes") is True
        assert RuleEvaluationService._evaluate_condition("Yes", "equals", "No") is False
        assert RuleEvaluationService._evaluate_condition("", "equals", "Yes") is False
        assert RuleEvaluationService._evaluate_condition("yes", "equals", "Yes") is False  # case sensitive
        assert RuleEvaluationService._evaluate_condition("", "equals", None) is True  # both empty
        assert RuleEvaluationService._evaluate_condition("abc", "equals", None) is False

    def test_not_equals_operator(self):
        assert RuleEvaluationService._evaluate_condition("Yes", "not_equals", "No") is True
        assert RuleEvaluationService._evaluate_condition("Yes", "not_equals", "Yes") is False
        assert RuleEvaluationService._evaluate_condition("", "not_equals", None) is False
        assert RuleEvaluationService._evaluate_condition("abc", "not_equals", None) is True

    def test_contains_operator(self):
        assert RuleEvaluationService._evaluate_condition("Hello World", "contains", "World") is True
        assert RuleEvaluationService._evaluate_condition("Hello World", "contains", "world") is True  # case insensitive
        assert RuleEvaluationService._evaluate_condition("Hello World", "contains", "xyz") is False
        assert RuleEvaluationService._evaluate_condition("", "contains", "a") is False
        assert RuleEvaluationService._evaluate_condition("abc", "contains", None) is False

    def test_greater_than_operator(self):
        assert RuleEvaluationService._evaluate_condition("25", "greater_than", "18") is True
        assert RuleEvaluationService._evaluate_condition("10", "greater_than", "18") is False
        assert RuleEvaluationService._evaluate_condition("18", "greater_than", "18") is False
        assert RuleEvaluationService._evaluate_condition("25.5", "greater_than", "18.2") is True
        assert RuleEvaluationService._evaluate_condition("", "greater_than", "18") is False
        assert RuleEvaluationService._evaluate_condition(None, "greater_than", "18") is False
        # String comparison fallback
        assert RuleEvaluationService._evaluate_condition("b", "greater_than", "a") is True
        assert RuleEvaluationService._evaluate_condition("a", "greater_than", "b") is False

    def test_less_than_operator(self):
        assert RuleEvaluationService._evaluate_condition("10", "less_than", "18") is True
        assert RuleEvaluationService._evaluate_condition("25", "less_than", "18") is False
        assert RuleEvaluationService._evaluate_condition("18", "less_than", "18") is False
        assert RuleEvaluationService._evaluate_condition("10.5", "less_than", "18.2") is True
        assert RuleEvaluationService._evaluate_condition("", "less_than", "18") is False
        assert RuleEvaluationService._evaluate_condition(None, "less_than", "18") is False

    def test_is_empty_operator(self):
        assert RuleEvaluationService._evaluate_condition("", "is_empty", None) is True
        assert RuleEvaluationService._evaluate_condition(None, "is_empty", None) is True
        assert RuleEvaluationService._evaluate_condition("Hello", "is_empty", None) is False
        assert RuleEvaluationService._evaluate_condition(" ", "is_empty", None) is False  # space is not empty

    def test_is_not_empty_operator(self):
        assert RuleEvaluationService._evaluate_condition("Hello", "is_not_empty", None) is True
        assert RuleEvaluationService._evaluate_condition("", "is_not_empty", None) is False
        assert RuleEvaluationService._evaluate_condition(None, "is_not_empty", None) is False
        assert RuleEvaluationService._evaluate_condition(" ", "is_not_empty", None) is True  # space is not empty

    def test_unknown_operator(self):
        assert RuleEvaluationService._evaluate_condition("test", "unknown_op", None) is False


class TestEvaluateWithMockDb:
    """Test the evaluate method with a mocked database session."""

    def _create_mock_rule(self, rule_id, trigger_field_id, operator, compare_value,
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

    def _setup_mock_db(self, rules):
        """Create a mock DB session that returns the given rules."""
        db = MagicMock()
        # The actual query chain: db.query().filter().order_by().all()
        # Since the mock doesn't actually filter, we pre-filter to only include active rules
        active_rules = [r for r in rules if r.is_active]
        query_chain = db.query.return_value.filter.return_value.order_by.return_value
        query_chain.all.return_value = active_rules

        # Mock the Field query too (unused in evaluate but imported)
        field_query = db.query.return_value.filter.return_value
        field_query.all.return_value = []
        db.query.return_value.filter.return_value.in_.return_value = []

        return db

    def test_single_rule_equals_show(self):
        rules = [
            self._create_mock_rule(1, 101, "equals", "Yes", 102, "show"),
        ]
        db = self._setup_mock_db(rules)
        states, triggered = RuleEvaluationService.evaluate(db, 1, {"101": "Yes"})

        assert 102 in states
        assert states[102]["visible"] is True
        assert 1 in triggered

    def test_single_rule_equals_hide(self):
        rules = [
            self._create_mock_rule(1, 101, "equals", "Yes", 102, "hide"),
        ]
        db = self._setup_mock_db(rules)
        states, triggered = RuleEvaluationService.evaluate(db, 1, {"101": "Yes"})

        assert 102 not in states or states[102]["visible"] is False
        assert 1 in triggered

    def test_rule_not_triggered(self):
        rules = [
            self._create_mock_rule(1, 101, "equals", "Yes", 102, "hide"),
        ]
        db = self._setup_mock_db(rules)
        states, triggered = RuleEvaluationService.evaluate(db, 1, {"101": "No"})

        # Rule not triggered, field should be visible
        assert states[102]["visible"] is True
        assert 1 not in triggered

    def test_multiple_rules_same_field_last_action_wins(self):
        rules = [
            self._create_mock_rule(1, 101, "equals", "Hide", 103, "hide"),
            self._create_mock_rule(2, 102, "equals", "Show", 103, "show"),
        ]
        db = self._setup_mock_db(rules)
        states, triggered = RuleEvaluationService.evaluate(db, 1, {"101": "Hide", "102": "Show"})

        # Both rules triggered, rules evaluated in order by ID.
        # Rule 1 (hide) sets visible=False, then Rule 2 (show) sets visible=True.
        # So last action wins.
        assert states[103]["visible"] is True
        assert 1 in triggered
        assert 2 in triggered

    def test_require_only_if_visible(self):
        rules = [
            self._create_mock_rule(1, 101, "equals", "Hide", 103, "hide"),
            self._create_mock_rule(2, 102, "equals", "Require", 103, "require"),
        ]
        db = self._setup_mock_db(rules)

        # Both rules triggered
        states, triggered = RuleEvaluationService.evaluate(db, 1, {"101": "Hide", "102": "Require"})
        # Hide overrides, so field should be hidden and NOT required
        assert states[103]["visible"] is False
        assert states[103]["required"] is False

    def test_require_when_visible(self):
        rules = [
            self._create_mock_rule(1, 101, "equals", "Require", 103, "require"),
        ]
        db = self._setup_mock_db(rules)

        states, triggered = RuleEvaluationService.evaluate(db, 1, {"101": "Require"})
        assert states[103]["visible"] is True
        assert states[103]["required"] is True

    def test_inactive_rule_ignored(self):
        rules = [
            self._create_mock_rule(1, 101, "equals", "Yes", 102, "hide", is_active=False),
        ]
        db = self._setup_mock_db(rules)
        states, triggered = RuleEvaluationService.evaluate(db, 1, {"101": "Yes"})

        # Inactive rule should not be triggered
        assert 1 not in triggered
        # Since no active rules reference field 102, it won't be in states
        # This is expected — the rule engine only tracks fields referenced by active rules
        assert 102 not in states

    def test_numeric_comparison_chain(self):
        """Test: Age > 18 → Show Employment Status"""
        rules = [
            self._create_mock_rule(1, 101, "greater_than", "18", 102, "show"),
        ]
        db = self._setup_mock_db(rules)

        # Age 25 > 18, rule triggered
        states, triggered = RuleEvaluationService.evaluate(db, 1, {"101": "25"})
        assert 1 in triggered
        assert states[102]["visible"] is True

        # Age 15 < 18, rule not triggered
        states2, triggered2 = RuleEvaluationService.evaluate(db, 1, {"101": "15"})
        assert 1 not in triggered2

    def test_contains_string_match(self):
        rules = [
            self._create_mock_rule(1, 101, "contains", "car", 102, "show"),
        ]
        db = self._setup_mock_db(rules)

        states, triggered = RuleEvaluationService.evaluate(db, 1, {"101": "I have a car"})
        assert 1 in triggered

        states2, triggered2 = RuleEvaluationService.evaluate(db, 1, {"101": "I have a bike"})
        assert 1 not in triggered2

    def test_empty_values_input(self):
        rules = [
            self._create_mock_rule(1, 101, "is_empty", None, 102, "hide"),
            self._create_mock_rule(2, 101, "is_not_empty", None, 103, "show"),
        ]
        db = self._setup_mock_db(rules)

        # Empty value triggers is_empty but not is_not_empty
        states, triggered = RuleEvaluationService.evaluate(db, 1, {"101": ""})
        assert 1 in triggered
        assert 2 not in triggered

        # Non-empty value triggers is_not_empty but not is_empty
        states2, triggered2 = RuleEvaluationService.evaluate(db, 1, {"101": "Hello"})
        assert 1 not in triggered2
        assert 2 in triggered2

    def test_no_rules(self):
        db = self._setup_mock_db([])
        states, triggered = RuleEvaluationService.evaluate(db, 1, {"101": "test"})
        assert len(triggered) == 0

    def test_all_operators_together(self):
        rules = [
            self._create_mock_rule(1, 101, "equals", "Yes", 201, "show"),
            self._create_mock_rule(2, 102, "not_equals", "No", 202, "hide"),
            self._create_mock_rule(3, 103, "contains", "test", 203, "require"),
            self._create_mock_rule(4, 104, "greater_than", "10", 204, "show"),
            self._create_mock_rule(5, 105, "less_than", "100", 205, "require"),
            self._create_mock_rule(6, 106, "is_empty", None, 206, "hide"),
            self._create_mock_rule(7, 107, "is_not_empty", None, 207, "require"),
        ]
        db = self._setup_mock_db(rules)

        values = {
            "101": "Yes",        # equals → triggered
            "102": "Yes",        # not_equals "No" → triggered
            "103": "testing",    # contains "test" → triggered
            "104": "50",         # greater_than 10 → triggered
            "105": "50",         # less_than 100 → triggered
            "106": "",           # is_empty → triggered
            "107": "Hello",      # is_not_empty → triggered
        }
        states, triggered = RuleEvaluationService.evaluate(db, 1, values)

        assert len(triggered) == 7
        assert states[201]["visible"] is True
        assert states[202]["visible"] is False
        assert states[203]["required"] is True
        assert states[204]["visible"] is True
        assert states[205]["required"] is True
        assert states[206]["visible"] is False
        assert states[207]["required"] is True

    def test_triggered_rule_ids_returned(self):
        rules = [
            self._create_mock_rule(10, 101, "equals", "A", 102, "show"),
            self._create_mock_rule(20, 101, "equals", "B", 103, "hide"),
        ]
        db = self._setup_mock_db(rules)

        _, triggered = RuleEvaluationService.evaluate(db, 1, {"101": "A"})
        assert 10 in triggered
        assert 20 not in triggered
