import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { retentionService, formService } from '../services';
import { useToast } from './Toast';

// ─── Small helpers ─────────────────────────────────────────────────
const formatDate = (dateStr, i18n) => {
  if (!dateStr) return '—';
  try {
    const date = /Z$|[+-]\d{2}:\d{2}$/.test(dateStr) ? new Date(dateStr) : new Date(dateStr + 'Z');
    return date.toLocaleDateString(i18n.language || 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

// ─── Status pill ───────────────────────────────────────────────────
const StatusPill = ({ enabled }) => {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
        enabled ? 'status-published' : 'status-draft'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
      {enabled ? t('settings.retention.active') : t('settings.retention.disabled')}
    </span>
  );
};

// ─── Add / Edit policy modal ───────────────────────────────────────
const PolicyModal = ({ isOpen, onClose, onSaved, editing, forms, policiesByForm }) => {
  const { t } = useTranslation();
  const toast = useToast();

  const [formId, setFormId] = useState('');
  const [retentionDays, setRetentionDays] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Reset when opening for a different target
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSaving(false);
    if (editing) {
      setFormId(String(editing.form_id));
      setRetentionDays(editing.retention_days != null ? String(editing.retention_days) : '');
      setEnabled(!!editing.enabled);
    } else {
      setFormId('');
      setRetentionDays('');
      setEnabled(true);
    }
  }, [isOpen, editing]);

  const handleSave = async () => {
    // Validation
    const targetFormId = parseInt(formId, 10);
    if (!targetFormId) {
      setError(t('settings.retention.selectFormError'));
      return;
    }
    const days = retentionDays.trim() === '' ? null : parseInt(retentionDays, 10);
    if (days !== null && (Number.isNaN(days) || days < 1)) {
      setError(t('settings.retention.invalidDays'));
      return;
    }

    const payload = {
      retention_days: days,
      action: 'archive',
      enabled,
    };

    setSaving(true);
    setError(null);
    try {
      if (editing && editing.id) {
        await retentionService.updatePolicy(targetFormId, payload);
      } else {
        await retentionService.createPolicy(targetFormId, payload);
      }
      toast.success(
        editing ? t('settings.retention.updatedTitle') : t('settings.retention.createdTitle'),
        t('settings.retention.updatedMsg')
      );
      onSaved();
      onClose();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409) {
        setError(t('settings.retention.alreadyExists'));
      } else if (status === 403) {
        setError(t('settings.retention.forbidden'));
      } else {
        setError(t('settings.retention.saveFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  // Forms that don't have a policy yet (when creating)
  const availableForms = editing
    ? forms
    : forms.filter((f) => !policiesByForm[String(f.id)]?.id);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !saving && onClose()}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="relative w-full max-w-md"
          >
            <div
              className="card-surface p-6 rounded-2xl shadow-2xl border"
              style={{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border)' }}
            >
              <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                {editing ? t('settings.retention.editTitle') : t('settings.retention.addTitle')}
              </h2>
              <p className="text-xs mb-5" style={{ color: 'var(--color-text-tertiary)' }}>
                {t('settings.retention.modalDesc')}
              </p>

              {/* Form selector */}
              <label className="block mb-4">
                <span className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('settings.retention.formName')}
                </span>
                <select
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  disabled={!!editing || saving}
                  aria-label={t('settings.retention.formName')}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 disabled:opacity-60"
                  style={{
                    backgroundColor: 'var(--color-input-bg)',
                    borderColor: 'var(--color-input-border)',
                    color: 'var(--color-text-primary)',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238892a6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    backgroundSize: '14px',
                    paddingRight: '34px',
                  }}
                >
                  <option value="">{t('settings.retention.selectForm')}</option>
                  {availableForms.map((f) => (
                    <option key={f.id} value={f.id}>{f.title}</option>
                  ))}
                </select>
              </label>

              {/* Retention days */}
              <label className="block mb-4">
                <span className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('settings.retention.daysLabel')}
                </span>
                <input
                  type="number"
                  min="1"
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(e.target.value)}
                  placeholder={t('settings.retention.daysPlaceholder')}
                  aria-label={t('settings.retention.daysLabel')}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  style={{
                    backgroundColor: 'var(--color-input-bg)',
                    borderColor: 'var(--color-input-border)',
                    color: 'var(--color-text-primary)',
                  }}
                />
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('settings.retention.daysHint')}
                </p>
              </label>

              {/* Enable toggle */}
              <button
                type="button"
                onClick={() => setEnabled((e) => !e)}
                disabled={saving}
                className="w-full flex items-center justify-between p-3 rounded-xl border mb-5 transition-colors"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-tertiary)' }}
              >
                <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                  {t('settings.retention.enablePolicy')}
                </span>
                <span
                  className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-200 ${
                    enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4.5 w-4.5 h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                      enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </span>
              </button>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 rounded-xl mb-4"
                  style={{ backgroundColor: 'var(--color-error-light)' }}
                >
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <span className="text-xs font-medium text-red-600">{error}</span>
                </motion.div>
              )}

              <div className="flex items-center gap-3">
                <button onClick={onClose} disabled={saving} className="flex-1 btn-secondary text-sm py-2.5">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 btn-primary text-sm py-2.5 gap-2"
                >
                  {saving && (
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  )}
                  {saving ? t('common.submitting') || t('common.loading') : t('common.save')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// ─── Retention Policy Section ──────────────────────────────────────
export const RetentionPolicySection = () => {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  // Stable useCallback from the provider — never put the full `toast` object
  // in a dependency array (it is rebuilt every render and caused an infinite
  // reload loop here).
  const toastError = toast.error;

  const [policies, setPolicies] = useState([]);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [policyData, formData] = await Promise.all([
        retentionService.listPolicies(),
        formService.listForms(),
      ]);
      setPolicies(policyData?.policies || []);
      setForms(formData || []);
    } catch (err) {
      console.error('Failed to load retention policies:', err);
      toastError(t('settings.retention.loadFailedTitle'), t('settings.retention.loadFailed'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toastError, t]);

  useEffect(() => {
    load();
  }, [load]);

  const policiesByForm = Object.fromEntries(
    policies.filter((p) => p.id).map((p) => [String(p.form_id), p])
  );

  const handleOpenAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (policy) => {
    setEditing(policy);
    setModalOpen(true);
  };

  const handleDelete = async (policy) => {
    if (!policy?.id) return;
    setDeletingId(policy.id);
    try {
      await retentionService.deletePolicy(policy.form_id);
      toast.success(t('settings.retention.deletedTitle'), t('settings.retention.deletedMsg'));
      await load();
    } catch (err) {
      toast.error(t('settings.retention.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleRunJob = async () => {
    try {
      const result = await retentionService.runJob();
      toast.success(t('settings.retention.jobRanTitle'), result?.message || '');
      await load();
    } catch (err) {
      toast.error(t('settings.retention.jobFailed'));
    }
  };

  return (
    <div className="card-surface p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-indigo, #6366f1)' }}>
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            {t('settings.retention.title')}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            {t('settings.retention.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunJob}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 border"
            style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}
            title={t('settings.retention.runJobHint')}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            {t('settings.retention.runJob')}
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
            style={{ color: '#fff', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t('settings.retention.addPolicy')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center">
          <div className="w-8 h-8 border-4 rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-info)' }} />
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{t('common.loading')}</p>
        </div>
      ) : policies.length === 0 ? (
        <div className="py-10 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--color-text-tertiary)' }}>
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
            {t('settings.retention.emptyTitle')}
          </h3>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
            {t('settings.retention.emptyDesc')}
          </p>
          <button onClick={handleOpenAdd} className="btn-primary text-xs gap-1.5">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t('settings.retention.addPolicy')}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('settings.retention.formName')}
                </th>
                <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('settings.retention.retention')}
                </th>
                <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wider hidden sm:table-cell" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('settings.retention.action')}
                </th>
                <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('common.status')}
                </th>
                <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wider hidden md:table-cell" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('settings.retention.updated')}
                </th>
                <th className="text-right px-3 py-2.5 font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('common.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {policies.map((policy) => (
                <tr key={policy.form_id} style={{ borderBottom: '1px solid var(--color-border)' }}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="px-3 py-3">
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      {policy.form_name}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {policy.retention_days != null ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: 'var(--color-info-light)', color: 'var(--color-info)' }}>
                        {t('settings.retention.daysValue', { count: policy.retention_days })}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
                        {t('settings.retention.never')}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell">
                    <span className="text-xs capitalize" style={{ color: 'var(--color-text-secondary)' }}>
                      {policy.action}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill enabled={policy.enabled} />
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell">
                    <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                      {formatDate(policy.updated_at || policy.created_at, i18n)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {policy.id ? (
                        <>
                          <button
                            onClick={() => handleOpenEdit(policy)}
                            aria-label={`${t('common.edit')}: ${policy.form_name}`}
                            title={t('common.edit')}
                            className="w-7 h-7 rounded-lg inline-flex items-center justify-center transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(policy)}
                            disabled={deletingId === policy.id}
                            aria-label={`${t('common.delete')}: ${policy.form_name}`}
                            title={t('common.delete')}
                            className="w-7 h-7 rounded-lg inline-flex items-center justify-center transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                            style={{ color: 'var(--color-text-tertiary)' }}
                          >
                            {deletingId === policy.id ? (
                              <span className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-error)' }} />
                            ) : (
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            )}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleOpenEdit(policy)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                          style={{ color: '#fff', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                        >
                          {t('settings.retention.addPolicy')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PolicyModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        editing={editing}
        forms={forms}
        policiesByForm={policiesByForm}
      />
    </div>
  );
};

export default RetentionPolicySection;
