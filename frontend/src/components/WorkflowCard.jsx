import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export const WorkflowCard = ({ currentStatus = 'draft' }) => {
  const { t } = useTranslation();

  const steps = [
    { key: 'draft', label: t('workflow.draft'), icon: '✏️', color: 'text-amber-500' },
    { key: 'published', label: t('workflow.published'), icon: '✅', color: 'text-emerald-500' },
    { key: 'archived', label: t('workflow.archived'), icon: '📦', color: 'text-red-500' },
  ];

  const currentIdx = steps.findIndex(s => s.key === currentStatus);

  const stepDesc = (key) => {
    if (key === 'draft') return t('workflow.draftDesc');
    if (key === 'published') return t('workflow.publishedDesc');
    return t('workflow.archivedDesc');
  };

  return (
    <div className="card-surface p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
        {t('workflow.title')}
      </h3>

      <div className="relative">
        {/* Vertical progress line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-0.5 rounded-full" style={{ backgroundColor: 'var(--color-border)' }} />

        {/* Active progress line */}
        {currentIdx >= 0 && (
          <div
            className="absolute left-[15px] top-2 w-0.5 rounded-full transition-all duration-500"
            style={{
              height: `${((currentIdx + 0.5) / (steps.length - 1)) * 100}%`,
              backgroundColor: currentIdx === 0 ? 'var(--color-warning)' :
                currentIdx === 1 ? 'var(--color-success)' :
                'var(--color-error)',
              maxHeight: currentIdx === 0 ? '25%' : currentIdx === 1 ? '75%' : '100%',
            }}
          />
        )}

        <div className="space-y-6">
          {steps.map((step, idx) => {
            const isActive = idx === currentIdx;
            const isPast = idx < currentIdx;
            const isFuture = idx > currentIdx;

            return (
              <div key={step.key} className="relative flex items-center gap-3 pl-8">
                {/* Dot */}
                <motion.div
                  initial={false}
                  animate={{
                    scale: isActive ? 1.3 : 1,
                    backgroundColor: isActive
                      ? (step.key === 'draft' ? '#f59e0b' : step.key === 'published' ? '#10b981' : '#ef4444')
                      : isPast ? 'var(--color-border)' : 'var(--color-card-bg)',
                    borderColor: isActive
                      ? (step.key === 'draft' ? '#f59e0b' : step.key === 'published' ? '#10b981' : '#ef4444')
                      : isPast ? 'var(--color-border)' : 'var(--color-border)',
                  }}
                  className="absolute left-[7px] w-4 h-4 rounded-full border-2 z-10 flex items-center justify-center"
                >
                  {isActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring" }}
                      className="w-1.5 h-1.5 rounded-full bg-white"
                    />
                  )}
                </motion.div>

                {/* Content */}
                <div className={`transition-all duration-300 ${isActive ? '' : isPast ? 'opacity-60' : 'opacity-40'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{step.icon}</span>
                    <span
                      className={`text-sm font-semibold ${isActive ? step.color : ''}`}
                      style={{ color: isActive ? undefined : 'var(--color-text-secondary)' }}
                    >
                      {step.label}
                    </span>
                    {isActive && (
                      <motion.span
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded"
                        style={{
                          backgroundColor: step.key === 'draft' ? 'var(--color-warning-light)' :
                            step.key === 'published' ? 'var(--color-success-light)' :
                            'var(--color-error-light)',
                          color: step.key === 'draft' ? 'var(--color-warning)' :
                            step.key === 'published' ? 'var(--color-success)' :
                            'var(--color-error)',
                        }}
                      >
                        {t('workflow.current')}
                      </motion.span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                    {stepDesc(step.key)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
