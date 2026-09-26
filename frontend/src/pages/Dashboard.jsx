import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { formService, healthService } from '../services';
import { useToast } from '../components/Toast';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export const Dashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { success, error: toastError, ToastContainer } = useToast();
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      setLoading(true);
      const data = await formService.listForms();
      setForms(data || []);
      setError(null);
    } catch (err) {
      setError(t('dashboard.failedLoad'));
      console.error('Error fetching forms:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    draft: forms.filter(f => f.status === 'draft').length,
    published: forms.filter(f => f.status === 'published').length,
    archived: forms.filter(f => f.status === 'archived').length,
    total: forms.length,
    totalVersions: forms.reduce((acc, f) => acc + (f.version_count || 0), 0),
  };

  const statCards = [
    {
      label: t('dashboard.totalForms'),
      value: stats.total,
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
      label: t('dashboard.draftForms'),
      value: stats.draft,
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      ),
      gradient: 'from-amber-500 to-orange-600',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
    },
    {
      label: t('dashboard.published'),
      value: stats.published,
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      ),
      gradient: 'from-emerald-500 to-teal-600',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    },
    {
      label: t('dashboard.archived'),
      value: stats.archived,
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 8V21H3V8" />
          <rect x="1" y="3" width="22" height="5" rx="1" />
          <line x1="10" y1="12" x2="14" y2="12" />
        </svg>
      ),
      gradient: 'from-red-500 to-rose-600',
      bg: 'bg-red-50 dark:bg-red-500/10',
    },
    {
      label: t('dashboard.totalVersions'),
      value: stats.totalVersions,
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
      gradient: 'from-purple-500 to-violet-600',
      bg: 'bg-purple-50 dark:bg-purple-500/10',
    },
  ];

  const handleCreateForm = () => {
    navigate('/form-builder');
  };

  const handleOpenForm = (formId) => {
    navigate(`/form-builder?formId=${formId}`);
  };

  /**
   * Duplicate a form as a fresh draft. Shows a per-row loading state,
   * prevents repeated clicks, and refreshes the list on success.
   */
  const handleDuplicate = async (form) => {
    if (duplicatingId !== null) return;
    setDuplicatingId(form.id);
    try {
      const data = await formService.duplicateForm(form.id);
      success(
        t('dashboard.duplicatedToast'),
        t('dashboard.duplicatedMsg', { title: data?.form?.title || form.title })
      );
      await fetchForms();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        toastError(t('dashboard.duplicateFailedTitle'), t('dashboard.duplicateNotFound'));
      } else if (status === 403) {
        toastError(t('dashboard.duplicateFailedTitle'), t('dashboard.duplicateForbidden'));
      } else {
        toastError(t('dashboard.duplicateFailedTitle'), t('dashboard.duplicateFailed'));
      }
    } finally {
      setDuplicatingId(null);
    }
  };

  return (
    <>
      <ToastContainer />
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {t('dashboard.title')}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
              {t('dashboard.subtitle')}
            </p>
          </div>
          <button onClick={handleCreateForm} className="btn-primary gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t('dashboard.newForm')}
          </button>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl mb-6 flex items-start gap-3"
            style={{ backgroundColor: 'var(--color-error-light)' }}
          >
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-sm font-medium text-red-600">{error}</p>
          </motion.div>
        )}

        {/* Stats Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8"
        >
          {statCards.map((stat) => (
            <motion.div
              key={stat.label}
              variants={itemVariants}
              className="card-surface p-4 md:p-5 relative overflow-hidden group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bg}`}>
                  <span className={stat.gradient.replace('from-', 'text-').split(' ')[0]}>
                    {stat.icon}
                  </span>
                </div>
                <span
                  className="text-xs font-medium opacity-60"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  {stat.label === t('dashboard.totalForms') ? t('common.all') : ''}
                </span>
              </div>
              <p className="text-2xl md:text-3xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                {stat.value}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                {stat.label}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Forms Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card-surface overflow-hidden"
        >
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {t('dashboard.allForms')}
              </h2>
              {forms.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-tertiary)'
                }}>
                  {t('dashboard.totalCount', { count: forms.length })}
                </span>
              )}
            </div>
            <button onClick={fetchForms} className="btn-icon" title={t('common.refresh')}>
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-4"
                style={{
                  borderColor: 'var(--color-border)',
                  borderTopColor: 'var(--color-info)',
                }}
              />                <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                {t('dashboard.loadingForms')}
              </p>
            </div>
          ) : forms.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                  style={{ color: 'var(--color-text-tertiary)' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
                {t('dashboard.noFormsTitle')}
              </h3>
              <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--color-text-tertiary)' }}>
                {t('dashboard.noFormsDesc')}
              </p>
              <button onClick={handleCreateForm} className="btn-primary gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {t('dashboard.createFirstForm')}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                      {t('dashboard.form')}
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider hidden md:table-cell" style={{ color: 'var(--color-text-tertiary)' }}>
                      {t('common.status')}
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider hidden lg:table-cell" style={{ color: 'var(--color-text-tertiary)' }}>
                      {t('common.version')}
                    </th>
                    <th className="text-left px-5 py-3 font-semibold text-xs uppercase tracking-wider hidden md:table-cell" style={{ color: 'var(--color-text-tertiary)' }}>
                      {t('common.fields')}
                    </th>
                    <th className="text-right px-5 py-3 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                      {t('common.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {forms.map((form, idx) => (
                    <motion.tr
                      key={form.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="group cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid var(--color-border)' }}
                      onClick={() => handleOpenForm(form.id)}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold ${
                            form.status === 'published' ? 'bg-emerald-500' :
                            form.status === 'archived' ? 'bg-red-500' : 'bg-amber-500'
                          }`}>
                            {form.title.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-sm truncate max-w-[200px]" style={{ color: 'var(--color-text-primary)' }}>
                              {form.title}
                            </p>
                            <p className="text-xs truncate max-w-[200px]" style={{ color: 'var(--color-text-tertiary)' }}>
                              {form.description || t('dashboard.noDescription')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          form.status === 'draft' ? 'status-draft' :
                          form.status === 'published' ? 'status-published' :
                          'status-archived'
                        }`}>
                          {form.status === 'draft' ? (
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                          ) : form.status === 'published' ? (
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 8V21H3V8" /><rect x="1" y="3" width="22" height="5" rx="1" />
                            </svg>
                          )}
                          {t(`workflow.${form.status}`)}
                        </span>
                      </td>
                      <td className="px-5 py-4 hidden lg:table-cell">
                        <span className="text-sm font-mono font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                          v{form.latest_version || '-'}
                        </span>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {t('builder.fieldCount', { count: form.field_count })}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Duplicate action */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDuplicate(form); }}
                            disabled={duplicatingId !== null}
                            className="btn-icon border"
                            style={{
                              borderColor: 'var(--color-border)',
                              color: duplicatingId === form.id ? 'var(--color-info)' : 'var(--color-text-tertiary)',
                            }}
                            title={duplicatingId === form.id ? t('dashboard.duplicating') : t('dashboard.duplicate')}
                            aria-label={t('dashboard.duplicateAria', { title: form.title })}
                          >
                            {duplicatingId === form.id ? (
                              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            )}
                          </button>

                          {/* Open action */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenForm(form.id); }}
                            className="btn-primary text-xs px-3 py-1.5 gap-1.5"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                            </svg>
                            {t('common.open')}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
};
