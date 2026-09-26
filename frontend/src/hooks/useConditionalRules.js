import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ruleService } from '../services';

// ─── Condition Evaluator ──────────────────────────────────────────
const CONDITION_EVALUATORS = {
  equals: (value, compareValue) => String(value) === String(compareValue ?? ''),
  not_equals: (value, compareValue) => String(value) !== String(compareValue ?? ''),
  greater_than: (value, compareValue) => {
    if (value === '' || value == null || compareValue == null) return false;
    try { return parseFloat(value) > parseFloat(compareValue); }
    catch { return String(value) > String(compareValue); }
  },
  greater_or_equal: (value, compareValue) => {
    if (value === '' || value == null || compareValue == null) return false;
    try { return parseFloat(value) >= parseFloat(compareValue); }
    catch { return String(value) >= String(compareValue); }
  },
  less_than: (value, compareValue) => {
    if (value === '' || value == null || compareValue == null) return false;
    try { return parseFloat(value) < parseFloat(compareValue); }
    catch { return String(value) < String(compareValue); }
  },
  less_or_equal: (value, compareValue) => {
    if (value === '' || value == null || compareValue == null) return false;
    try { return parseFloat(value) <= parseFloat(compareValue); }
    catch { return String(value) <= String(compareValue); }
  },
  contains: (value, compareValue) => {
    if (compareValue == null) return false;
    return String(value).toLowerCase().includes(String(compareValue).toLowerCase());
  },
  starts_with: (value, compareValue) => {
    if (compareValue == null) return false;
    return String(value).toLowerCase().startsWith(String(compareValue).toLowerCase());
  },
  ends_with: (value, compareValue) => {
    if (compareValue == null) return false;
    return String(value).toLowerCase().endsWith(String(compareValue).toLowerCase());
  },
  is_empty: (value) => value == null || String(value).trim() === '',
  is_not_empty: (value) => value != null && String(value).trim() !== '',
};

// ─── Evaluate a Single Condition ─────────────────────────────────
function evaluateCondition(value, operator, compareValue) {
  const evaluator = CONDITION_EVALUATORS[operator];
  if (!evaluator) return false;
  try {
    return evaluator(value, compareValue);
  } catch {
    return false;
  }
}

// ─── Action Executor ─────────────────────────────────────────────
function executeAction(state, action) {
  switch (action) {
    case 'show':
      return { ...state, visible: true };
    case 'hide':
      return { visible: false, required: false, disabled: false };
    case 'require':
      return state.visible ? { ...state, required: true } : state;
    case 'optional':
      return { ...state, required: false };
    case 'enable':
      return { ...state, disabled: false };
    case 'disable':
      return { ...state, disabled: true };
    default:
      return state;
  }
}

// ─── Rule Engine ─────────────────────────────────────────────────
function evaluateRules(rules, formValues) {
  // Only consider active rules, sorted deterministically
  const activeRules = rules
    .filter((r) => r.is_active)
    .sort((a, b) => a.id - b.id);

  // Collect all target field IDs
  const fieldIds = new Set(activeRules.map((r) => r.target_field_id));

  // Initialize all tracked fields
  const states = {};
  for (const fid of fieldIds) {
    states[fid] = { visible: true, required: false, disabled: false };
  }

  // Evaluate rules in order (priority: lower ID first)
  for (const rule of activeRules) {
    const triggerValue = formValues[rule.trigger_field_id] ?? '';
    const conditionMet = evaluateCondition(
      triggerValue,
      rule.operator,
      rule.compare_value,
    );

    if (conditionMet) {
      const current = states[rule.target_field_id] ?? {
        visible: true,
        required: false,
        disabled: false,
      };
      states[rule.target_field_id] = executeAction(current, rule.action);
    }
  }

  return states;
}

// ─── Main Hook ───────────────────────────────────────────────────
export function useConditionalRules(formId, formValues = {}) {
  const { t } = useTranslation();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastFormIdRef = useRef(null);

  // Fetch rules when formId changes
  useEffect(() => {
    if (!formId) {
      setRules([]);
      return;
    }

    // Avoid re-fetching same form
    if (lastFormIdRef.current === formId) return;
    lastFormIdRef.current = formId;

    let cancelled = false;
    setLoading(true);
    setError(null);

    ruleService
      .listRules(formId)
      .then((data) => {
        if (!cancelled) {
          setRules(data.rules || []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load rules:', err);
          setError(t('rules.loadFailed'));
          setRules([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [formId]);

  // ─── Evaluate rules against form values ─────────────────────────
  const fieldStates = useMemo(
    () => evaluateRules(rules, formValues),
    [rules, formValues],
  );

  const evaluate = useCallback(
    (vals) => evaluateRules(rules, vals),
    [rules],
  );

  return {
    rules,
    loading,
    error,
    fieldStates,
    evaluate,
    refetch: () => {
      lastFormIdRef.current = null;
      setLoading(true);
      ruleService
        .listRules(formId)
        .then((data) => setRules(data.rules || []))
        .catch((err) => {
          console.error('Failed to load rules:', err);
          setError(t('rules.loadFailed'));
        })
        .finally(() => setLoading(false));
    },
  };
}

// ─── Direct rule evaluation (no hook, for testing) ───────────────
export function evaluateRulesDirect(rules, formValues) {
  return evaluateRules(rules, formValues);
}

export { evaluateCondition };
