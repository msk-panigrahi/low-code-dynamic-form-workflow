import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

// ─── Constants ───────────────────────────────────────────────────────
// Visual treatment for every supported action. Unknown actions fall back
// to a neutral slate style so the visualizer never breaks on new actions.
const ACTION_CONFIG = {
  show: {
    labelKey: 'show',
    bg: 'bg-emerald-50 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-300 dark:border-emerald-500/40',
    dot: '#10b981',
  },
  hide: {
    labelKey: 'hide',
    bg: 'bg-red-50 dark:bg-red-500/15',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-300 dark:border-red-500/40',
    dot: '#ef4444',
  },
  require: {
    labelKey: 'require',
    bg: 'bg-amber-50 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-500/40',
    dot: '#f59e0b',
  },
  optional: {
    labelKey: 'optional',
    bg: 'bg-gray-50 dark:bg-gray-500/15',
    text: 'text-gray-600 dark:text-gray-300',
    border: 'border-gray-300 dark:border-gray-500/40',
    dot: '#6b7280',
  },
  disable: {
    labelKey: 'disable',
    bg: 'bg-gray-50 dark:bg-gray-500/15',
    text: 'text-gray-600 dark:text-gray-300',
    border: 'border-gray-300 dark:border-gray-500/40',
    dot: '#6b7280',
  },
  enable: {
    labelKey: 'enable',
    bg: 'bg-sky-50 dark:bg-sky-500/15',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-300 dark:border-sky-500/40',
    dot: '#0ea5e9',
  },
};

const FALLBACK_ACTION = {
  labelKey: 'apply',
  bg: 'bg-gray-50 dark:bg-gray-500/15',
  text: 'text-gray-600 dark:text-gray-300',
  border: 'border-gray-300 dark:border-gray-500/40',
  dot: '#6b7280',
};

const OPERATOR_KEYS = {
  equals: 'equals',
  not_equals: 'not_equals',
  contains: 'contains',
  greater_than: 'greater_than',
  less_than: 'less_than',
  greater_or_equal: 'greater_or_equal',
  less_or_equal: 'less_or_equal',
  starts_with: 'starts_with',
  ends_with: 'ends_with',
  is_empty: 'is_empty',
  is_not_empty: 'is_not_empty',
};

// ─── Small inline SVG icons ─────────────────────────────────────────
const TriggerIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const ActionIcon = ({ action, className }) => {
  if (action === 'show') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  if (action === 'hide') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  if (action === 'require') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
};

const ArrowIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

// ─── Single rule branch: condition → action → target ────────────────
const RuleBranch = ({ rule, conditionLabel, targetFieldName, index }) => {
  const { t } = useTranslation();
  const actionCfg = ACTION_CONFIG[rule.action] || FALLBACK_ACTION;
  const actionLabel = t(`visualizer.actions.${actionCfg.labelKey}`);

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      {/* Branch connector (centered, aligned with the trigger stem) */}
      <div className="flex justify-center">
        <div className="w-0.5 h-3 rounded-full" style={{ backgroundColor: 'var(--color-border)' }} />
      </div>

      {/* Condition → Action + Target (centered, wraps on narrow widths) */}
      <div className="flex flex-wrap items-center justify-center gap-2 py-1">
        {/* Condition */}
        <div className="inline-flex items-center px-3 py-1.5 rounded-lg border-2 bg-white dark:bg-gray-800
          border-purple-200 dark:border-purple-700 shadow-sm max-w-full">
          <span className="text-[11px] font-bold text-purple-600 dark:text-purple-300 truncate min-w-0">
            {conditionLabel}
          </span>
        </div>

        {/* Arrow */}
        <ArrowIcon className="w-4 h-4 flex-shrink-0" />

        {/* Action + Target */}
        <div className={`inline-flex items-center gap-2 pl-1 pr-3 py-1.5 rounded-lg border-2 shadow-sm
          ${actionCfg.bg} ${actionCfg.text} ${actionCfg.border} max-w-full`}>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap">
            <ActionIcon action={rule.action} className="w-3 h-3" />
            {actionLabel}
          </span>
          <span className="w-1 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: actionCfg.dot }} />
          <span className="text-xs font-semibold truncate min-w-0">{targetFieldName}</span>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Trigger group: one trigger field + its rule branches ───────────
const TriggerGroup = ({ group, getFieldName, getConditionLabel }) => {
  const { t } = useTranslation();
  return (
    <div className="pb-1">
      {/* Trigger field card */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-xl border-2
          bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-700 shadow-sm w-full max-w-[280px]">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--color-info-light)' }}>
            <TriggerIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: 'var(--color-info)' }}>
              {t('visualizer.triggerField')}
            </p>
            <p className="text-xs font-semibold truncate"
              style={{ color: 'var(--color-text-primary)' }}>
              {getFieldName(group.triggerFieldId)}
            </p>
          </div>
        </div>
      </div>

      {/* Vertical stem leading into the branches */}
      <div className="flex justify-center">
        <div className="w-0.5 h-3 rounded-full" style={{ backgroundColor: 'var(--color-border)' }} />
      </div>

      {/* Branches — each centered under the stem so connectors always align */}
      <div className="space-y-1">
        {group.rules.map((rule, idx) => (
          <RuleBranch
            key={rule.id}
            rule={rule}
            conditionLabel={getConditionLabel(rule)}
            targetFieldName={getFieldName(rule.target_field_id)}
            index={idx}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Legend ──────────────────────────────────────────────────────────
const Legend = () => {
  const { t } = useTranslation();
  const items = [
    { label: t('visualizer.triggerField'), swatch: 'var(--color-info)', border: 'border-blue-300 dark:border-blue-700' },
    { label: t('visualizer.condition'), swatch: 'var(--color-purple)', border: 'border-purple-300 dark:border-purple-700' },
    { label: t('visualizer.actions.show'), swatch: '#10b981', border: 'border-emerald-300 dark:border-emerald-500/40' },
    { label: t('visualizer.actions.hide'), swatch: '#ef4444', border: 'border-red-300 dark:border-red-500/40' },
    { label: t('visualizer.actions.require'), swatch: '#f59e0b', border: 'border-amber-300 dark:border-amber-500/40' },
    { label: t('visualizer.flow'), swatch: 'var(--color-text-tertiary)', border: 'border-gray-300 dark:border-gray-600' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 border-t"
      style={{ borderColor: 'var(--color-border)' }}>
      <span className="text-[10px] font-bold uppercase tracking-wider"
        style={{ color: 'var(--color-text-tertiary)' }}>
        {t('visualizer.legend')}
      </span>
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 text-[11px] font-medium"
          style={{ color: 'var(--color-text-secondary)' }}>
          <span className={`w-2.5 h-2.5 rounded-full border ${item.border}`}
            style={{ backgroundColor: item.swatch }} />
          {item.label}
        </span>
      ))}
    </div>
  );
};

// ─── Empty state ─────────────────────────────────────────────────────
// Two flavours: no rules at all (encourage the builder) vs all rules
// disabled (tell the owner to re-enable one).
const EmptyState = ({ allDisabled = false }) => {
  const { t } = useTranslation();
  return (
    <div className="text-center py-10 px-4">
      <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-tertiary)' }}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          <line x1="9" y1="11" x2="15" y2="11" />
        </svg>
      </div>
      {allDisabled ? (
        <>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            {t('visualizer.emptyAllDisabled')}
          </p>
          <p className="text-xs max-w-[280px] mx-auto leading-relaxed"
            style={{ color: 'var(--color-text-tertiary)' }}>
            {t('visualizer.emptyAllDisabledDesc')}
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            {t('visualizer.emptyNoRules')}
          </p>
          <p className="text-xs max-w-[280px] mx-auto leading-relaxed"
            style={{ color: 'var(--color-text-tertiary)' }}>
            {t('visualizer.emptyNoRulesDesc')}
          </p>
        </>
      )}
    </div>
  );
};

// ─── Rule Flow Visualization ─────────────────────────────────────────
export const RuleFlowVisualization = ({ rules = [], formFields = [] }) => {
  const { t } = useTranslation();

  const getFieldName = (id) => {
    const field = formFields.find((f) => f.id === id);
    return field ? field.label : `Field #${id}`;
  };

  // Condition text, e.g. equals "Friend / Referral" / greater than 18
  const getConditionLabel = (rule) => {
    const opKey = OPERATOR_KEYS[rule.operator] || null;
    const opLabel = opKey ? t(`rules.operators.${opKey}`) : rule.operator;
    const value = rule.compare_value;
    if (value != null && value !== '') {
      const isNumeric = !Number.isNaN(Number(value));
      return isNumeric ? `${opLabel} ${value}` : `${opLabel} "${value}"`;
    }
    return opLabel;
  };

  // Group active rules by trigger field (multiple rules per trigger
  // become branches under one trigger card).
  const { groups, activeCount, inactiveCount } = useMemo(() => {
    const active = rules.filter((r) => r.is_active);
    const groupMap = new Map();
    const ordered = [];
    for (const rule of active) {
      if (!groupMap.has(rule.trigger_field_id)) {
        const group = { triggerFieldId: rule.trigger_field_id, rules: [] };
        groupMap.set(rule.trigger_field_id, group);
        ordered.push(group);
      }
      groupMap.get(rule.trigger_field_id).rules.push(rule);
    }
    return {
      groups: ordered,
      activeCount: active.length,
      inactiveCount: rules.length - active.length,
    };
  }, [rules]);

  return (
    <div className="card-surface rounded-2xl overflow-hidden w-full">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-2"
        style={{ borderColor: 'var(--color-border)' }}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
          <TriggerIcon className="w-3.5 h-3.5" />
        </div>
        <h3 className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          {t('visualizer.title')}
        </h3>
        {activeCount > 0 && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ml-auto"
            style={{ backgroundColor: 'var(--color-purple-light)', color: 'var(--color-purple)' }}>
            {activeCount}
          </span>
        )}
        {inactiveCount > 0 && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
            style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
            {t('visualizer.disabledCount', { count: inactiveCount })}
          </span>
        )}
      </div>

      {/* Content — scrollable when many rules exist */}
      <div className="px-3 py-4 max-h-[560px] overflow-y-auto">
        {activeCount === 0 ? (
          <EmptyState allDisabled={inactiveCount > 0} />
        ) : (
          <div className="space-y-6">
            <AnimatePresence>
              {groups.map((group, groupIdx) => (
                <motion.div
                  key={group.triggerFieldId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: groupIdx * 0.06 }}
                >
                  <TriggerGroup
                    group={group}
                    getFieldName={getFieldName}
                    getConditionLabel={getConditionLabel}
                  />
                  {groupIdx < groups.length - 1 && (
                    <div className="border-b border-dashed mt-6" style={{ borderColor: 'var(--color-border)' }} />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Legend — only meaningful when there are flows to read */}
      {activeCount > 0 && <Legend />}
    </div>
  );
};
