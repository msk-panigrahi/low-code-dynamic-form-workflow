import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export const PublishModal = ({ isOpen, onConfirm, onCancel, publishing, formTitle }) => {
  const { t } = useTranslation();
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && !publishing) onCancel?.();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onCancel, publishing]);

  const handleConfirm = async () => {
    await onConfirm();
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      onCancel();
    }, 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget && !publishing && !showSuccess) onCancel?.(); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-md"
          >
            {showSuccess ? (
              <div className="card-surface p-8 text-center" style={{ borderColor: 'var(--color-success)' }}>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 10, stiffness: 200 }}
                  className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
                  style={{ backgroundColor: 'var(--color-success-light)' }}
                >
                  <svg className="w-10 h-10 text-emerald-500 animate-checkmark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </motion.div>
                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-xl font-bold mb-2"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {t('builder.publishedSuccess')}
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-sm"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  {t('builder.nowLive', { formTitle })}
                </motion.p>
              </div>
            ) : (
              <div className="card-surface overflow-hidden">
                <div className="px-6 pt-6 pb-2 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 10, stiffness: 200 }}
                    className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                    style={{ backgroundColor: 'var(--color-success-light)' }}
                  >
                    <svg className="w-8 h-8 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                  </motion.div>
                  <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>{t('builder.publishConfirm')}</h3>
                  <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                    {t('builder.publishDesc1')}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {t('builder.publishDesc2')}
                  </p>
                  <div className="mt-4 p-3 rounded-xl" style={{ backgroundColor: 'var(--color-warning-light)' }}>
                    <p className="text-xs font-medium" style={{ color: 'var(--color-warning)' }}>
                      {t('builder.publishIrreversible')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 mt-4" style={{ borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-tertiary)' }}>
                  <button onClick={onCancel} className="btn-secondary" disabled={publishing}>
                    {t('common.cancel')}
                  </button>
                  <button onClick={handleConfirm} disabled={publishing} className="btn-success">
                    {publishing ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        {t('builder.publishing')}
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2L2 7l10 5 10-5-10-5z" />
                          <path d="M2 17l10 5 10-5" />
                          <path d="M2 12l10 5 10-5" />
                        </svg>
                        {t('common.publish')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
