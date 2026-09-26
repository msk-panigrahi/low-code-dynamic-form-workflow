import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { auditService, formService } from '../services';
import { useToast } from '../components/Toast';

// ─── Helpers ───────────────────────────────────────────────────────
const formatTimestamp = (dateStr, i18n) => {
  if (!dateStr) return '—';
  try {
    const date = /Z$|[+-]\d{2}:\d{2}$/.test(dateStr) ? new Date(dateStr) : new Date(dateStr + 'Z');
    return date.toLocaleString(i18n.language || 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

const formatDetails = (details) => {
  if (!details) return '';
  try {
    return typeof details === 'string' ? details : JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
};

// ─── Action badge ──────────────────────────────────────────────────
const ActionBadge = ({ action }) => {
  const { t } = useTranslation();
  const upper = (action || '').toUpperCase();
  const styles = {
    DELETE: { bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' },
    ARCHIVE: { bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' },
    CREATE: { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981' },
    UPDATE: { bg: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' },
  };
  const style = styles[upper] || { bg: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' };
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide"
      style={{ backgroundColor: style.bg, color: style.color }}>
      {upper}
    </span>
  );
};

// ─── Actor chip ────────────────────────────────────────────────────
const ActorChip = ({ actorType, actorName, actorId }) => {
  const { t } = useTranslation();
  const isSystem = actorType === 'system';
  const label = isSystem
    ? t('auditLogs.system')
    : (actorName || (actorId != null ? t('auditLogs.userId', { id: actorId }) : '—'));
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
      <span className={`w-6 h-6 rounded-lg inline-flex items-center justify-center flex-shrink-0 ${
        isSystem ? 'bg-gray-200 dark:bg-gray-700' : 'bg-indigo-100 dark:bg-indigo-900/40'
      }`}>
        {isSystem ? (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-tertiary)' }}>
            <rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-indigo, #6366f1)' }}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
        )}
      </span>
      {label}
    </span>
  );
};

// ─── Detail row (expandable) ───────────────────────────────────────
const DetailRow = ({ log }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const details = formatDetails(log.details);
  if (!details) return null;
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold transition-colors"
        style={{ color: 'var(--color-indigo, #6366f1)' }}
      >
        <svg className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {open ? t('auditLogs.hideDetails') : t('auditLogs.viewDetails')}
      </button>
      <AnimatePresence>
        {open && (
          <motion.pre
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 p-3 rounded-lg text-[11px] font-mono overflow-x-auto max-h-48"
            style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
          >
            {details}
          </motion.pre>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Audit Logs Page ───────────────────────────────────────────────
export const AuditLogs = () => {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  // `toast.error` is a stable useCallback from the provider. The full `toast`
  // object is rebuilt on every render, so it must NEVER appear in a dependency
  // array — doing so caused an infinite fetch loop (page shaking/jumping).
  const toastError = toast.error;

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filters
  const [draftAction, setDraftAction] = useState('');
  const [draftEntity, setDraftEntity] = useState('');
  const [draftFormId, setDraftFormId] = useState('');
  const [draftFromDate, setDraftFromDate] = useState('');
  const [draftToDate, setDraftToDate] = useState('');
  const [applied, setApplied] = useState({});

  // Pagination
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);

  // Forms for the filter dropdown
  const [forms, setForms] = useState([]);

  useEffect(() => {
    formService.listForms().then((data) => setForms(data || [])).catch(() => {});
  }, []);

  // Stable serialized form of the active filters so the effect only re-runs
  // when the filters actually change (not on every render).
  const appliedKey = JSON.stringify(applied);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const params = { limit, offset, ...applied };
        const data = await auditService.listLogs(params);
        if (cancelled) return;
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load audit logs:', err);
        setLogs([]);
        setTotal(0);
        toastError(t('auditLogs.loadFailedTitle'), t('auditLogs.loadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedKey, limit, offset, toastError]);

  const handleApplyFilters = () => {
    const next = {};
    if (draftAction) next.action = draftAction;
    if (draftEntity) next.entity_type = draftEntity;
    if (draftFormId) next.form_id = parseInt(draftFormId, 10);
    if (draftFromDate) next.from_date = draftFromDate;
    if (draftToDate) next.to_date = draftToDate;
    setApplied(next);
    setOffset(0);
  };

  const handleReset = () => {
    setDraftAction(''); setDraftEntity(''); setDraftFormId('');
    setDraftFromDate(''); setDraftToDate('');
    setApplied({}); setOffset(0);
  };

  const hasActiveFilters = Object.keys(applied).length > 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;
  const pageNumbers = useMemo(() => {
    const pages = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [totalPages, currentPage]);

  const filterControlStyle = {
    backgroundColor: 'var(--color-input-bg)',
    borderColor: 'var(--color-input-border)',
    color: 'var(--color-text-primary)',
  };

  const chevronBg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238892a6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          {t('auditLogs.title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
          {t('auditLogs.subtitle')}
        </p>
      </motion.div>

      {/* Filters */}
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

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--color-text-tertiary)' }}>
              {t('auditLogs.action')}
            </span>
            <select
              value={draftAction}
              onChange={(e) => setDraftAction(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-xs appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              style={{ ...filterControlStyle, backgroundImage: chevronBg, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '14px' }}
            >
              <option value="">{t('auditLogs.allActions')}</option>
              <option value="delete">{t('auditLogs.actionDelete').toUpperCase()}</option>
              <option value="archive">{t('auditLogs.actionArchive').toUpperCase()}</option>
              <option value="create">{t('auditLogs.actionCreate').toUpperCase()}</option>
              <option value="update">{t('auditLogs.actionUpdate').toUpperCase()}</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--color-text-tertiary)' }}>
              {t('auditLogs.entity')}
            </span>
            <select
              value={draftEntity}
              onChange={(e) => setDraftEntity(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-xs appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              style={{ ...filterControlStyle, backgroundImage: chevronBg, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '14px' }}
            >
              <option value="">{t('auditLogs.allEntities')}</option>
              <option value="submission">{t('auditLogs.entityTypes.submission')}</option>
              <option value="form">{t('auditLogs.entityTypes.form')}</option>
              <option value="retention_policy">{t('auditLogs.entityTypes.retention_policy')}</option>
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--color-text-tertiary)' }}>
              {t('auditLogs.form')}
            </span>
            <select
              value={draftFormId}
              onChange={(e) => setDraftFormId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-xs appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              style={{ ...filterControlStyle, backgroundImage: chevronBg, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '14px' }}
            >
              <option value="">{t('auditLogs.allForms')}</option>
              {forms.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: 'var(--color-text-tertiary)' }}>
              {t('responses.dateFrom')}
            </span>
            <input
              type="date"
              value={draftFromDate}
              onChange={(e) => setDraftFromDate(e.target.value)}
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
              className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              style={filterControlStyle}
            />
          </label>
        </div>

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
            onClick={handleReset}
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
        <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
            style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            {t('auditLogs.total', { count: total })}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('auditLogs.timestamp')}
                </th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider hidden sm:table-cell" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('auditLogs.actor')}
                </th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('auditLogs.action')}
                </th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider hidden md:table-cell" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('auditLogs.entity')}
                </th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider hidden lg:table-cell" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('auditLogs.form')}
                </th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider hidden md:table-cell" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('auditLogs.affected')}
                </th>
                <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider hidden lg:table-cell" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('auditLogs.ip')}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td colSpan={7} className="px-5 py-4">
                      <div className="h-3.5 rounded-md animate-pulse" style={{ backgroundColor: 'var(--color-bg-tertiary)', width: '60%' }} />
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                        style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                        {hasActiveFilters ? t('auditLogs.noMatchesTitle') : t('auditLogs.emptyTitle')}
                      </h3>
                      <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                        {hasActiveFilters ? t('auditLogs.noMatchesDesc') : t('auditLogs.emptyDesc')}
                      </p>
                      {hasActiveFilters && (
                        <button onClick={handleReset} className="btn-primary gap-2 mt-5">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                          </svg>
                          {t('responses.resetFilters')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => (
                  <motion.tr
                    key={log.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                    className="align-top transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                  >
                    <td className="px-5 py-3.5">
                      <span className="text-xs whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
                        {formatTimestamp(log.created_at, i18n)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <ActorChip actorType={log.actor_type} actorName={log.actor_name} actorId={log.actor_id} />
                    </td>
                    <td className="px-5 py-3.5">
                      <ActionBadge action={log.action} />
                      <div className="mt-1.5">
                        <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                          {t(`auditLogs.entityTypes.${log.entity_type}`, { defaultValue: log.entity_type })}
                          {log.entity_id != null && ` #${log.entity_id}`}
                        </span>
                      </div>
                      <DetailRow log={log} />
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="text-xs capitalize" style={{ color: 'var(--color-text-secondary)' }}>
                        {log.entity_type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {log.form_name || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                        {log.records_affected}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <span className="text-xs font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
                        {log.ip_address || '—'}
                      </span>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && logs.length > 0 && (
          <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3" style={{ borderTop: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{t('responses.rowsPerPage')}</span>
              <select
                value={limit}
                onChange={(e) => { setLimit(parseInt(e.target.value, 10)); setOffset(0); }}
                aria-label={t('responses.rowsPerPage')}
                className="px-2 py-1.5 rounded-lg border text-xs appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                style={{ ...filterControlStyle, paddingRight: '26px' }}
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                {t('responses.pageOf', { current: currentPage, total: totalPages })}
              </span>
            </div>
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
                  style={p === currentPage
                    ? { color: '#fff', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderColor: 'transparent' }
                    : { color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}
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
    </div>
  );
};

export default AuditLogs;
