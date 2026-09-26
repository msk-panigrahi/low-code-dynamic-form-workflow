import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { fieldTypeService, formService, ruleService } from '../services';
import { FieldPalette } from '../components/FieldPalette';
import { PropertyPanel } from '../components/PropertyPanel';
import { FormAnalytics } from '../components/FormAnalytics';
import { useToast } from '../components/Toast';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { FormPreview } from '../components/FormPreview';
import { PublishModal } from '../components/PublishModal';
import { ArchiveModal } from '../components/ArchiveModal';
import { ShareLinkModal } from '../components/ShareLinkModal';
import { VersionHistoryPanel } from '../components/VersionHistoryPanel';
import { WorkflowCard } from '../components/WorkflowCard';
import { ConditionalRuleBuilder } from '../components/ConditionalRuleBuilder';
import { RuleFlowVisualization } from '../components/RuleFlowVisualization';
import { useDarkMode } from '../hooks/useDarkMode';

// ─── Field Icons Lookup ──────────────────────────────────────────────
const fieldIcons = {
  text: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  ),
  number: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  ),
  email: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  dropdown: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 10l4 4 4-4" /><rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
    </svg>
  ),
  checkbox: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" /><polyline points="9 12 11 14 15 10" />
    </svg>
  ),
  date: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  file: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="15" x2="12" y2="21" /><line x1="9" y1="18" x2="15" y2="18" />
    </svg>
  ),
  rating: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
};

const typeColors = {
  text: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30',
  number: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30',
  email: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/30',
  dropdown: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/30',
  checkbox: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30',
  date: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/30',
  file: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30',
  rating: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30',
};

// ─── Friendly Config Summary ─────────────────────────────────────────
function getConfigSummary(type, config, t) {
  if (!config || Object.keys(config).length === 0) return null;
  switch (type) {
    case 'text': {
      const parts = [];
      if (config.placeholder) parts.push(t('builder.placeholderLabel', { value: config.placeholder }));
      if (config.minimumLength != null) parts.push(t('builder.minLengthLabel', { value: config.minimumLength }));
      if (config.maximumLength != null) parts.push(t('builder.maxLengthLabel', { value: config.maximumLength }));
      return parts.length > 0 ? parts : null;
    }
    case 'number': {
      const parts = [];
      if (config.minimum != null) parts.push(t('builder.minimumLabel', { value: config.minimum }));
      if (config.maximum != null) parts.push(t('builder.maximumLabel', { value: config.maximum }));
      return parts.length > 0 ? parts : null;
    }
    case 'email':
      return null;
    case 'dropdown': {
      const opts = config.options || [];
      return opts.length > 0 ? opts.map((o) => o.label).filter(Boolean) : null;
    }
    case 'checkbox': {
      const opts = config.options || [];
      return opts.length > 0 ? [t('builder.optionsCount', { count: opts.length })] : null;
    }
    case 'date': {
      const parts = [];
      if (config.minimumDate) parts.push(t('builder.fromLabel', { value: config.minimumDate }));
      if (config.maximumDate) parts.push(t('builder.toLabel', { value: config.maximumDate }));
      return parts.length > 0 ? parts : null;
    }
    case 'file': {
      const parts = [];
      if (config.allowedTypes?.length) parts.push(t('builder.allowedLabel', { value: config.allowedTypes.join(', ') }));
      if (config.maximumSize) parts.push(t('builder.maxLabel', { value: (config.maximumSize / 1024 / 1024).toFixed(1) }));
      return parts.length > 0 ? parts : null;
    }
    case 'rating':
      return [t('builder.maxStarsLabel', { value: config.maximumStars || 5 })];
    default:
      return null;
  }
}

// ─── Sortable Field Card ──────────────────────────────────────────────
const SortableFieldCard = ({
  field,
  index,
  totalFields,
  onEdit,
  onDelete,
  onDuplicate,
  isRequired,
  configSummary,
  icon,
  colorClass,
  typeId,
  readOnly,
  hasRules,
  isHighlighted,
  onBadgeClick,
}) => {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
    disabled: readOnly,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border transition-all duration-200 ease-out animate-slide-up ${
        isDragging ? 'shadow-xl ring-2 ring-indigo-300 border-indigo-300' : 'card-surface'
      }`}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          {/* Drag Handle */}
          {!readOnly && (
            <div
              {...attributes}
              {...listeners}
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors"
              style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}
              title={t('builder.dragToReorder')}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="16" y2="6" />
                <line x1="8" y1="12" x2="16" y2="12" />
                <line x1="8" y1="18" x2="16" y2="18" />
              </svg>
            </div>
          )}

          {/* # Badge */}
          <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
            #{index + 1}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold truncate max-w-[180px]" style={{ color: 'var(--color-text-primary)' }}>
                {field.label}
              </h3>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${colorClass}`}>
                <span className="flex-shrink-0">{icon}</span>
                {typeId.charAt(0).toUpperCase() + typeId.slice(1)}
              </span>
              {isRequired && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                  style={{ backgroundColor: 'var(--color-error-light)', color: 'var(--color-error)', border: '1px solid var(--color-error)' }}>
                  {t('builder.required')}
                </span>
              )}
              {hasRules && (
                <button
                  onClick={(e) => { e.stopPropagation(); onBadgeClick?.(field.id); }}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border
                    transition-all duration-200 hover:scale-105 active:scale-95
                    ${isHighlighted
                      ? 'bg-purple-200 text-purple-800 border-purple-400 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-400'
                      : 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30'
                    }`}
                  title={isHighlighted ? t('builder.clearHighlight') : t('builder.highlightRules')}
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {t('builder.logic')}
                </button>
              )}
            </div>

            {configSummary && (
              <div className="mt-1.5 space-y-0.5">
                {configSummary.map((line, i) => (
                  <p key={i} className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{line}</p>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex-shrink-0 flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            {readOnly ? (
              <span className="btn-icon cursor-default" title={t('builder.immutable')}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
            ) : (
              <>
                <button
                  onClick={() => onEdit(index)}
              className="btn-icon"
              title={t('builder.editProperties')}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => onDuplicate(field)}
                  className="btn-icon"
                  title={t('builder.duplicate')}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
                <button
                  onClick={() => onDelete(index)}
                  className="btn-icon hover:!text-red-500 hover:!bg-red-50"
                  title={t('builder.delete')}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Segmented Toggle ─────────────────────────────────────────────────
const SegmentedToggle = ({ options, value, onChange }) => {
  const activeIndex = options.findIndex((o) => o.value === value);

  return (
    <div className="relative flex rounded-xl p-0.5 border"
      style={{ backgroundColor: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}>
      {/* Sliding indicator */}
      <div
        className="absolute top-0.5 bottom-0.5 bg-white dark:bg-gray-700 rounded-lg shadow-sm transition-transform duration-200 ease-out"
        style={{
          width: `calc(${100 / options.length}% - 2px)`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className="relative z-10 flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-medium transition-colors duration-150"
          style={{ color: value === option.value ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', width: `${100 / options.length}%` }}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
};

// ─── EmptyFormState ──────────────────────────────────────────────────
const EmptyFormState = ({ fieldTypes, onCreateForm }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t('builder.titleRequired'));
      return;
    }
    try {
      setCreating(true);
      setError(null);
      await onCreateForm(title.trim(), description.trim() || null);
    } catch (err) {
      setError(err.response?.data?.detail || t('builder.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-6">
      <div className="w-full max-w-6xl">
        <div className="max-w-lg mx-auto mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>{t('builder.createTitle')}</h1>
            <p style={{ color: 'var(--color-text-tertiary)' }}>{t('builder.createDesc')}</p>
          </motion.div>

          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onSubmit={handleSubmit}
            className="card-surface p-8 space-y-5"
          >
            <div>
              <label className="input-label">{t('builder.formTitle')} <span className="text-red-400">*</span></label>
              <input type="text" value={title} onChange={(e) => { setTitle(e.target.value); setError(null); }}
                placeholder={t('builder.titlePlaceholder')}
                className="input-field" autoFocus />
            </div>
            <div>
              <label className="input-label">{t('builder.description')}</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder={t('builder.descPlaceholder')}
                rows="3" className="input-field resize-none" />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 p-4 rounded-2xl"
                style={{ backgroundColor: 'var(--color-error-light)' }}
              >
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <p className="text-sm font-medium text-red-600">{error}</p>
              </motion.div>
            )}

            <button type="submit" disabled={creating}
              className="btn-primary w-full gap-2">
              {creating ? (
                <><svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  {t('builder.creating')}</>
              ) : (
                <><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>
                  {t('builder.createButton')}</>
              )}
            </button>
          </motion.form>
        </div>
      </div>
    </div>
  );
};

// ─── Main FormBuilder ────────────────────────────────────────────────
export const FormBuilder = () => {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [fieldTypes, setFieldTypes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { success, error: toastError, info, ToastContainer } = useToast();
  const { isDark, toggle: toggleDark } = useDarkMode();

  // Form state
  const [formId, setFormId] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Canvas state
  const [formFields, setFormFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);

  // Version state
  const [versions, setVersions] = useState([]);
  const [currentVersionId, setCurrentVersionId] = useState(null);
  const [currentVersionStatus, setCurrentVersionStatus] = useState('draft');
  const [currentVersionNumber, setCurrentVersionNumber] = useState(1);

  // View toggle
  const [viewMode, setViewMode] = useState('builder');

  // ─── Selected Field State (for Property Panel) ──────
  const [selectedField, setSelectedField] = useState(null);

  // Saving states
  const [savingField, setSavingField] = useState(false);

  // Delete modal state
  const [deleteFieldIndex, setDeleteFieldIndex] = useState(null);
  const [deletingField, setDeletingField] = useState(false);

  // Publish modal state
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Archive modal state
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Share Link modal state
  const [showShareLinkModal, setShowShareLinkModal] = useState(false);
  const [shareLinkData, setShareLinkData] = useState(null);
  const [generatingLink, setGeneratingLink] = useState(false);

  // Rules state (from ConditionalRuleBuilder)
  const [rules, setRules] = useState([]);
  const [highlightedFieldId, setHighlightedFieldId] = useState(null);

  const handleRulesUpdate = useCallback((updatedRules) => {
    setRules(updatedRules);
  }, []);

  const handleBadgeClick = useCallback((fieldId) => {
    setHighlightedFieldId((prev) => (prev === fieldId ? null : fieldId));
  }, []);

  // Compute which fields have rules
  const fieldsWithRules = useMemo(() => {
    const fieldIds = new Set();
    rules.forEach((r) => {
      if (r.trigger_field_id) fieldIds.add(r.trigger_field_id);
      if (r.target_field_id) fieldIds.add(r.target_field_id);
    });
    return fieldIds;
  }, [rules]);

  // Mobile properties panel toggle
  const [showMobileProperties, setShowMobileProperties] = useState(false);

  // Read-only mode for published/archived
  const isReadOnly = currentVersionStatus === 'published' || currentVersionStatus === 'archived';

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Fetch field types on mount & check URL for formId
  useEffect(() => {
    const fetchFieldTypes = async () => {
      try {
        setLoading(true);
        const data = await fieldTypeService.getFieldTypes();
        setFieldTypes(data.fieldTypes);
        setError(null);
      } catch (err) {
        setError(t('builder.loadFieldTypesFailed'));
        setFieldTypes(null);
      } finally {
        setLoading(false);
      }
    };
    fetchFieldTypes();

    const urlFormId = searchParams.get('formId');
    if (urlFormId) {
      setFormId(parseInt(urlFormId));
    }
    // Support deep-linking to the Analytics view (e.g. from the Analytics page)
    const viewParam = searchParams.get('view');
    if (viewParam === 'analytics') {
      setViewMode('analytics');
    }
  }, [searchParams]);

  // Load form data when formId is set
  useEffect(() => {
    if (formId) {
      fetchFormFields(formId);
      fetchVersions(formId);
    }
  }, [formId]);

  // Fetch form fields
  const fetchFormFields = useCallback(async (id) => {
    if (!id) return;
    try {
      setLoadingFields(true);
      const data = await formService.getForm(id);
      setFormFields(data.fields || []);
      setFormTitle(data.title || '');
      setFormDescription(data.description || '');
      setCurrentVersionId(data.version_id);
      setCurrentVersionNumber(data.version_number || 1);
      setCurrentVersionStatus(data.version_status || 'draft');
    } catch (err) {
      console.error('Failed to load form fields:', err);
    } finally {
      setLoadingFields(false);
    }
  }, []);

  // Fetch versions
  const fetchVersions = useCallback(async (id) => {
    if (!id) return;
    try {
      const data = await formService.getVersions(id);
      setVersions(data || []);
    } catch (err) {
      console.error('Failed to load versions:', err);
    }
  }, []);

  // ─── Create form ────────────────────────────────────
  const handleCreateForm = async (title, description) => {
    const result = await formService.createForm(title, description);
    setFormId(result.id);
    setFormTitle(result.title);
    setFormDescription(result.description || '');
    fetchFormFields(result.id);
    fetchVersions(result.id);
    success(t('builder.formCreatedToast'), t('builder.formCreatedMsg', { title: result.title }));
  };

  // ─── Reset to create another form ────────────────────
  const handleCreateAnother = () => {
    setFormId(null);
    setFormTitle('');
    setFormDescription('');
    setFormFields([]);
    setVersions([]);
    setSelectedField(null);
    setDeleteFieldIndex(null);
    setViewMode('builder');
    setShowMobileProperties(false);
    setCurrentVersionId(null);
    setCurrentVersionStatus('draft');
    setCurrentVersionNumber(1);
    setRules([]);
    setHighlightedFieldId(null);
  };

  // ─── Select field type from palette ──────────────────
  const handleFieldTypeClick = (field) => {
    if (isReadOnly) return;
    setSelectedField({
      mode: 'add',
      fieldType: field,
      label: '',
      required: false,
      config: {},
    });
    setShowMobileProperties(true);
  };

  // ─── Open edit in property panel ─────────────────────
  const handleOpenEdit = (index) => {
    if (isReadOnly) return;
    const f = formFields[index];
    const fieldType = getFieldTypeDefinition(f.type || f.field_type);
    if (!fieldType) return;
    setSelectedField({
      mode: 'edit',
      fieldType,
      fieldIndex: index,
      label: f.label,
      required: f.is_required === 1 || f.is_required === true || f.config?.required,
      config: { ...(f.config || {}) },
    });
    setShowMobileProperties(true);
  };

  // ─── Close property panel ────────────────────────────
  const handleCloseProperties = () => {
    setSelectedField(null);
    setShowMobileProperties(false);
  };

  // ─── Save new field ──────────────────────────────────
  const handleSaveField = async () => {
    if (!selectedField?.label?.trim()) { toastError(t('builder.validation'), t('builder.fieldLabelRequired')); return; }
    try {
      setSavingField(true);
      await formService.addField(formId, {
        label: selectedField.label.trim(),
        field_type: selectedField.fieldType.id,
        required: selectedField.required,
        order: formFields.length + 1,
        config: selectedField.config,
      });
      success(t('builder.fieldAddedToast'), t('builder.fieldAddedMsg', { label: selectedField.label }));
      setSelectedField(null);
      setShowMobileProperties(false);
      fetchFormFields(formId);
      fetchVersions(formId);
    } catch (err) {
      toastError(t('common.error'), err.response?.data?.detail || t('builder.saveFailed'));
    } finally {
      setSavingField(false);
    }
  };

  // ─── Save edited field ──────────────────────────────
  const handleSaveEdit = async () => {
    if (!selectedField?.label?.trim()) { toastError(t('builder.validation'), t('builder.fieldLabelRequired')); return; }
    const f = formFields[selectedField.fieldIndex];
    if (!f || !f.id) { toastError(t('common.error'), t('builder.cannotEditNoId')); return; }
    try {
      setSavingField(true);
      await formService.updateField(formId, f.id, {
        label: selectedField.label.trim(),
        required: selectedField.required,
        config: selectedField.config,
      });
      success(t('builder.fieldUpdatedToast'), t('builder.fieldUpdatedMsg', { label: selectedField.label }));
      setSelectedField(null);
      setShowMobileProperties(false);
      fetchFormFields(formId);
      fetchVersions(formId);
    } catch (err) {
      toastError(t('common.error'), err.response?.data?.detail || t('builder.updateFailed'));
    } finally {
      setSavingField(false);
    }
  };

  // ─── Handle Save (routes to add or edit) ────────────
  const handleSave = () => {
    if (selectedField?.mode === 'add') return handleSaveField();
    if (selectedField?.mode === 'edit') return handleSaveEdit();
  };

  // ─── Property field change handlers ──────────────────
  const handlePropertyLabelChange = (label) => {
    setSelectedField((prev) => prev ? { ...prev, label } : prev);
  };
  const handlePropertyRequiredChange = (required) => {
    setSelectedField((prev) => prev ? { ...prev, required } : prev);
  };
  const handlePropertyConfigChange = (name, value) => {
    setSelectedField((prev) => {
      if (!prev) return prev;
      return { ...prev, config: { ...prev.config, [name]: value } };
    });
  };

  // ─── Open delete modal ──────────────────────────────
  const handleOpenDelete = (index) => {
    if (isReadOnly) return;
    setDeleteFieldIndex(index);
  };

  // ─── Confirm delete ─────────────────────────────────
  const handleConfirmDelete = async () => {
    const field = formFields[deleteFieldIndex];
    if (!field || !field.id) {
      setFormFields((prev) => prev.filter((_, i) => i !== deleteFieldIndex));
      success(t('builder.fieldDeletedToast'), t('builder.fieldDeletedNoIdMsg'));
      setDeleteFieldIndex(null);
      return;
    }
    try {
      setDeletingField(true);
      await formService.deleteField(formId, field.id);
      success(t('builder.fieldDeletedToast'), t('builder.fieldDeletedMsg', { label: field.label }));
      setDeleteFieldIndex(null);
      if (selectedField?.mode === 'edit' && selectedField?.fieldIndex === deleteFieldIndex) {
        setSelectedField(null);
        setShowMobileProperties(false);
      }
      fetchFormFields(formId);
      fetchVersions(formId);
    } catch (err) {
      toastError(t('common.error'), err.response?.data?.detail || t('builder.deleteFailed'));
    } finally {
      setDeletingField(false);
    }
  };

  // ─── Duplicate field ────────────────────────────────
  const handleDuplicate = async (field) => {
    if (isReadOnly) return;
    try {
      await formService.addField(formId, {
        label: `${field.label} (Copy)`,
        field_type: field.type || field.field_type,
        required: field.is_required === 1 || field.is_required === true || field.config?.required,
        order: formFields.length + 1,
        config: field.config || {},
      });
      success(t('builder.fieldDuplicatedToast'), t('builder.fieldDuplicatedMsg', { label: field.label }));
      fetchFormFields(formId);
      fetchVersions(formId);
    } catch (err) {
      toastError(t('common.error'), t('builder.duplicateFailed'));
    }
  };

  // ─── Drag end handler ───────────────────────────────
  const handleDragEnd = async (event) => {
    if (isReadOnly) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = formFields.findIndex((f) => f.id === active.id);
    const newIndex = formFields.findIndex((f) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const updated = [...formFields];
    const [moved] = updated.splice(oldIndex, 1);
    updated.splice(newIndex, 0, moved);
    setFormFields(updated);
    try {
      await formService.reorderFields(formId, updated.map((f) => f.id));
      success(t('builder.fieldsReorderedToast'), t('builder.fieldsReorderedMsg'));
    } catch (err) {
      toastError(t('common.error'), t('builder.reorderFailed'));
      fetchFormFields(formId);
    }
  };

  // ─── Generate Shareable Link ────────────────────────
  const handleGenerateLink = async () => {
    try {
      setGeneratingLink(true);
      const result = await formService.generateShareLink(formId);
      setShareLinkData({
        publicUrl: result.public_url,
        linkToken: result.link_token,
        formVersion: result.form_version,
      });
      setShowShareLinkModal(true);
      success(t('builder.linkGeneratedToast'), t('builder.linkGeneratedMsg'));
    } catch (err) {
      const detail = err.response?.data?.detail || t('builder.generateLinkErr');
      toastError(t('builder.generateLinkFailed'), detail);
    } finally {
      setGeneratingLink(false);
    }
  };

  // ─── Publish ─────────────────────────────────────────
  const handlePublish = async () => {
    try {
      setPublishing(true);
      const result = await formService.publishForm(formId);
      success(t('builder.publishedToast'), result.message || t('builder.publishedMsg', { version: result.version_number }));
      setShowPublishModal(false);
      fetchFormFields(formId);
      fetchVersions(formId);
    } catch (err) {
      toastError(t('builder.publishFailedToast'), err.response?.data?.detail || t('builder.publishFailedErr'));
    } finally {
      setPublishing(false);
    }
  };

  // ─── Archive ─────────────────────────────────────────
  const handleArchive = async () => {
    try {
      setArchiving(true);
      const result = await formService.archiveForm(formId);
      success(t('builder.archivedToast'), result.message || t('builder.archivedMsg'));
      setShowArchiveModal(false);
      fetchFormFields(formId);
      fetchVersions(formId);
    } catch (err) {
      toastError(t('builder.archiveFailedToast'), err.response?.data?.detail || t('builder.archiveFailedErr'));
    } finally {
      setArchiving(false);
    }
  };

  // ─── Create Draft Version ────────────────────────────
  const handleCreateDraft = async (versionId) => {
    try {
      const result = await formService.createDraftVersion(formId, versionId);
      info(t('builder.draftCreatedToast'), result.message || t('builder.draftCreatedMsg', { version: result.version_number }));
      fetchFormFields(formId);
      fetchVersions(formId);
    } catch (err) {
      toastError(t('common.error'), err.response?.data?.detail || t('builder.draftCreateErr'));
    }
  };

  // ─── Select version ──────────────────────────────────
  const handleSelectVersion = async (version) => {
    try {
      setLoadingFields(true);
      // Fetch form fields for the selected version
      const data = await formService.getForm(formId);
      // If selected version is not the current version, we need the version-specific fields
      // For now, the backend returns the latest draft/published version
      // We'll reload the form data which auto-selects the best version
      fetchFormFields(formId);
    } catch (err) {
      toastError(t('common.error'), t('builder.loadVersionErr'));
    }
  };

  // ─── Preview version ─────────────────────────────────
  const handlePreviewVersion = (version) => {
    setViewMode('preview');
  };

  // ─── Get field type definition ──────────────────────
  const getFieldTypeDefinition = (typeId) => {
    return fieldTypes?.find((ft) => ft.id === typeId) || null;
  };

  // ─── Loading state ───────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-info)' }} />
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>{t('builder.loadingFieldTypes')}</p>
        </div>
      </div>
    );
  }

  // ─── Error state ─────────────────────────────────────
  if (error && !fieldTypes) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] p-8">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-error-light)' }}>
            <svg className="w-7 h-7 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>{t('builder.connectionError')}</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>{error}</p>
        </div>
      </div>
    );
  }

  // ─── No form created yet ─────────────────────────────
  if (!formId) {
    return (
      <>
        <EmptyFormState fieldTypes={fieldTypes} onCreateForm={handleCreateForm} />
        <ToastContainer />
      </>
    );
  }

  // ─── Delete target label ─────────────────────────────
  const deleteTargetLabel = deleteFieldIndex !== null ? formFields[deleteFieldIndex]?.label || t('builder.thisField') : '';

  return (
    <>
      <ToastContainer />

      {/* Delete Confirm Modal */}
      {deleteFieldIndex !== null && (
        <DeleteConfirmModal
          fieldLabel={deleteTargetLabel}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteFieldIndex(null)}
          deleting={deletingField}
        />
      )}

      {/* Publish Modal */}
      <PublishModal
        isOpen={showPublishModal}
        onConfirm={handlePublish}
        onCancel={() => setShowPublishModal(false)}
        publishing={publishing}
        formTitle={formTitle}
      />

      {/* Archive Modal */}
      <ArchiveModal
        isOpen={showArchiveModal}
        onConfirm={handleArchive}
        onCancel={() => setShowArchiveModal(false)}
        archiving={archiving}
      />

      {/* Share Link Modal */}
      <ShareLinkModal
        isOpen={showShareLinkModal}
        onClose={() => setShowShareLinkModal(false)}
        publicUrl={shareLinkData?.publicUrl || ''}
        linkToken={shareLinkData?.linkToken || ''}
        formVersion={shareLinkData?.formVersion || 1}
        onCopy={() => success(t('builder.linkCopiedToast'), t('builder.linkCopiedMsg'))}
      />

      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* ── TOP ACTION BAR ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-surface p-4 mb-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Left: Form Info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 flex-shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-lg md:text-xl font-bold truncate max-w-[200px] md:max-w-[300px]" style={{ color: 'var(--color-text-primary)' }}>
                    {formTitle}
                  </h1>
                  {/* Status Badge */}
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    currentVersionStatus === 'draft' ? 'status-draft' :
                    currentVersionStatus === 'published' ? 'status-published' :
                    'status-archived'
                  }`}>
                    {currentVersionStatus === 'draft' ? (
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    ) : currentVersionStatus === 'published' ? (
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 8V21H3V8" /><rect x="1" y="3" width="22" height="5" rx="1" />
                      </svg>
                    )}
                    {currentVersionStatus.charAt(0).toUpperCase() + currentVersionStatus.slice(1)}
                  </span>
                  {/* Version Badge */}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold"
                    style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                    v{currentVersionNumber}
                  </span>
                  {isReadOnly && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: 'var(--color-info-light)', color: 'var(--color-info)' }}>
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      {t('builder.locked')}
                    </span>
                  )}
                </div>
                {formDescription && (
                  <p className="text-xs mt-0.5 truncate max-w-[300px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    {formDescription}
                  </p>
                )}
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('builder.fieldCount', { count: formFields.length })} · ID: {formId}
                </p>
              </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              {/* View Toggle */}
              <SegmentedToggle
                options={[
                  {
                    value: 'builder',
                    label: t('builder.builder'),
                    icon: (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    ),
                  },
                  {
                    value: 'preview',
                    label: t('builder.preview'),
                    icon: (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                      </svg>
                    ),
                  },
                  {
                    value: 'analytics',
                    label: t('builder.analytics'),
                    icon: (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                    ),
                  },
                ]}
                value={viewMode}
                onChange={setViewMode}
              />

              {/* Dark Mode Toggle */}
              <button
                onClick={toggleDark}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200"
                style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                title={isDark ? t('common.lightMode') : t('common.darkMode')}
              >
                {isDark ? (
                  <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>

              {/* Preview Button */}
              <button
                onClick={() => setViewMode('preview')}
                className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-xl gap-1.5 transition-all duration-200"
                style={{ backgroundColor: 'var(--color-info-light)', color: 'var(--color-info)' }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                </svg>
                {t('builder.preview')}
              </button>

              {/* Publish Button (only if draft) */}
              {currentVersionStatus === 'draft' && (
                <button
                  onClick={() => setShowPublishModal(true)}
                  className="btn-success text-xs px-3 py-1.5"
                  disabled={formFields.length === 0}
                  title={formFields.length === 0 ? t('builder.addFieldFirst') : t('builder.publishThisForm')}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  {t('builder.publish')}
                </button>
              )}

              {/* Share Link Button (only if published) */}
              {currentVersionStatus === 'published' && (
                <button
                  onClick={handleGenerateLink}
                  disabled={generatingLink}
                  className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-xl gap-1.5 transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{
                    backgroundColor: 'var(--color-info)',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
                  }}
                >
                  {generatingLink ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {t('builder.generating')}
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg>
                      {t('builder.shareableLink')}
                    </>
                  )}
                </button>
              )}

              {/* Archive Button (only if not archived) */}
              {currentVersionStatus !== 'archived' && (
                <button
                  onClick={() => setShowArchiveModal(true)}
                  className="btn-danger text-xs px-3 py-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 8V21H3V8" /><rect x="1" y="3" width="22" height="5" rx="1" /><line x1="10" y1="12" x2="14" y2="12" />
                  </svg>
                  {t('builder.archive')}
                </button>
              )}

              {/* New Form Button */}
              <button onClick={handleCreateAnother}
                className="btn-secondary text-xs px-3 py-1.5 gap-1.5">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {t('builder.new')}
              </button>
            </div>
          </div>

          {/* Read-only banner */}
          {isReadOnly && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-3 p-3 rounded-xl flex items-center justify-between"
              style={{ backgroundColor: 'var(--color-info-light)' }}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-info)' }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span className="text-xs font-medium" style={{ color: 'var(--color-info)' }}>
                  {t('builder.immutableHint', { action: currentVersionStatus === 'published' ? t('builder.createDraftHint') : t('builder.archivedHint') })}
                </span>
              </div>
              <button
                onClick={() => handleCreateDraft(currentVersionId)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                style={{ backgroundColor: 'var(--color-info)', color: 'white' }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {t('builder.editAsNewDraft')}
              </button>
            </motion.div>
          )}
        </motion.div>

        {/* ── Preview Mode ──────────────────────────────── */}
        {viewMode === 'preview' ? (
          <FormPreview
            title={formTitle}
            description={formDescription}
            fields={formFields}
          />
        ) : viewMode === 'analytics' ? (
          /* ── Analytics Mode (Day 14) ─────────────────── */
          <FormAnalytics
            formId={formId}
            formTitle={formTitle}
            formStatus={currentVersionStatus}
            versionNumber={currentVersionNumber}
          />
        ) : (
          /* ── Builder Mode ───────────────────────────── */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Left: Field Palette + Stats */}
            <div className="md:col-span-4 lg:col-span-3 space-y-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key="palette"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <FieldPalette
                    fieldTypes={fieldTypes}
                    activeFieldType={selectedField?.fieldType || null}
                    onFieldTypeClick={handleFieldTypeClick}
                    readOnly={isReadOnly}
                  />
                </motion.div>
              </AnimatePresence>

              {/* Quick Stats */}
              <div className="card-surface p-4">
                <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('builder.formStats')}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl p-3 text-center border"
                    style={{ backgroundColor: 'var(--color-info-light)', borderColor: 'var(--color-info)' }}>
                    <p className="text-2xl font-bold" style={{ color: 'var(--color-info)' }}>{formFields.length}</p>
                    <p className="text-xs font-medium" style={{ color: 'var(--color-info)' }}>{t('builder.fields')}</p>
                  </div>
                  <div className="rounded-xl p-3 text-center border"
                    style={{ backgroundColor: 'var(--color-success-light)', borderColor: 'var(--color-success)' }}>
                    <p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>
                      {formFields.filter((f) => f.is_required === 1 || f.is_required === true || f.config?.required).length}
                    </p>
                    <p className="text-xs font-medium" style={{ color: 'var(--color-success)' }}>{t('builder.required')}</p>
                  </div>
                </div>
                {isReadOnly && (
                  <div className="mt-3 p-2 rounded-lg text-center text-xs font-medium"
                    style={{ backgroundColor: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>
                    🔒 Read-only view
                  </div>
                )}
              </div>

              {/* Mobile: toggle properties */}
              <div className="lg:hidden">
                <button
                  onClick={() => setShowMobileProperties(!showMobileProperties)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 font-medium text-sm rounded-xl border transition-all duration-150"
                  style={{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  {showMobileProperties ? 'Hide Properties' : 'Show Properties'}
                </button>
              </div>
            </div>

            {/* Center: Form Fields */}
            <div className="md:col-span-8 lg:col-span-6 space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="card-surface overflow-hidden"
              >
                <div className="px-5 py-4 flex items-center justify-between"
                  style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        style={{ color: 'var(--color-text-secondary)' }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    </div>
                    <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>{t('builder.formFields')}</h2>
                    {loadingFields && (
                      <div className="flex items-center gap-1.5 text-xs ml-1"
                        style={{ color: 'var(--color-text-tertiary)' }}>
                        <div className="w-3 h-3 border-2 rounded-full animate-spin"
                          style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-text-tertiary)' }} />
                        Refreshing...
                      </div>
                    )}
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
                    {formFields.length} field{formFields.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="p-4 sm:p-5">
                  {formFields.length === 0 && !loadingFields ? (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                        style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                          style={{ color: 'var(--color-text-tertiary)' }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
                        </svg>
                      </div>
                      <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>{t('builder.noFieldsYet')}</h3>
                      <p className="text-sm max-w-sm mx-auto" style={{ color: 'var(--color-text-tertiary)' }}>
                        {isReadOnly
                          ? 'This version has no fields configured.'
                          : 'Click a field type from the palette to get started'
                        }
                      </p>
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={formFields.map((f) => f.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2.5">
                          <AnimatePresence>
                            {formFields.map((field, index) => {
                              const typeId = field.type || field.field_type;
                              const colorClass = typeColors[typeId] || 'bg-gray-50 text-gray-700 border-gray-200';
                              const icon = fieldIcons[field.icon || typeId] || fieldIcons.text;  const isRequired = field.is_required === 1 || field.is_required === true || field.config?.required;
  const configSummary = getConfigSummary(typeId, field.config, t);

                              return (
                                <motion.div
                                  key={field.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  layout
                                >
                                  <SortableFieldCard
                                    field={field}
                                    index={index}
                                    totalFields={formFields.length}
                                    isRequired={isRequired}
                                    configSummary={configSummary}
                                    icon={icon}
                                    colorClass={colorClass}
                                    typeId={typeId}
                                    onEdit={handleOpenEdit}
                                    onDelete={handleOpenDelete}
                                    onDuplicate={handleDuplicate}
                                    readOnly={isReadOnly}
                                    hasRules={fieldsWithRules.has(field.id)}
                                    isHighlighted={highlightedFieldId === field.id}
                                    onBadgeClick={handleBadgeClick}
                                  />
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </motion.div>

              {/* Conditional Rules */}
              <ConditionalRuleBuilder
                formId={formId}
                formFields={formFields}
                ruleService={ruleService}
                toast={{ success, toastError, error: toastError, info }}
                onRulesUpdate={handleRulesUpdate}
              />
            </div>

            {/* Right: Version History + Workflow + Rule Flow */}
            <div className="hidden lg:block lg:col-span-3 space-y-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key="right-panel"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  {/* Workflow Lifecycle */}
                  <WorkflowCard currentStatus={currentVersionStatus} />

                  {/* Version History */}
                  <VersionHistoryPanel
                    versions={versions}
                    currentVersionId={currentVersionId}
                    onSelectVersion={handleSelectVersion}
                    onCreateDraft={handleCreateDraft}
                    onPreview={handlePreviewVersion}
                  />

                  {/* Rule Flow Visualization (always rendered — handles its own empty state) */}
                  <RuleFlowVisualization
                    rules={rules}
                    formFields={formFields}
                  />
                </motion.div>
              </AnimatePresence>

              {/* Property Panel (desktop - shown in right column) */}
              <div className={`${showMobileProperties ? 'block' : 'hidden lg:block'}`}>
                <PropertyPanel
                  fieldType={selectedField?.fieldType || null}
                  field={selectedField?.mode === 'edit' ? formFields[selectedField.fieldIndex] : null}
                  mode={selectedField?.mode || null}
                  label={selectedField?.label || ''}
                  onLabelChange={handlePropertyLabelChange}
                  required={selectedField?.required || false}
                  onRequiredChange={handlePropertyRequiredChange}
                  config={selectedField?.config || {}}
                  onConfigChange={handlePropertyConfigChange}
                  onSave={selectedField ? handleSave : null}
                  onCancel={handleCloseProperties}
                  saving={savingField}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
