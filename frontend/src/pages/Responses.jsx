import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { formService, exportService } from '../services';
import { useToast } from '../components/Toast';

// ─── Small helpers ─────────────────────────────────────────────────
const formatDate = (dateStr, i18n) => {
  try {
    // Treat naive timestamps (no Z or offset) as UTC so browser/UTC mismatch
    // doesn't shift the displayed time.
    const date = /Z$|[+-]\d{2}:\d{2}$/.test(dateStr) ? new Date(dateStr) : new Date(dateStr + 'Z');
    const now = new Date();
    const diffMs = now - date;
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 60) return i18n.t('responses.justNow');
    if (diffSeconds < 3600) return i18n.t('responses.minutesAgo', { count: Math.floor(diffSeconds / 60) });
    if (diffSeconds < 86400) return i18n.t('responses.hoursAgo', { count: Math.floor(diffSeconds / 3600) });
    return date.toLocaleDateString(i18n.language || 'en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch { return dateStr; }
};

const formatAbsoluteDate = (dateStr, i18n) => {
  try {
    const date = /Z$|[+-]\d{2}:\d{2}$/.test(dateStr) ? new Date(dateStr) : new Date(dateStr + 'Z');
    return date.toLocaleString(i18n.language || 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateStr; }
};

const truncateValue = (val, maxLen = 60) => {
  if (val === null || val === undefined || val === '') return '—';
  const str = String(val);
  return str.length > maxLen ? str.substring(0, maxLen) + '…' : str;
};

const isImageType = (contentType) => (contentType || '').startsWith('image/');

// ─── Status Badge ──────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const { t } = useTranslation();
  const isCompleted = status === 'completed';
  const isArchived = status === 'archived';
  const isPartial = status === 'partial';
  const chipClass = isCompleted
    ? 'status-published'
    : isArchived
      ? 'status-archived'
      : 'status-draft';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${chipClass}`}
    >
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {isCompleted ? (
          <polyline points="20 6 9 17 4 12" />
        ) : isArchived ? (
          <path d="M12 3v18" />
        ) : (
          <circle cx="12" cy="12" r="10" />
        )}
      </svg>
      {isCompleted
        ? t('responses.statusCompleted')
        : isArchived
          ? t('responses.statusArchived')
          : isPartial
            ? t('responses.statusPartial')
            : status || t('responses.statusPartial')}
    </span>
  );
};

// ─── Skeleton row (table loading) ──────────────────────────────────
const SkeletonRows = ({ rows = 6, cols = 5 }) => (
  <tbody>
    {Array.from({ length: rows }).map((_, r) => (
      <tr key={r} style={{ borderBottom: '1px solid var(--color-border)' }}>
        {Array.from({ length: cols }).map((_, c) => (
          <td key={c} className="px-5 py-4">
            <div className="h-3.5 rounded-md animate-pulse" style={{ backgroundColor: 'var(--color-bg-tertiary)', width: c === 0 ? 90 : c === 1 ? 110 : 140 }} />
          </td>
        ))}
      </tr>
    ))}
  </tbody>
);

// ─── Response Detail Modal ─────────────────────────────────────────
const ResponseDetailModal = ({ detail, onClose }) => {
  const { t, i18n } = useTranslation();
  const closeRef = useRef(null);

  // Close on Escape + focus the close button for accessibility
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!detail) return null;

  const meta = [
    { label: t('responses.submittedAt'), value: detail.submitted_at && formatAbsoluteDate(detail.submitted_at, i18n) },
    { label: t('responses.startedAt'), value: detail.started_at && formatAbsoluteDate(detail.started_at, i18n) },
    { label: t('responses.createdAt'), value: detail.created_at && formatAbsoluteDate(detail.created_at, i18n) },
    { label: t('common.version'), value: detail.form_version_id ? `#${detail.form_version_id}` : '—' },
    { label: t('responses.timeToComplete'), value: detail.time_to_complete || '—' },
  ].filter((m) => m.value);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={t('responses.details')}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl shadow-2xl"
          style={{ backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-border)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {t('responses.details')}
                </h2>
                <p className="text-xs mt-1 font-mono break-all" style={{ color: 'var(--color-text-tertiary)' }}>
                  {detail.response_id}
                </p>
              </div>
              <button
                ref={closeRef}
                onClick={onClose}
                aria-label={t('common.close')}
                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <StatusBadge status={detail.status} />
              {detail.time_to_complete && (
                <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  {detail.time_to_complete}
                </span>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="p-6 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {meta.map((m) => (
              <div key={m.label} className="flex items-baseline justify-between gap-3 p-3 rounded-xl border"
                style={{ backgroundColor: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}>
                <span className="text-[11px] font-semibold uppercase tracking-wide flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                  {m.label}
                </span>
                <span className="text-xs text-right" style={{ color: 'var(--color-text-secondary)' }}>{m.value}</span>
              </div>
            ))}
          </div>

          {/* Field values */}
          <div className="p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
              {t('responses.responseFields', { count: detail.responses?.length || 0 })}
            </h3>
            {(!detail.responses || detail.responses.length === 0) ? (
              <div className="text-center py-8">
                <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>{t('responses.noFieldValues')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {detail.responses.map((resp, idx) => (
                  <motion.div
                    key={`${resp.field_id}-${idx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="p-4 rounded-xl border"
                    style={{ backgroundColor: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}
                  >
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{resp.field_label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                        {resp.field_type}
                      </span>
                    </div>
                    {resp.field_type === 'file' ? (
                      <div>
                        {isImageType(resp.file_content_type) ? (
                          <a href={resp.file_download_url} target="_blank" rel="noopener noreferrer" aria-label={`${t('responses.openFile')}: ${resp.value}`}>
                            <img
                              src={resp.file_download_url}
                              alt={resp.value || t('responses.viewAttachment')}
                              className="max-h-48 rounded-lg border"
                              style={{ borderColor: 'var(--color-border)' }}
                            />
                          </a>
                        ) : (
                          <a
                            href={resp.file_download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                            style={{ color: 'var(--color-indigo, #6366f1)' }}
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                            <span className="font-medium text-xs">{resp.value || t('responses.viewAttachment')}</span>
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm break-words" style={{ color: 'var(--color-text-secondary)' }}>
                        {resp.value || <span style={{ color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>{t('responses.noValue')}</span>}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t flex justify-end" style={{ borderColor: 'var(--color-border)' }}>
            <button onClick={onClose} className="btn-primary text-xs px-4 py-2">
              {t('common.close')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── Stat Card (no-form-selected view) ─────────────────────────────
const StatCard = ({ label, value, icon, bg }) => (
  <div className="card-surface p-5">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${bg}`}>{icon}</div>
    <p className="text-2xl md:text-3xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>{value}</p>
    <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{label}</p>
  </div>
);

// ─── Responses Page (Response Browser) ─────────────────────────────
export const Responses = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const urlFormId = searchParams.get('formId');

  // Forms (selector + no-form view)
  const [forms, setForms] = useState([]);
  const [loadingForms, setLoadingForms] = useState(true);
  const [selectedFormId, setSelectedFormId] = useState(urlFormId ? parseInt(urlFormId) : null);
  const [formTitle, setFormTitle] = useState('');

  // Fields for the per-field filter dropdown
  const [fields, setFields] = useState([]);

  // Filters (draft state + applied state)
  const [draftFromDate, setDraftFromDate] = useState('');
  const [draftToDate, setDraftToDate] = useState('');
  const [draftFieldId, setDraftFieldId] = useState('');
  const [draftFieldValue, setDraftFieldValue] = useState('');
  const [draftStatus, setDraftStatus] = useState('all');
  const [draftSearch, setDraftSearch] = useState('');
  const [applied, setApplied] = useState({});

  // Responses
  const [responses, setResponses] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Pagination
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);

  // Detail modal + row actions
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [loadingDetailId, setLoadingDetailId] = useState(null);

  // Export dropdown
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Bulk selection (Day 19)
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // ── Load forms on mount ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoadingForms(true);
        const data = await formService.listForms();
        setForms(data || []);
      } catch (err) {
        console.error('Failed to load forms:', err);
      } finally {
        setLoadingForms(false);
      }
    })();
  }, []);

  // ── Load fields for the filter dropdown when form changes ────────
  useEffect(() => {
    let cancelled = false;
    if (selectedFormId) {
      formService
        .getForm(selectedFormId)
        .then((data) => {
          if (cancelled) return;
          setFields(data?.fields || []);
          setFormTitle(data?.title || '');
        })
        .catch((err) => {
          console.error('Failed to load form fields:', err);
          if (!cancelled) setFields([]);
        });
    } else {
      setFields([]);
      setFormTitle('');
    }
    return () => { cancelled = true; };
  }, [selectedFormId]);

  // ── Fetch responses when form / filters / pagination change ─────
  useEffect(() => {
    if (!selectedFormId) {
      setResponses([]);
      setTotal(0);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setLoadError(null);
        const params = { limit, offset, ...applied };
        const data = await formService.getResponses(selectedFormId, params);
        if (cancelled) return;
        setResponses(data.responses || []);
        setTotal(data.total || 0);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load responses:', err);
        setResponses([]);
        setTotal(0);
        setLoadError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedFormId, applied, limit, offset]);

  // ── Actions ──────────────────────────────────────────────────────
  const handleSelectForm = (formId) => {
    setSelectedFormId(formId || null);
    setOffset(0);
    setApplied({});
    setDraftFromDate(''); setDraftToDate(''); setDraftFieldId(''); setDraftFieldValue('');
    setDraftStatus('all'); setDraftSearch('');
    navigate(`/responses${formId ? `?formId=${formId}` : ''}`, { replace: true });
  };

  const handleApplyFilters = () => {
    const next = {};
    if (draftFromDate) next.from_date = draftFromDate;
    if (draftToDate) next.to_date = draftToDate;
    if (draftStatus && draftStatus !== 'all') next.status = draftStatus;
    if (draftFieldId && draftFieldValue) {
      next.field_id = draftFieldId;
      next.field_value = draftFieldValue;
    }
    if (draftSearch.trim()) next.search = draftSearch.trim();
    setApplied(next);
    setOffset(0);
  };

  const handleResetFilters = () => {
    setDraftFromDate(''); setDraftToDate(''); setDraftFieldId(''); setDraftFieldValue('');
    setDraftStatus('all'); setDraftSearch('');
    setApplied({});
    setOffset(0);
  };

  const openDetail = async (row) => {
    if (!row.response_id) return;
    try {
      setLoadingDetailId(row.response_id);
      const detail = await formService.getResponseDetail(row.response_id);
      setSelectedDetail(detail);
    } catch (err) {
      toast.error(t('responses.loadFailed'), t('responses.detailLoadFailedDesc'));
    } finally {
      setLoadingDetailId(null);
    }
  };

  const handleExport = async (format) => {
    if (!selectedFormId) return;
    try {
      setExporting(true);
      setExportOpen(false);
      const { blob, filename } = await exportService.exportFormResponses(selectedFormId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t('responses.exportSuccess', { format: format.toUpperCase() }));
    } catch (err) {
      toast.error(t('responses.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  // ── Derived pagination values ────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;
  const pageNumbers = useMemo(() => {
    const pages = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [totalPages, currentPage]);

  const hasActiveFilters = useMemo(
    () => Object.keys(applied).length > 0,
    [applied]
  );

  // ── Bulk selection helpers (Day 19) ──────────────────────────────
  const selectableResponseIds = useMemo(
    () => responses.filter((r) => r.response_id).map((r) => r.response_id),
    [responses]
  );
  const allSelected = selectableResponseIds.length > 0 && selectableResponseIds.every((id) => selectedIds.has(id));
  const selectedCount = selectedIds.size;

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        selectableResponseIds.forEach((id) => next.delete(id));
      } else {
        selectableResponseIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!selectedFormId || selectedCount === 0) return;
    setBulkDeleting(true);
    try {
      const payload = {
        response_ids: [...selectedIds],
        confirm: true,
      };
      const result = await formService.bulkDeleteResponses(selectedFormId, payload);
      toast.success(
        t('responses.bulkDeleteSuccessTitle'),
        t('responses.bulkDeleteSuccessMsg', { count: result?.deleted ?? selectedCount })
      );
      setSelectedIds(new Set());
      setBulkModalOpen(false);
      setApplied({ ...applied }); // refresh
    } catch (err) {
      toast.error(t('responses.bulkDeleteFailedTitle'), t('responses.bulkDeleteFailedMsg'));
    } finally {
      setBulkDeleting(false);
    }
  };

  const filterControlStyle = {
    backgroundColor: 'var(--color-input-bg)',
    borderColor: 'var(--color-input-border)',
    color: 'var(--color-text-primary)',
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {t('responses.title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {t('responses.subtitle')}
          </p>
        </div>

        {/* Form Selector */}
        <div className="relative min-w-[220px]">
          <select
            value={selectedFormId ?? ''}
            onChange={(e) => handleSelectForm(e.target.value ? parseInt(e.target.value) : null)}
            aria-label={t('responses.selectForm')}
            className="w-full px-4 py-2.5 rounded-xl border text-sm appearance-none cursor-pointer transition-all duration-200 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            style={{
              ...filterControlStyle,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238892a6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
              backgroundSize: '16px',
            }}
          >
            <option value="">{t('responses.selectForm')}</option>
            {loadingForms ? (
              <option disabled>{t('common.loading')}</option>
            ) : (
              forms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.title} {form.submission_count > 0 ? `(${form.submission_count})` : ''}
                </option>
              ))
            )}
          </select>
        </div>
      </motion.div>

      {!selectedFormId ? (
        /* ── No form selected: overview + form cards ─────────────── */
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Overview stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard
              label={t('responses.total')}
              value={forms.reduce((sum, f) => sum + (f.submission_count || 0), 0)}
              icon={<svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>}
              bg="bg-indigo-50 dark:bg-indigo-500/10"
            />
            <StatCard
              label={t('responses.withResponses')}
              value={forms.filter((f) => f.submission_count > 0).length}
              icon={<svg className="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /></svg>}
              bg="bg-emerald-50 dark:bg-emerald-500/10"
            />
            <StatCard
              label={t('responses.totalForms')}
              value={forms.length}
              icon={<svg className="w-5 h-5 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>}
              bg="bg-violet-50 dark:bg-violet-500/10"
            />
          </div>

          {loadingForms ? (
            <div className="p-12 text-center">
              <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-4"
                style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-info)' }} />
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>{t('responses.loadingForms')}</p>
            </div>
          ) : forms.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                  style={{ color: 'var(--color-text-tertiary)' }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>{t('responses.noForms')}</h3>
              <p className="text-sm mb-6" style={{ color: 'var(--color-text-tertiary)' }}>{t('responses.noFormsDesc')}</p>
              <button onClick={() => navigate('/form-builder')} className="btn-primary gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {t('responses.createForm')}
              </button>
            </div>
          ) : forms.filter((f) => f.submission_count > 0).length === 0 ? (
            <div className="p-12 text-center card-surface">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                  style={{ color: 'var(--color-text-tertiary)' }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                {t('responses.noResponsesYet')}
              </h3>
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                {t('responses.noSubmissionsDesc')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {forms.filter((f) => f.submission_count > 0).map((form, idx) => (
                <motion.button
                  key={form.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => handleSelectForm(form.id)}
                  className="card-surface p-5 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] group"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold ${form.status === 'published' ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                      {form.title.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{form.title}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{t('responses.responseCount', { count: form.submission_count })}</p>
                    </div>
                    <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-text-tertiary)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>
      ) : (
        /* ── Form selected: browser ─────────────────────────────── */
        <>
          {/* Toolbar: total + refresh + export */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center justify-between gap-3 mb-4"
          >
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {formTitle || t('responses.submissions')}
              </h2>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {t('responses.totalResponses', { count: total })}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Refresh */}
              <button
                onClick={() => setApplied({ ...applied })}
                disabled={loading}
                aria-label={t('common.refresh')}
                title={t('common.refresh')}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 border"
                style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}
              >
                <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                <span className="hidden sm:inline">{t('common.refresh')}</span>
              </button>

              {/* Export dropdown */}
              <div className="relative">
                <button
                  onClick={() => setExportOpen((o) => !o)}
                  disabled={exporting}
                  aria-haspopup="menu"
                  aria-expanded={exportOpen}
                  aria-label={t('responses.exportBtn')}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-60 hover:opacity-90"
                  style={{ color: '#fff', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {exporting ? t('responses.exporting') : t('responses.exportBtn')}
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <AnimatePresence>
                  {exportOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      role="menu"
                      className="absolute right-0 top-full mt-2 w-44 rounded-xl shadow-xl border overflow-hidden z-20"
                      style={{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border)' }}
                    >
                      <button
                        role="menuitem"
                        onClick={() => handleExport('csv')}
                        disabled={exporting}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                        </svg>
                        {t('responses.exportCsv')}
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => handleExport('json')}
                        disabled={exporting}
                        className="w-full flex items-center gap-2.5 px-4 py-3 text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                        style={{ color: 'var(--color-text-primary)', borderTop: '1px solid var(--color-border)' }}
                      >
                        <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                        </svg>
                        {t('responses.exportJson')}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bulk Delete (Day 19) */}
              {selectedCount > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => setBulkModalOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90 shadow-lg shadow-red-500/10"
                  style={{ color: '#fff', background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                  aria-label={t('responses.bulkDeleteBtn')}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  {t('responses.bulkDeleteBtn')}
                  <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-bold">{selectedCount}</span>
                </motion.button>
              )}
            </div>
          </motion.div>

          {/* Filter Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-surface p-4 md:p-5 mb-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--color-text-tertiary)' }}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                {t('responses.filters')}
              </h3>
              {hasActiveFilters && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: 'rgba(99, 102, 241, 0.12)', color: 'var(--color-indigo, #6366f1)' }}>
                  {Object.keys(applied).length}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Date range */}
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--color-text-tertiary)' }}>
                    {t('responses.dateFrom')}
                  </span>
                  <input
                    type="date"
                    value={draftFromDate}
                    onChange={(e) => setDraftFromDate(e.target.value)}
                    aria-label={t('responses.dateFrom')}
                    className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    style={filterControlStyle}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--color-text-tertiary)' }}>
                    {t('responses.dateTo')}
                  </span>
                  <input
                    type="date"
                    value={draftToDate}
                    onChange={(e) => setDraftToDate(e.target.value)}
                    aria-label={t('responses.dateTo')}
                    className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    style={filterControlStyle}
                  />
                </label>
              </div>

              {/* Field dropdown */}
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('responses.field')}
                </span>
                <select
                  value={draftFieldId}
                  onChange={(e) => setDraftFieldId(e.target.value)}
                  aria-label={t('responses.field')}
                  className="w-full px-3 py-2 rounded-lg border text-xs appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  style={{
                    ...filterControlStyle,
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238892a6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 10px center',
                    backgroundSize: '14px',
                  }}
                >
                  <option value="">{t('responses.allFields')}</option>
                  {fields.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </label>

              {/* Field value */}
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('responses.fieldValue')}
                </span>
                <input
                  type="text"
                  value={draftFieldValue}
                  onChange={(e) => setDraftFieldValue(e.target.value)}
                  placeholder={t('responses.fieldValuePlaceholder')}
                  aria-label={t('responses.fieldValue')}
                  className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  style={filterControlStyle}
                />
              </label>

              {/* Status */}
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('common.status')}
                </span>
                <select
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value)}
                  aria-label={t('common.status')}
                  className="w-full px-3 py-2 rounded-lg border text-xs appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  style={{
                    ...filterControlStyle,
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238892a6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 10px center',
                    backgroundSize: '14px',
                  }}
                >
                  <option value="all">{t('responses.allStatuses')}</option>
                  <option value="completed">{t('responses.statusCompleted')}</option>
                  <option value="archived">{t('responses.statusArchived')}</option>
                  <option value="partial">{t('responses.statusPartial')}</option>
                </select>
              </label>

              {/* Search */}
              <label className="block lg:col-span-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('common.search')}
                </span>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    value={draftSearch}
                    onChange={(e) => setDraftSearch(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleApplyFilters(); }}
                    placeholder={t('responses.searchPlaceholder')}
                    aria-label={t('common.search')}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    style={filterControlStyle}
                  />
                </div>
              </label>
            </div>

            {/* Apply / Reset */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={handleApplyFilters}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                style={{ color: '#fff', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                {t('responses.applyFilters')}
              </button>
              <button
                onClick={handleResetFilters}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 border"
                style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                {t('responses.resetFilters')}
              </button>
            </div>
          </motion.div>

          {/* Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-surface overflow-hidden"
          >
            {loadError ? (
              /* Error state */
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                  <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  {t('responses.loadFailed')}
                </h3>
                <p className="text-sm mb-6" style={{ color: 'var(--color-text-tertiary)' }}>{t('responses.loadFailedDesc')}</p>
                <button onClick={() => setApplied({ ...applied })} className="btn-primary gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  {t('common.retry')}
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      {/* Select-all (Day 19 bulk delete) */}
                      <th className="px-4 py-3 w-10">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleSelectAll}
                            disabled={selectableResponseIds.length === 0}
                            aria-label={t('responses.selectAll')}
                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </label>
                      </th>
                      <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                        {t('responses.responseId')}
                      </th>
                      <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider hidden sm:table-cell" style={{ color: 'var(--color-text-tertiary)' }}>
                        {t('responses.date')}
                      </th>
                      <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider hidden md:table-cell" style={{ color: 'var(--color-text-tertiary)' }}>
                        {t('responses.primaryFields')}
                      </th>
                      <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider hidden lg:table-cell" style={{ color: 'var(--color-text-tertiary)' }}>
                        {t('common.status')}
                      </th>
                      <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider hidden lg:table-cell" style={{ color: 'var(--color-text-tertiary)' }}>
                        {t('responses.timeToComplete')}
                      </th>
                      <th className="text-right px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                        {t('responses.actions')}
                      </th>
                    </tr>
                  </thead>
                  {loading ? (
                    <SkeletonRows rows={6} cols={7} />
                  ) : responses.length === 0 ? (
                    <tbody>
                      <tr>
                        <td colSpan={7}>
                          <div className="p-12 text-center">
                            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                              style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                                style={{ color: 'var(--color-text-tertiary)' }}>
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                              </svg>
                            </div>
                            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                              {t('responses.noResponsesFound')}
                            </h3>
                            <p className="text-sm mb-6" style={{ color: 'var(--color-text-tertiary)' }}>
                              {hasActiveFilters ? t('responses.noResponsesFoundDesc') : t('responses.noSubmissionsDesc')}
                            </p>
                            {hasActiveFilters && (
                              <button onClick={handleResetFilters} className="btn-primary gap-2">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                                </svg>
                                {t('responses.resetFilters')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  ) : (
                    <tbody>
                      {responses.map((row, idx) => {
                        const summaryEntries = Object.entries(row.summary || {});
                        const summaryExtra = Math.max(0, summaryEntries.length - 3);
                        const isPartial = row.status === 'partial';
                        return (
                          <motion.tr
                            key={row.response_id || `partial-${idx}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.02 }}
                            className={`transition-colors ${selectedIds.has(row.response_id) ? 'bg-indigo-50/60 dark:bg-indigo-500/10' : ''}`}
                            style={{ borderBottom: '1px solid var(--color-border)' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                          >
                            {/* Row checkbox (Day 19 bulk delete) */}
                            <td className="px-4 py-4">
                              {!isPartial && row.response_id ? (
                                <label className="flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.has(row.response_id)}
                                    onChange={() => toggleSelect(row.response_id)}
                                    aria-label={`${t('responses.selectResponse')}: ${row.response_id}`}
                                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                  />
                                </label>
                              ) : null}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center flex-shrink-0">
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                  </svg>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-mono font-semibold truncate max-w-[180px]" style={{ color: 'var(--color-text-primary)' }}>
                                    {isPartial ? t('responses.statusPartial') : `${row.response_id?.substring(0, 12)}…`}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 hidden sm:table-cell">
                              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                {formatDate(row.submitted_at, i18n)}
                              </span>
                            </td>
                            <td className="px-5 py-4 hidden md:table-cell">
                              {summaryEntries.length === 0 ? (
                                <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                              ) : (
                                <div className="space-y-0.5 max-w-[260px]">
                                  {summaryEntries.slice(0, 3).map(([k, v]) => (
                                    <div key={k} className="flex items-baseline gap-1.5 min-w-0">
                                      <span className="text-[10px] font-semibold uppercase tracking-wide flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                                        {k}:
                                      </span>
                                      <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }} title={String(v)}>
                                        {truncateValue(v, 28)}
                                      </span>
                                    </div>
                                  ))}
                                  {summaryExtra > 0 && (
                                    <span className="text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                                      {t('responses.moreFields', { count: summaryExtra })}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-4 hidden lg:table-cell">
                              <StatusBadge status={row.status} />
                            </td>
                            <td className="px-5 py-4 hidden lg:table-cell">
                              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                {row.time_to_complete || '—'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {!isPartial && (
                                  <button
                                    onClick={() => openDetail(row)}
                                    disabled={loadingDetailId === row.response_id}
                                    aria-label={`${t('responses.view')}: ${row.response_id}`}
                                    title={t('responses.view')}
                                    className="w-8 h-8 rounded-lg inline-flex items-center justify-center transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                                    style={{ color: 'var(--color-text-secondary)' }}
                                  >
                                    {loadingDetailId === row.response_id ? (
                                      <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-info)' }} />
                                    ) : (
                                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                                      </svg>
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  )}
                </table>
              </div>
            )}

            {/* Pagination */}
            {!loading && !loadError && responses.length > 0 && (
              <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                {/* Rows per page */}
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{t('responses.rowsPerPage')}</span>
                  <select
                    value={limit}
                    onChange={(e) => { setLimit(parseInt(e.target.value)); setOffset(0); }}
                    aria-label={t('responses.rowsPerPage')}
                    className="px-2 py-1.5 rounded-lg border text-xs appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    style={{
                      ...filterControlStyle,
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238892a6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 8px center',
                      backgroundSize: '12px',
                      paddingRight: '26px',
                    }}
                  >
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                    {t('responses.pageOf', { current: currentPage, total: totalPages })}
                  </span>
                </div>

                {/* Page numbers */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0}
                    aria-label={t('responses.previous')}
                    className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-xs font-medium transition-all duration-200 disabled:opacity-35 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 border"
                    style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  {pageNumbers.map((p) => (
                    <button
                      key={p}
                      onClick={() => setOffset((p - 1) * limit)}
                      aria-label={t('responses.pageNumber', { number: p })}
                      aria-current={p === currentPage ? 'page' : undefined}
                      className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-xs font-semibold transition-all duration-200 border"
                      style={
                        p === currentPage
                          ? { color: '#fff', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderColor: 'transparent' }
                          : { color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)', backgroundColor: 'transparent' }
                      }
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setOffset(Math.min(offset + limit, (totalPages - 1) * limit))}
                    disabled={offset + limit >= total}
                    aria-label={t('responses.next')}
                    className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-xs font-medium transition-all duration-200 disabled:opacity-35 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 border"
                    style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* Detail Modal */}
      <ResponseDetailModal
        detail={selectedDetail}
        onClose={() => setSelectedDetail(null)}
      />

      {/* Bulk Delete confirmation (Day 19) */}
      <AnimatePresence>
        {bulkModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}
            onClick={() => !bulkDeleting && setBulkModalOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={t('responses.bulkDeleteConfirmTitle')}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
              className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
              style={{ backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-border)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 pb-2 text-center">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)' }}>
                  <svg className="w-7 h-7 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  {t('responses.bulkDeleteConfirmTitle')}
                </h3>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {t('responses.bulkDeleteConfirmMsg', { count: selectedCount })}
                </p>
              </div>

              {/* Irreversible warning */}
              <div className="px-6 mt-4">
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl"
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <div>
                    <p className="text-xs font-semibold text-red-600">{t('responses.bulkDeleteIrreversible')}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                      {t('responses.bulkDeleteIrreversibleDesc')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-5 mt-4" style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-tertiary)' }}>
                <button
                  onClick={() => setBulkModalOpen(false)}
                  disabled={bulkDeleting}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 border disabled:opacity-50"
                  style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                  style={{ color: '#fff', background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                >
                  {bulkDeleting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      {t('responses.bulkDeleting')}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      {t('responses.bulkDeleteConfirm')}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Responses;
