import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export const ArchiveModal = ({ isOpen, onConfirm, onCancel, archiving }) => {
  const { t } = useTranslation();
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && !archiving) onCancel?.();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onCancel, archiving]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget && !archiving) onCancel?.(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-sm"
          >
            <div className="card-surface overflow-hidden">
              <div className="px-6 pt-6 pb-2 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 10, stiffness: 200, delay: 0.1 }}
                  className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ backgroundColor: 'var(--color-error-light)' }}
                >
                  <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 8V21H3V8" />
                    <rect x="1" y="3" width="22" height="5" rx="1" />
                    <line x1="10" y1="12" x2="14" y2="12" />
                  </svg>
                </motion.div>
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>{t('builder.archiveConfirm')}</h3>
                <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  {t('builder.archiveConfirmDesc1')}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  {t('builder.archiveConfirmDesc2')}
                </p>
                <div className="mt-4 p-3 rounded-xl" style={{ backgroundColor: 'var(--color-error-light)' }}>
                  <p className="text-xs font-medium text-red-600">
                    {t('builder.archiveReversible')}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 mt-4" style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-tertiary)' }}>
                <button onClick={onCancel} className="btn-secondary" disabled={archiving}>
                  {t('common.cancel')}
                </button>
                <button onClick={onConfirm} disabled={archiving} className="btn-danger">
                  {archiving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {t('builder.archiving')}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 8V21H3V8" />
                        <rect x="1" y="3" width="22" height="5" rx="1" />
                        <line x1="10" y1="12" x2="14" y2="12" />
                      </svg>
                      {t('common.archive')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
