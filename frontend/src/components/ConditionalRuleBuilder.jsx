import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

// ─── Constants ───────────────────────────────────────────────────────
// Operator/action values are stable API values; display labels are
// translated via the `rules.operators.*` / `rules.actions.*` keys.
const OPERATORS = [
  { value: 'equals' },
  { value: 'not_equals' },
  { value: 'contains' },
  { value: 'greater_than' },
  { value: 'less_than' },
  { value: 'is_empty' },
  { value: 'is_not_empty' },
];

const ACTIONS = [
  { value: 'show' },
  { value: 'hide' },
  { value: 'require' },
];

const RULES_PER_PAGE = 10;

const operatorBadgeColors = {
  equals:        'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30',
  not_equals:    'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30',
  contains:      'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30',
  greater_than:  'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30',
  less_than:     'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30',
  is_empty:      'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/30',
  is_not_empty:  'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/30',
};

const actionBadgeColors = {
  show:    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30',
  hide:    'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30',
  require: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30',
};

// ─── Shared Select ───────────────────────────────────────────────────
const RuleSelect = ({ value, onChange, placeholder, options, disabled, error }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    disabled={disabled}
    className={`w-full min-h-[46px] px-4 pr-10 text-sm rounded-xl appearance-none cursor-pointer
      transition-all duration-200 ease-out
      focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400
      disabled:opacity-50 disabled:cursor-not-allowed hover:border-indigo-300
      ${error ? 'border-red-400' : ''}`}
    style={{
      backgroundColor: 'var(--color-input-bg)',
      border: '1px solid var(--color-input-border)',
      color: value ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238892a6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 12px center',
      backgroundSize: '16px',
    }}
  >
    <option value="" disabled>{placeholder}</option>
    {options.map((opt) => (
      <option key={opt.value} value={opt.value} style={{ color: 'var(--color-text-primary)' }}>
        {opt.label}
      </option>
    ))}
  </select>
);

// ─── Skeleton Row ────────────────────────────────────────────────────
const SkeletonRow = () => (
  <div className="flex items-center gap-4 px-5 py-4 animate-pulse">
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-[120px]" />
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-[80px]" />
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-[90px]" />
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-[120px]" />
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-[60px]" />
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-[50px]" />
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-[60px]" />
  </div>
);

// ─── Confirm Delete Modal ────────────────────────────────────────────
const DeleteRuleModal = ({ onConfirm, onCancel, deleting }) => {
  const { t } = useTranslation();
  const overlayRef = useRef(null);
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onCancel?.(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onCancel]);

  return (
    <motion.div
      ref={overlayRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--color-modal-overlay)' }}
      onClick={(e) => { if (e.target === overlayRef.current) onCancel?.(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ type: 'spring', duration: 0.35 }}
        className="w-full max-w-sm rounded-2xl shadow-2xl border overflow-hidden"
        style={{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-2 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>{t('rules.deleteRuleTitle')}</h3>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            {t('rules.deleteRuleQuestion')}
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 mt-4"
          style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-tertiary)' }}>
          <button onClick={onCancel} disabled={deleting}
            className="inline-flex items-center justify-center px-5 py-2.5 font-medium text-sm rounded-xl border transition-all duration-150 disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}>
            {t('common.cancel')}
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="inline-flex items-center justify-center px-5 py-2.5 gap-2 bg-red-600 text-white font-medium text-sm rounded-xl
              hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">
            {deleting ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('builder.deleting')}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                {t('common.delete')}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────
export const ConditionalRuleBuilder = ({ formId, formFields, ruleService, toast, onRulesUpdate }) => {
  const { t } = useTranslation();
  const builderRef = useRef(null);

  // Refs to break re-render loops
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const onRulesUpdateRef = useRef(onRulesUpdate);
  onRulesUpdateRef.current = onRulesUpdate;
  // Data state
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Rule form state
  const [triggerFieldId, setTriggerFieldId] = useState('');
  const [operator, setOperator] = useState('');
  const [compareValue, setCompareValue] = useState('');
  const [targetFieldId, setTargetFieldId] = useState('');
  const [action, setAction] = useState('');
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Edit mode state
  const [editingRule, setEditingRule] = useState(null);

  // Delete state
  const [deleteRuleId, setDeleteRuleId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Toggle state
  const [togglingIds, setTogglingIds] = useState(new Set());

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOperator, setFilterOperator] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // ─── Fetch Rules ──────────────────────────────────
  const fetchRules = useCallback(async (skipLoading) => {
    if (!formId) return;
    try {
      if (!skipLoading) setLoading(true);
      setLoadError(null);
      const data = await ruleService.listRules(formId);
      const newRules = data.rules || [];
      setRules(newRules);
      onRulesUpdateRef.current?.(newRules);
    } catch (err) {
      setLoadError(t('rules.loadFailed'));
      toastRef.current?.toastError?.(t('common.networkError'), t('rules.loadFailed'));
    } finally {
      if (!skipLoading) setLoading(false);
    }
  }, [formId]);

  // Fetch on mount and when formId changes
  useEffect(() => {
    if (formId) fetchRules();
  }, [fetchRules]);

  // ─── Derived State ────────────────────────────────
  const availableTargetFields = formFields.filter(
    (f) => f.id !== (editingRule?.trigger_field_id || parseInt(triggerFieldId))
  );
  const needsCompareValue = !['is_empty', 'is_not_empty'].includes(operator);
  const needsCompareValueEdit = (op) => !['is_empty', 'is_not_empty'].includes(op);

  const getFieldName = (id) => {
    const field = formFields.find((f) => f.id === id);
    return field ? field.label : `Field #${id}`;
  };

  const getOperatorLabel = (op) => t(`rules.operators.${op}`, { defaultValue: op });
  const getActionLabel = (a) => t(`rules.actions.${a}`, { defaultValue: a });

  // ─── Filtered & Sorted Rules ──────────────────────
  const filteredRules = useMemo(() => {
    let result = [...rules];

    // Search by field name or value
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => {
        const triggerName = getFieldName(r.trigger_field_id).toLowerCase();
        const targetName = getFieldName(r.target_field_id).toLowerCase();
        const operatorLabel = getOperatorLabel(r.operator).toLowerCase();
        const actionLabel = getActionLabel(r.action).toLowerCase();
        const compareVal = (r.compare_value || '').toLowerCase();
        return (
          triggerName.includes(q) ||
          targetName.includes(q) ||
          operatorLabel.includes(q) ||
          actionLabel.includes(q) ||
          compareVal.includes(q)
        );
      });
    }

    // Filter by operator
    if (filterOperator) {
      result = result.filter((r) => r.operator === filterOperator);
    }

    // Filter by action
    if (filterAction) {
      result = result.filter((r) => r.action === filterAction);
    }

    // Filter by status
    if (filterStatus === 'active') {
      result = result.filter((r) => r.is_active);
    } else if (filterStatus === 'inactive') {
      result = result.filter((r) => !r.is_active);
    }

    return result;
  }, [rules, searchQuery, filterOperator, filterAction, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredRules.length / RULES_PER_PAGE));
  const paginatedRules = filteredRules.slice(
    (currentPage - 1) * RULES_PER_PAGE,
    currentPage * RULES_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, filterOperator, filterAction, filterStatus]);

  const isSaveDisabled = () => {
    if (!triggerFieldId || !operator || !targetFieldId || !action) return true;
    if (needsCompareValue && !compareValue.trim()) return true;
    if (triggerFieldId && targetFieldId && String(triggerFieldId) === String(targetFieldId)) return true;
    return false;
  };

  // ─── Reset Form ───────────────────────────────────
  const resetForm = () => {
    setTriggerFieldId('');
    setOperator('');
    setCompareValue('');
    setTargetFieldId('');
    setAction('');
    setValidationError('');
    setEditingRule(null);
  };

  // ─── Create Rule ──────────────────────────────────
  const handleSaveRule = async () => {
    if (!triggerFieldId || !operator || !targetFieldId || !action) {
      setValidationError(t('rules.allFieldsRequired'));
      toast?.toastError?.(t('rules.validationFailed'), t('rules.fillRequiredFields'));
      return;
    }
    if (needsCompareValue && !compareValue.trim()) {
      setValidationError(t('rules.compareValueRequiredOp'));
      toast?.toastError?.(t('rules.validationFailed'), t('rules.compareValueRequiredOp'));
      return;
    }
    if (String(triggerFieldId) === String(targetFieldId)) {
      setValidationError(t('rules.sameFieldError'));
      toast?.toastError?.(t('rules.validationFailed'), t('rules.sameFieldError'));
      return;
    }

    try {
      setSaving(true);
      setValidationError('');
      await ruleService.createRule(formId, {
        trigger_field_id: parseInt(triggerFieldId),
        operator,
        compare_value: needsCompareValue ? compareValue.trim() : null,
        target_field_id: parseInt(targetFieldId),
        action,
      });
      toastRef.current?.success?.(t('rules.ruleCreated'), t('rules.ruleCreatedMsg'));
      resetForm();
      await fetchRules(true);
    } catch (err) {
      const detail = err.response?.data?.detail || t('common.somethingWentWrong');
      setValidationError(detail);
      toast?.toastError?.(t('rules.error'), detail);
    } finally {
      setSaving(false);
    }
  };

  // ─── Update Rule ──────────────────────────────────
  const handleUpdateRule = async () => {
    if (!editingRule) return;
    const editOp = operator || editingRule.operator;
    const editNeedsValue = needsCompareValueEdit(editOp);

    if (!triggerFieldId || !editOp || !targetFieldId || !action) {
      setValidationError(t('rules.allFieldsRequired'));
      return;
    }
    if (editNeedsValue && !compareValue.trim()) {
      setValidationError(t('rules.compareValueRequired'));
      return;
    }

    try {
      setSaving(true);
      setValidationError('');
      await ruleService.updateRule(formId, editingRule.id, {
        trigger_field_id: parseInt(triggerFieldId),
        operator: editOp,
        compare_value: editNeedsValue ? compareValue.trim() : null,
        target_field_id: parseInt(targetFieldId),
        action,
      });
      toastRef.current?.success?.(t('rules.ruleUpdated'), t('rules.ruleUpdatedMsg'));
      resetForm();
      await fetchRules(true);
    } catch (err) {
      const detail = err.response?.data?.detail || t('rules.updateFailed');
      setValidationError(detail);
      toast?.toastError?.(t('rules.error'), detail);
    } finally {
      setSaving(false);
    }
  };

  // ─── Start Edit ────────────────────────────────────
  const handleStartEdit = (rule) => {
    setEditingRule(rule);
    setTriggerFieldId(String(rule.trigger_field_id));
    setOperator(rule.operator);
    setCompareValue(rule.compare_value || '');
    setTargetFieldId(String(rule.target_field_id));
    setAction(rule.action);
    setValidationError('');
    builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // ─── Delete Rule ──────────────────────────────────
  const handleDeleteRule = async () => {
    if (deleteRuleId === null) return;
    try {
      setDeleting(true);
      await ruleService.deleteRule(formId, deleteRuleId);
      toast?.success?.(t('rules.ruleDeleted'), t('rules.ruleDeletedMsg'));
      const updatedRules = rules.filter((r) => r.id !== deleteRuleId);
      setRules(updatedRules);
      onRulesUpdateRef.current?.(updatedRules);
      setDeleteRuleId(null);
    } catch (err) {
      toastRef.current?.toastError?.(t('rules.error'), err.response?.data?.detail || t('rules.deleteFailed'));
      fetchRules(true);
    } finally {
      setDeleting(false);
    }
  };

  // ─── Toggle Rule ──────────────────────────────────
  const handleToggleRule = async (ruleId) => {
    setTogglingIds((prev) => new Set(prev).add(ruleId));
    try {
      const updated = await ruleService.toggleRule(formId, ruleId);
      const newRules = rules.map((r) => (r.id === ruleId ? { ...r, ...updated } : r));
      setRules(newRules);
      onRulesUpdateRef.current?.(newRules);
      toastRef.current?.success?.(
        updated.is_active ? t('rules.ruleEnabled') : t('rules.ruleDisabled'),
        t('rules.toggledMsg', { state: updated.is_active ? t('rules.enabled') : t('rules.disabled') })
      );
    } catch (err) {
      toast?.toastError?.(t('rules.error'), t('rules.toggleFailed'));
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(ruleId);
        return next;
      });
    }
  };

  // ─── Scroll to Builder ────────────────────────────
  const scrollToBuilder = () => {
    builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // ─── Cancel Edit ───────────────────────────────────
  const handleCancelEdit = () => {
    resetForm();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="card-surface rounded-2xl overflow-hidden mt-6"
    >
      {/* ── Header ───────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--color-purple-light)' }}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-purple)' }}>
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                {t('rules.title')}
              </h2>
              {rules.length > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: 'var(--color-purple-light)', color: 'var(--color-purple)' }}>
                  {rules.length}
                </span>
              )}
            </div>
            <p className="text-sm ml-11" style={{ color: 'var(--color-text-tertiary)' }}>
              {t('rules.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Divider ──────────────────────────────────── */}
      <div style={{ borderTop: '1px solid var(--color-border)' }} />

      {/* ── New / Edit Rule Builder ──────────────────── */}
      <div className="px-6 pt-5 pb-2" ref={builderRef}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: editingRule ? 'var(--color-amber-light, #fef3c7)' : 'var(--color-bg-tertiary)' }}>
            {editingRule ? (
              <svg className="w-3.5 h-3.5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ color: 'var(--color-text-tertiary)' }}>
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )}
          </div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            {editingRule ? t('rules.editRule') : t('rules.newRule')}
          </h3>
          {editingRule && (
            <button onClick={handleCancelEdit}
              className="ml-auto inline-flex items-center gap-1 text-xs font-medium rounded-lg px-2.5 py-1
                border transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: 'var(--color-text-tertiary)', borderColor: 'var(--color-border)' }}>
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              {t('common.cancel')}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Row 1: Trigger Field | Operator */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--color-text-tertiary)' }}>{t('rules.triggerField')}</label>
            <RuleSelect
              value={triggerFieldId}
              onChange={(v) => { setTriggerFieldId(v); setValidationError(''); }}
              placeholder={t('rules.selectTrigger')}
              options={formFields.map((f) => ({ value: String(f.id), label: f.label }))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--color-text-tertiary)' }}>{t('rules.operator')}</label>
            <RuleSelect
              value={operator}
              onChange={(v) => { setOperator(v); setValidationError(''); }}
              placeholder={t('rules.selectOperator')}
              options={OPERATORS.map((o) => ({ value: o.value, label: getOperatorLabel(o.value) }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Row 2: Compare Value | Target Field */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--color-text-tertiary)' }}>{t('rules.compareValue')}</label>
            {needsCompareValue ? (
              <input
                type="text"
                value={compareValue}
                onChange={(e) => { setCompareValue(e.target.value); setValidationError(''); }}
                placeholder={t('rules.enterValue')}
                disabled={!operator}
                className="w-full min-h-[46px] px-4 text-sm rounded-xl transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400
                  disabled:opacity-50 disabled:cursor-not-allowed hover:border-indigo-300"
                style={{
                  backgroundColor: 'var(--color-input-bg)',
                  border: '1px solid var(--color-input-border)',
                  color: 'var(--color-text-primary)',
                }}
              />
            ) : (
              <div className="w-full min-h-[46px] px-4 flex items-center text-sm rounded-xl border"
                style={{
                  backgroundColor: 'var(--color-input-bg)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-tertiary)',
                }}>
                {operator ? t('rules.notRequiredOp') : t('rules.selectOperatorFirst')}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--color-text-tertiary)' }}>{t('rules.targetField')}</label>
            <RuleSelect
              value={targetFieldId}
              onChange={(v) => { setTargetFieldId(v); setValidationError(''); }}
              placeholder={t('rules.selectTarget')}
              disabled={!triggerFieldId}
              options={availableTargetFields.map((f) => ({ value: String(f.id), label: f.label }))}
            />
            {triggerFieldId && availableTargetFields.length === 0 && (
              <p className="text-xs mt-1 text-red-500">{t('rules.noOtherFields')}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Row 3: Action | Save Button */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--color-text-tertiary)' }}>{t('rules.action')}</label>
            <RuleSelect
              value={action}
              onChange={(v) => { setAction(v); setValidationError(''); }}
              placeholder={t('rules.selectAction')}
              options={ACTIONS.map((a) => ({ value: a.value, label: getActionLabel(a.value) }))}
            />
          </div>
          <div className="flex flex-col justify-end">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 opacity-0 select-none">&nbsp;</label>
            <button
              onClick={editingRule ? handleUpdateRule : handleSaveRule}
              disabled={(editingRule ? false : isSaveDisabled()) || saving}
              className="inline-flex items-center justify-center gap-2.5 h-12 w-full
                bg-gradient-to-r from-indigo-600 to-indigo-500
                hover:from-indigo-700 hover:to-indigo-600
                active:scale-[0.98] text-white font-semibold text-sm rounded-xl
                shadow-lg shadow-indigo-500/20
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
                disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                transition-all duration-200 whitespace-nowrap"
            >
              {saving ? (
                <>
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {editingRule ? t('rules.updating') : t('builder.saving')}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {editingRule ? (
                      <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>
                    ) : (
                      <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></>
                    )}
                  </svg>
                  {editingRule ? t('rules.updateRule') : t('rules.saveRule')}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Validation Error */}
        <AnimatePresence>
          {validationError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-start gap-2.5 mt-4 p-3.5 rounded-xl"
              style={{ backgroundColor: 'var(--color-error-light)' }}
            >
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">{validationError}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Divider ──────────────────────────────────── */}
      <div className="mt-5" style={{ borderTop: '1px solid var(--color-border)' }} />

      {/* ── Existing Rules ────────────────────────────── */}
      <div className="px-6 pt-5 pb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            {t('rules.existingRules')}
            {filteredRules.length > 0 && (
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-text-tertiary)' }}>
                {t('rules.countOf', { shown: filteredRules.length, total: rules.length })}
              </span>
            )}
          </h3>

          {/* Search & Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: 'var(--color-text-tertiary)' }}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('rules.searchRules')}
                className="w-[160px] md:w-[200px] pl-9 pr-3 py-2 text-xs rounded-xl border transition-all duration-150
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                style={{
                  backgroundColor: 'var(--color-input-bg)',
                  borderColor: 'var(--color-input-border)',
                  color: 'var(--color-text-primary)',
                }}
              />
            </div>

            {/* Filter Operator */}
            <select
              value={filterOperator}
              onChange={(e) => setFilterOperator(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border appearance-none cursor-pointer transition-all
                focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              style={{
                backgroundColor: 'var(--color-input-bg)',
                borderColor: 'var(--color-input-border)',
                color: filterOperator ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              }}
            >
              <option value="">{t('rules.allOperators')}</option>
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>{getOperatorLabel(op.value)}</option>
              ))}
            </select>

            {/* Filter Action */}
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border appearance-none cursor-pointer transition-all
                focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              style={{
                backgroundColor: 'var(--color-input-bg)',
                borderColor: 'var(--color-input-border)',
                color: filterAction ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              }}
            >
              <option value="">{t('rules.allActions')}</option>
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>{getActionLabel(a.value)}</option>
              ))}
            </select>

            {/* Filter Status */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border appearance-none cursor-pointer transition-all
                focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              style={{
                backgroundColor: 'var(--color-input-bg)',
                borderColor: 'var(--color-input-border)',
                color: filterStatus ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              }}
            >
              <option value="">{t('rules.allStatus')}</option>
              <option value="active">{t('rules.active')}</option>
              <option value="inactive">{t('rules.inactive')}</option>
            </select>
          </div>
        </div>

        {/* Delete Confirmation */}
        <AnimatePresence>
          {deleteRuleId !== null && (
            <DeleteRuleModal
              onConfirm={handleDeleteRule}
              onCancel={() => setDeleteRuleId(null)}
              deleting={deleting}
            />
          )}
        </AnimatePresence>

        {/* Content */}
        {loading ? (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                borderBottom: i < 3 ? '1px solid var(--color-border)' : 'none',
                backgroundColor: i % 2 === 0 ? 'var(--color-card-bg)' : 'var(--color-bg-tertiary)',
              }}>
                <SkeletonRow />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-error-light)' }}>
              <svg className="w-7 h-7 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>{t('rules.loadFailedTitle')}</h3>
            <button onClick={fetchRules}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl border transition-all hover:scale-105 active:scale-95"
              style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-info)', borderColor: 'var(--color-border)' }}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              {t('common.retry')}
            </button>
          </motion.div>
        ) : filteredRules.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"
                style={{ color: 'var(--color-text-tertiary)' }}>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <h3 className="text-base font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              {searchQuery || filterOperator || filterAction || filterStatus
                ? t('rules.noMatching')
                : t('rules.noRulesYet')}
            </h3>
            <p className="text-sm mb-5 max-w-xs mx-auto" style={{ color: 'var(--color-text-tertiary)' }}>
              {searchQuery || filterOperator || filterAction || filterStatus
                ? t('rules.noMatchingDesc')
                : t('rules.noRulesYetDesc')}
            </p>
            <button onClick={scrollToBuilder}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500
                text-white font-medium text-sm rounded-xl hover:from-indigo-700 hover:to-indigo-600
                active:scale-[0.98] shadow-lg shadow-indigo-500/20 transition-all duration-200">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t('rules.createRule')}
            </button>
          </motion.div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
              <table className="w-full text-sm table-fixed" style={{ minWidth: 700 }}>
                <colgroup>
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                </colgroup>
                <thead>
                  <tr style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider truncate"
                      style={{ color: 'var(--color-text-tertiary)' }}>{t('rules.triggerField')}</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider truncate"
                      style={{ color: 'var(--color-text-tertiary)' }}>{t('rules.condition')}</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider truncate"
                      style={{ color: 'var(--color-text-tertiary)' }}>{t('rules.value')}</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider truncate"
                      style={{ color: 'var(--color-text-tertiary)' }}>{t('rules.targetField')}</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider truncate"
                      style={{ color: 'var(--color-text-tertiary)' }}>{t('rules.action')}</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider truncate"
                      style={{ color: 'var(--color-text-tertiary)' }}>{t('rules.status')}</th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider truncate"
                      style={{ color: 'var(--color-text-tertiary)' }}>{t('rules.operations')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRules.map((rule, idx) => (
                    <tr
                      key={rule.id}
                      className="transition-colors duration-150"
                      style={{
                        backgroundColor: idx % 2 === 0 ? 'var(--color-card-bg)' : 'var(--color-bg-tertiary)',
                      }}
                    >
                      <td className="px-4 py-3 font-medium text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {getFieldName(rule.trigger_field_id)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${operatorBadgeColors[rule.operator] || ''} truncate max-w-full`}>
                          {getOperatorLabel(rule.operator)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm truncate" style={{ color: 'var(--color-text-secondary)' }}>
                        {rule.compare_value || <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
                      </td>
                      <td className="px-4 py-3 font-medium text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {getFieldName(rule.target_field_id)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${actionBadgeColors[rule.action] || ''} truncate max-w-full`}>
                          {getActionLabel(rule.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleRule(rule.id)}
                          disabled={togglingIds.has(rule.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-150
                            disabled:opacity-50 disabled:cursor-wait truncate max-w-full
                            ${rule.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
                              : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/30'
                            }`}
                          title={rule.is_active ? t('rules.deactivate') : t('rules.activate')}
                        >
                          {togglingIds.has(rule.id) ? (
                            <svg className="w-3 h-3 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 inline-block ${rule.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                          )}
                          <span className="truncate">{rule.is_active ? t('rules.active') : t('rules.inactive')}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleStartEdit(rule)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150
                              text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 flex-shrink-0"
                            title={t('rules.edit')}
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteRuleId(rule.id)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150
                              text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 flex-shrink-0"
                            title={t('rules.delete')}
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {paginatedRules.map((rule, idx) => (
                <div
                  key={rule.id}
                  className="rounded-xl border p-4 transition-all duration-150"
                  style={{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-tertiary)' }}>
                      {t('rules.ruleN', { n: rules.length - idx - (currentPage - 1) * RULES_PER_PAGE })}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleRule(rule.id)}
                        disabled={togglingIds.has(rule.id)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all
                          ${rule.is_active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-500/10 dark:text-gray-400'
                          }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full inline-block ${rule.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {rule.is_active ? t('rules.active') : t('rules.inactive')}
                      </button>
                      <button
                        onClick={() => handleStartEdit(rule)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-all text-gray-400 hover:text-indigo-500 hover:bg-indigo-50"
                        title={t('rules.edit')}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button onClick={() => setDeleteRuleId(rule.id)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-all text-gray-400 hover:text-red-500 hover:bg-red-50"
                        title={t('rules.delete')}>
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>{t('rules.if')}</span>
                      <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{getFieldName(rule.trigger_field_id)}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${operatorBadgeColors[rule.operator] || ''}`}>
                        {getOperatorLabel(rule.operator)}
                      </span>
                      {rule.compare_value && (
                        <span className="font-mono text-xs px-2 py-0.5 rounded"
                          style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                          "{rule.compare_value}"
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>{t('rules.then')}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${actionBadgeColors[rule.action] || ''}`}>
                        {getActionLabel(rule.action)}
                      </span>
                      <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{getFieldName(rule.target_field_id)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4"
                style={{ borderTop: '1px solid var(--color-border)' }}>
                <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('rules.showingRange', {
                    from: (currentPage - 1) * RULES_PER_PAGE + 1,
                    to: Math.min(currentPage * RULES_PER_PAGE, filteredRules.length),
                    total: filteredRules.length,
                  })}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-medium border transition-all
                      disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-medium border transition-all
                        ${page === currentPage
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      style={page !== currentPage ? { borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' } : {}}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-medium border transition-all
                      disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};
