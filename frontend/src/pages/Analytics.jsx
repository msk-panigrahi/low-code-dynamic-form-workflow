import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { analyticsService, formService } from '../services';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// ─── Summary Card Skeleton ───────────────────────────────────────────
const SummaryCardSkeleton = () => (
  <div className="card-surface p-5">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-11 h-11 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
      <div className="space-y-2 flex-1">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/2" />
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3" />
      </div>
    </div>
    <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse w-1/2" />
  </div>
);

// ─── Summary Card ────────────────────────────────────────────────────
const SummaryCard = ({ label, value, suffix, icon, gradient, bg }) => (
  <motion.div
    variants={itemVariants}
    className="card-surface p-5 relative overflow-hidden group hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
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

// ─── Form Card ───────────────────────────────────────────────────────
const FormAnalyticsCard = ({ form, onOpen, index }) => {
  const { t } = useTranslation();
  return (
    <motion.button
      variants={itemVariants}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={() => onOpen(form.id)}
      className="card-surface p-5 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] group"
      aria-label={t('analytics.viewFormAnalytics', { name: form.title })}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
          form.status === 'published' ? 'bg-emerald-500' :
          form.status === 'archived' ? 'bg-red-500' : 'bg-amber-500'
        }`}>
          {(form.title || 'F').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
            {form.title}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {form.status ? t(`workflow.${form.status}`) : t('workflow.draft')}
            {form.latest_version ? ` · v${form.latest_version}` : ''}
          </p>
        </div>
        <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-text-tertiary)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {form.submission_count ?? 0}
          </p>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
            {t('analytics.totalSubmissions')}
          </p>
        </div>
        <div>
          <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {form.completion_rate != null ? `${form.completion_rate}%` : '—'}
          </p>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
            {t('analytics.completionRate')}
          </p>
        </div>
        <div>
          <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {form.average_completion_time || '—'}
          </p>
          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-tertiary)' }}>
            {t('analytics.averageTime')}
          </p>
        </div>
      </div>
    </motion.button>
  );
};

// ─── Analytics Page ──────────────────────────────────────────────────
export const Analytics = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [forms, setForms] = useState([]);
  const [perFormStats, setPerFormStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Parallel: summary + form list
      const [summaryData, formsData] = await Promise.all([
        analyticsService.getAnalyticsSummary(),
        formService.listForms(),
      ]);
      setSummary(summaryData || null);
      setForms(formsData || []);

      // Fetch per-form analytics for the cards (cached server-side)
      const statsMap = {};
      await Promise.all(
        (formsData || []).map(async (form) => {
          try {
            const a = await analyticsService.getFormAnalytics(form.id);
            statsMap[form.id] = a;
          } catch {
            statsMap[form.id] = null;
          }
        }),
      );
      setPerFormStats(statsMap);
    } catch (err) {
      console.error('Failed to load analytics dashboard:', err);
      setError(t('analytics.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenForm = (formId) => {
    navigate(`/form-builder?formId=${formId}&view=analytics`);
  };

  const summaryCards = summary
    ? [
        {
          label: t('analytics.totalForms'),
          value: summary.total_forms ?? 0,

          icon: (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          ),
          gradient: 'from-indigo-500 to-blue-600',
          bg: 'bg-indigo-50 dark:bg-indigo-500/10',
        },
        {
          label: t('analytics.totalSubmissions'),
          value: summary.total_submissions ?? 0,
          icon: (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          ),
          gradient: 'from-emerald-500 to-teal-600',
          bg: 'bg-emerald-50 dark:bg-emerald-500/10',
        },
        {
          label: t('analytics.completionRate'),
          value: summary.completion_rate ?? 0,
          suffix: '%',
          icon: (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          ),
          gradient: 'from-amber-500 to-orange-600',
          bg: 'bg-amber-50 dark:bg-amber-500/10',
        },
        {
          label: t('analytics.averageTime'),
          // Backend always provides the human-readable value (e.g. "2m 18s").
          // No frontend default/placeholder: show exactly what the API returns.
          value: summary.average_completion_time,
          icon: (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          ),
          gradient: 'from-violet-500 to-purple-600',
          bg: 'bg-violet-50 dark:bg-violet-500/10',
        },
      ]
    : [];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {t('analytics.title')}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {t('analytics.subtitle')}
          </p>
        </div>
        <button onClick={fetchData} className="btn-secondary text-xs px-4 py-2 gap-1.5">
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {t('common.refresh')}
        </button>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl mb-6 flex items-center justify-between gap-3"
          style={{ backgroundColor: 'var(--color-error-light)' }}
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-sm font-medium text-red-600">{error}</p>
          </div>
          <button onClick={fetchData} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors">
            {t('common.retry')}
          </button>
        </motion.div>
      )}

      {/* Summary Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        {loading
          ? [0, 1, 2, 3].map((i) => <SummaryCardSkeleton key={i} />)
          : summaryCards.map((card) => (
              <SummaryCard
                key={card.label}
                label={card.label}
                value={card.value}
                suffix={card.suffix}
                icon={card.icon}
                gradient={card.gradient}
                bg={card.bg}
              />
            ))}
      </motion.div>

      {/* Per-Form Analytics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="flex items-center gap-2.5 mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {t('analytics.perFormTitle')}
          </h2>
          {forms.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-tertiary)',
            }}>
              {forms.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => <SummaryCardSkeleton key={i} />)}
          </div>
        ) : forms.length === 0 ? (
          <div className="card-surface text-center py-14 px-6">
            <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
              <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                style={{ color: 'var(--color-text-tertiary)' }}>
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              {t('analytics.emptyTitle')}
            </h3>
            <p className="text-sm max-w-sm mx-auto mb-6" style={{ color: 'var(--color-text-tertiary)' }}>
              {t('analytics.emptyDesc')}
            </p>
            <button onClick={() => navigate('/form-builder')} className="btn-primary gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t('dashboard.createFirstForm')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {forms.map((form, idx) => {
              const stats = perFormStats[form.id];
              return (
                <FormAnalyticsCard
                  key={form.id}
                  form={{
                    ...form,
                    completion_rate: stats?.completion_rate,
                    average_completion_time: stats?.average_completion_time,
                  }}
                  onOpen={handleOpenForm}
                  index={idx}
                />
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Analytics;
