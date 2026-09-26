import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { analyticsService, exportService } from '../services';
import { useToast } from './Toast';
import { DistributionSection, DistributionCardSkeleton, TrendSection } from './DistributionCharts';

// ─── Icons ───────────────────────────────────────────────────────────
const icons = {
  submissions: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  rate: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  time: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  sessions: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};

// ─── Card Skeleton ───────────────────────────────────────────────────
const StatCardSkeleton = () => (
  <div className="card-surface p-5">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
      <div className="space-y-2 flex-1">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3" />
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
      </div>
    </div>
    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse w-2/3" />
  </div>
);

// ─── Stat Card ───────────────────────────────────────────────────────
const StatCard = ({ label, value, suffix, icon, gradient, bg, ariaLabel }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    className="card-surface p-5 relative overflow-hidden group hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
    role="group"
    aria-label={ariaLabel || label}
  >
    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${gradient} opacity-80`} />
    <div className="flex items-start justify-between mb-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${bg}`}>
        <span className={gradient.replace('from-', 'text-').split(' ')[0]}>{icon}</span>
      </div>
    </div>
    <p className="text-2xl md:text-3xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
      {value}
      {suffix && <span className="text-lg font-semibold ml-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{suffix}</span>}
    </p>
    <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{label}</p>
  </motion.div>
);

// ─── Empty / Error / Charts states ───────────────────────────────────
const EmptyState = ({ title, desc, onRefresh }) => {
  const { t } = useTranslation();
  return (
    <div className="text-center py-14 px-6">
      <div className="w-24 h-24 rounded-3xl mx-auto mb-5 flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
        <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"
          style={{ color: 'var(--color-text-tertiary)' }}>
          <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>{title}</h3>
      <p className="text-sm max-w-sm mx-auto mb-6" style={{ color: 'var(--color-text-tertiary)' }}>{desc}</p>
      {onRefresh && (
        <button onClick={onRefresh} className="btn-primary text-xs px-4 py-2 gap-1.5">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {t('analytics.refresh')}
        </button>
      )}
    </div>
  );
};

const ErrorState = ({ message, onRetry }) => {
  const { t } = useTranslation();
  return (
    <div className="text-center py-14 px-6">
      <div className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-error-light)' }}>
        <svg className="w-10 h-10 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
        {t('analytics.loadFailedTitle')}
      </h3>
      <p className="text-sm max-w-sm mx-auto mb-6" style={{ color: 'var(--color-text-tertiary)' }}>{message}</p>
      <button onClick={onRetry} className="btn-primary text-xs px-4 py-2 gap-1.5">
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
        {t('common.retry')}
      </button>
    </div>
  );
};

// ─── Export Responses Card (Day 15) ──────────────────────────────────
const ExportResponsesCard = ({ formId, formTitle, disabled = false }) => {
  const { t } = useTranslation();
  const { success, error: toastError, ToastContainer } = useToast();

  // 'csv' | 'json'
  const [format, setFormat] = useState('csv');
  const [status, setStatus] = useState('idle'); // idle | preparing | downloading
  const [progressText, setProgressText] = useState('');
  const timersRef = useRef([]);

  // Clean up any pending progress-phase timers on unmount
  useEffect(() => () => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current = [];
  }, []);

  const isBusy = status !== 'idle';

  const schedulePhase = (label, ms) => {
    const id = setTimeout(() => setProgressText(label), ms);
    timersRef.current.push(id);
  };

  const triggerDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    if (isBusy) return;
    setStatus('preparing');
    setProgressText(t('export.preparingData'));
    // Progress phases for large exports
    schedulePhase(t('export.generatingFile'), 1200);
    schedulePhase(t('export.downloading'), 2400);

    try {
      const { blob, filename } = await exportService.exportFormResponses(formId, format);
      setStatus('downloading');
      setProgressText(t('export.downloading'));
      triggerDownload(blob, filename);
      success(
        format === 'csv'
          ? t('export.csvSuccessTitle')
          : t('export.jsonSuccessTitle'),
        t('export.successMsg', { count: 0, format: format.toUpperCase() }),
      );
    } catch (err) {
      const statusCode = err?.response?.status;
      const message =
        statusCode === 403
          ? t('export.forbiddenMsg')
          : statusCode === 404
            ? t('export.notFoundMsg')
            : t('export.failedMsg');
      toastError(t('export.failedTitle'), message);
    } finally {
      setStatus('idle');
      setProgressText('');
      timersRef.current.forEach((id) => clearTimeout(id));
      timersRef.current = [];
    }
  };

  const formatOptions = [
    { value: 'csv', label: 'CSV' },
    { value: 'json', label: 'JSON' },
  ];

  return (
    <>
      <ToastContainer />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-surface p-5 relative overflow-hidden"
        role="group"
        aria-label={t('export.cardTitle')}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-500 to-indigo-600 opacity-80" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-sky-50 dark:bg-sky-500/10 text-sky-600">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {t('export.cardTitle')}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                {t('export.cardDesc', { name: formTitle || '' })}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2.5 flex-shrink-0 flex-wrap">
            {/* Format selector (segmented, keyboard accessible) */}
            <div
              role="radiogroup"
              aria-label={t('export.formatLabel')}
              className="relative flex rounded-xl p-0.5 border"
              style={{ backgroundColor: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border)' }}
            >
              {formatOptions.map((opt) => (
                <button
                  key={opt.value}
                  role="radio"
                  aria-checked={format === opt.value}
                  disabled={isBusy}
                  onClick={() => setFormat(opt.value)}
                  className="relative z-10 flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    color: format === opt.value ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                    backgroundColor: format === opt.value ? 'var(--color-bg-primary)' : 'transparent',
                    boxShadow: format === opt.value ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                  }}
                >
                  {opt.value === 'csv' ? (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <line x1="10" y1="9" x2="8" y2="9" />
                    </svg>
                  )}
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Export button */}
            <button
              onClick={handleExport}
              disabled={isBusy || disabled}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                backgroundColor: 'var(--color-info)',
                color: '#fff',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
              }}
              aria-label={t('export.exportBtn', { format: format.toUpperCase() })}
            >
              {isBusy ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  {t('export.preparing')}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {t('export.exportBtn', { format: format.toUpperCase() })}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress indicator for large exports */}
        <div aria-live="polite" aria-busy={isBusy}>
          {isBusy && (
            <div className="mt-4 flex items-center gap-2.5">
              <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-600"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
              <span className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                {progressText}
              </span>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};

// ─── Main Component ──────────────────────────────────────────────────
export const FormAnalytics = ({ formId, formTitle, formStatus = 'draft', versionNumber = null }) => {
  const { t } = useTranslation();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    if (!formId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await analyticsService.getFormAnalytics(formId);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError(err.response?.data?.detail || t('analytics.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [formId, t]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Environment label: Production when published, else Development
  const environment = useMemo(
    () => (formStatus === 'published' ? t('analytics.env.production') : t('analytics.env.development')),
    [formStatus, t],
  );

  const statusColor = {
    draft: 'status-draft',
    published: 'status-published',
    archived: 'status-archived',
  }[formStatus] || 'status-draft';

  return (
    <div className="space-y-6" aria-live="polite">
      {/* Form header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-surface p-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
                {formTitle || t('analytics.formAnalytics')}
              </h2>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>
                  {formStatus.charAt(0).toUpperCase() + formStatus.slice(1)}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                  {t('analytics.environment')}: {t(`analytics.env.${environment.toLowerCase()}`)}
                </span>
                {versionNumber != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-bold"
                    style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                    v{versionNumber}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={fetchAnalytics} className="btn-icon" title={t('analytics.refresh')} aria-label={t('analytics.refresh')}>
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>
      </motion.div>

      {/* Export Responses (always available — empty forms export header-only/empty array) */}
      <ExportResponsesCard formId={formId} formTitle={formTitle} />

      {loading ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
          </div>
          {/* Distribution section skeleton */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-48" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-72" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DistributionCardSkeleton /><DistributionCardSkeleton />
            </div>
          </div>
        </>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchAnalytics} />
      ) : !analytics || analytics.total_submissions === 0 ? (
        <EmptyState
          title={t('analytics.emptyTitle')}
          desc={t('analytics.emptyDesc')}
          onRefresh={fetchAnalytics}
        />
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label={t('analytics.totalSubmissions')}
              value={analytics.total_submissions ?? 0}
              icon={icons.submissions}
              gradient="from-indigo-500 to-blue-600"
              bg="bg-indigo-50 dark:bg-indigo-500/10"
            />
            <StatCard
              label={t('analytics.completionRate')}
              value={analytics.completion_rate ?? 0}
              suffix="%"

              icon={icons.rate}
              gradient="from-emerald-500 to-teal-600"
              bg="bg-emerald-50 dark:bg-emerald-500/10"
            />
            <StatCard
              label={t('analytics.averageTime')}
              // Backend value only — no frontend placeholder.
              value={analytics.average_completion_time}
              icon={icons.time}
              gradient="from-amber-500 to-orange-600"
              bg="bg-amber-50 dark:bg-amber-500/10"
            />
            <StatCard
              label={t('analytics.startedSessions')}
              value={analytics.started_sessions ?? 0}
              icon={icons.sessions}
              gradient="from-violet-500 to-purple-600"
              bg="bg-violet-50 dark:bg-violet-500/10"
            />
          </div>

          {/* Submissions over time (trend) */}
          <TrendSection data={analytics.submissions_over_time || []} />

          {/* Per-field distributions (Day 17) */}
          <DistributionSection distributions={analytics.field_distributions || []} />
        </>
      )}
    </div>
  );
};

export default FormAnalytics;
