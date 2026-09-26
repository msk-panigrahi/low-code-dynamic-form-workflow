import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

// ─── Status Config ───────────────────────────────────────────────────
const statusConfig = {
  draft: { dot: 'timeline-dot-draft', icon: '✏️' },
  published: { dot: 'timeline-dot-published', icon: '✅' },
  archived: { dot: 'timeline-dot-archived', icon: '📦' },
};

const statusKey = (status) => ({
  draft: 'workflow.draft',
  published: 'workflow.published',
  archived: 'workflow.archived',
}[status] || 'workflow.draft');

// ─── Date Formatting ────────────────────────────────────────────────
const formatDate = (dateStr, t) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return t('responses.today');
  if (days === 1) return t('builder.yesterday');
  if (days < 7) return t('builder.daysAgo', { count: days });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ─── Action Button ──────────────────────────────────────────────────
const ActionButton = ({ icon, title, onClick, disabled, className = '' }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`inline-flex items-center justify-center w-10 h-10 rounded-full border
      transition-all duration-200 ease-out
      hover:scale-110 active:scale-95
      disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100
      ${className}`}
    style={{
      backgroundColor: 'var(--color-bg-tertiary)',
      borderColor: 'var(--color-border)',
      color: 'var(--color-text-tertiary)',
    }}
  >
    {icon}
  </button>
);

// ─── Empty State ────────────────────────────────────────────────────
const EmptyState = () => {
  const { t } = useTranslation();
  return (
    <div className="card-surface p-6">
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
        {t('builder.versionHistory')}
      </h3>
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            style={{ color: 'var(--color-text-tertiary)' }}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
          {t('builder.noVersionsYet')}
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          {t('builder.noVersionsDesc')}
        </p>
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────
export const VersionHistoryPanel = ({ versions = [], currentVersionId, onSelectVersion, onCreateDraft, onPreview }) => {
  const { t } = useTranslation();

  if (!versions || versions.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="card-surface p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {t('builder.versionHistory')}
        </h3>
        <span className="text-xs px-2.5 py-1 rounded-full font-medium"
          style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
          {t('builder.versionCount', { count: versions.length })}
        </span>
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {versions.map((version, idx) => {
          const config = statusConfig[version.status] || statusConfig.draft;
          const isCurrent = version.id === currentVersionId;
          const isLast = idx === versions.length - 1;

          return (
            <motion.div
              key={version.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`relative pl-8 ${isLast ? 'pb-0' : 'pb-4'}`}
            >
              {/* Timeline Line */}
              {!isLast && (
                <div className="timeline-line" style={{ left: '14px', top: '10px' }} />
              )}

              {/* Timeline Dot */}
              <div
                className="absolute top-[10px] z-10"
                style={{ left: '9px' }}
              >
                <div className={`w-3 h-3 rounded-full border-2 ${config.dot}`}
                  style={{ backgroundColor: 'var(--color-card-bg)' }} />
              </div>

              {/* Version Card */}
              <div
                className={`rounded-xl border transition-all duration-200 cursor-pointer
                  ${isCurrent ? 'ring-2 ring-indigo-500/30 border-indigo-300' : 'hover:border-indigo-300'}`}
                style={{
                  backgroundColor: 'var(--color-card-bg)',
                  borderColor: isCurrent ? undefined : 'var(--color-border)',
                }}
                onClick={() => onSelectVersion?.(version)}
              >
                {/* Mobile: stack content and actions vertically */}
                {/* Desktop: side by side */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 md:p-3 lg:p-4 gap-4">
                  {/* Left: Version Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                      <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        v{version.version_number}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        version.status === 'draft' ? 'status-draft' :
                        version.status === 'published' ? 'status-published' :
                        'status-archived'
                      }`}>
                        {t(statusKey(version.status))}
                      </span>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ backgroundColor: 'var(--color-info-light)', color: 'var(--color-info)' }}>
                          {t('workflow.current')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs flex-wrap" style={{ color: 'var(--color-text-tertiary)' }}>
                      <span>{t('builder.fieldCount', { count: version.field_count })}</span>
                      <span>·</span>
                      <span>{formatDate(version.created_at, t)}</span>
                      {version.published_at && (
                        <>
                          <span>·</span>
                          <span>{t('builder.publishedOn', { date: formatDate(version.published_at, t) })}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Action Column */}
                  <div className="flex sm:flex-col items-center justify-center gap-3 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}>
                    {/* View / Preview */}
                    {onPreview && (
                      <ActionButton
                        icon={
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        }
                        title={t('builder.previewVersion')}
                        onClick={() => onPreview(version)}
                      />
                    )}

                    {/* Edit / Create Draft */}
                    {version.status !== 'draft' && onCreateDraft && (
                      <ActionButton
                        icon={
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        }
                        title={t('builder.editAsNewDraft')}
                        onClick={() => onCreateDraft(version.id)}
                      />
                    )}

                    {/* Lock / Immutable (published only) */}
                    {version.status === 'published' && (
                      <ActionButton
                        icon={
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        }
                        title={t('builder.publishedImmutable')}
                        disabled
                      />
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
