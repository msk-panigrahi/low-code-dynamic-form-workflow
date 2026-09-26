import React, { useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

// ─── Confetti particles for the success animation ─────────────────
const ConfettiParticles = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    {['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6'].map((color, i) => (
      <div
        key={i}
        className="absolute w-2 h-2 rounded-full opacity-70 animate-confetti"
        style={{
          left: `${15 + i * 14}%`,
          top: '-5%',
          backgroundColor: color,
          animationDelay: `${i * 0.12}s`,
          animationDuration: `${1.2 + Math.random() * 0.8}s`,
        }}
      />
    ))}
  </div>
);

// ─── Response Success Page ──────────────────────────────────────
export const ResponseSuccess = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useState(false);

  // Retrieve confirmation data from router state
  const {
    response_id: responseId,
    submitted_at: submittedAt,
    form_name: formName,
    fields_submitted: fieldsSubmitted,
    files_uploaded: filesUploaded,
    uploaded_files: uploadedFiles,
  } = location.state || {};

  // ─── Copy handler ──────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    if (responseId) {
      navigator.clipboard.writeText(responseId).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        // Fallback
        const el = document.getElementById('response-id-text');
        if (el) {
          window.getSelection()?.selectAllChildren(el);
          document.execCommand('copy');
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      });
    }
  }, [responseId]);

  // ─── Format timestamp ──────────────────────────────────────────
  const formatTimestamp = (ts) => {
    if (!ts) return '';
    try {
      const date = /Z$|[+-]\d{2}:\d{2}$/.test(ts) ? new Date(ts) : new Date(ts + 'Z');
      return date.toLocaleString(i18n.language || 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return ts;
    }
  };

  // ─── Navigate back home ────────────────────────────────────────
  const handleGoHome = () => {
    navigate('/');
  };

  // ─── Navigate to submit another response ───────────────────────
  // This goes back to the form origin. Since we don't have the link_token
  // in state, we navigate to the dashboard.
  const handleSubmitAnother = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 md:p-6" style={{ backgroundColor: 'var(--color-bg)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg relative"
      >
        {/* Confetti decoration */}
        <ConfettiParticles />

        {/* Main Card */}
        <div
          className="card-surface rounded-2xl shadow-xl border overflow-hidden relative z-10"
          style={{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border)' }}
        >
          <div className="p-8 md:p-10 text-center">
            {/* ── Success Icon ───────────────────────────────────── */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 15 }}
              className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)',
              }}
            >
              <motion.svg
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.4, duration: 0.5, ease: 'easeOut' }}
                className="w-10 h-10 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </motion.svg>
            </motion.div>

            {/* ── Thank You Header ───────────────────────────────── */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="text-2xl md:text-3xl font-bold mb-2"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {t('publicForm.thankYou')}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.4 }}
              className="text-sm mb-6"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              {t('publicForm.submitted')}
            </motion.p>

            {/* ── Form Name ─────────────────────────────────────── */}
            {formName && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                className="mb-6"
              >
                <span
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                  {formName}
                </span>
              </motion.div>
            )}

            {/* ── Response ID ───────────────────────────────────── */}
            {responseId && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.4 }}
                className="mb-6 p-5 rounded-xl border"
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('publicForm.responseId')}
                </p>
                <div className="flex items-center gap-2">
                  <code
                    id="response-id-text"
                    className="flex-1 px-3 py-2.5 rounded-lg text-xs font-mono text-left break-all select-all"
                    style={{
                      backgroundColor: 'var(--color-card-bg)',
                      color: 'var(--color-text-primary)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {responseId}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="flex-shrink-0 p-2.5 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    style={{ color: 'var(--color-text-secondary)' }}
                    title={t('publicForm.copyResponseId')}
                  >
                    {copied ? (
                      <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </button>
                </div>
                {copied && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs mt-2 text-emerald-500 font-medium"
                  >
                    ✓ {t('publicForm.responseIdCopied')}
                  </motion.p>
                )}
              </motion.div>
            )}

            {/* ── Submitted Time ────────────────────────────────── */}
            {submittedAt && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="mb-6"
              >
                <div className="flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>{t('publicForm.submittedAt', { time: formatTimestamp(submittedAt) })}</span>
                </div>
              </motion.div>
            )}

            {/* ── Summary Stats ─────────────────────────────────── */}
            {(fieldsSubmitted !== undefined || filesUploaded !== undefined) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55, duration: 0.4 }}
                className="mb-6 flex items-center justify-center gap-4"
              >
                {fieldsSubmitted !== undefined && (
                  <div
                    className="px-4 py-2 rounded-xl text-center"
                    style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                  >
                    <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                      {fieldsSubmitted}
                    </p>
                    <p className="text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                      {t('publicForm.fieldsSubmitted')}
                    </p>
                  </div>
                )}
                {filesUploaded !== undefined && filesUploaded > 0 && (
                  <div
                    className="px-4 py-2 rounded-xl text-center"
                    style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                  >
                    <p className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                      {filesUploaded}
                    </p>
                    <p className="text-[10px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                      {t('publicForm.filesUploaded')}
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Uploaded Files Section ────────────────────────── */}
            {uploadedFiles && uploadedFiles.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.4 }}
                className="mb-6 p-4 rounded-xl border"
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  📎 {t('publicForm.uploadedFiles')}
                </p>
                <div className="space-y-2">
                  {uploadedFiles.map((fileInfo, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg"
                      style={{ backgroundColor: 'var(--color-card-bg)', border: '1px solid var(--color-border)' }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <svg className="w-5 h-5 flex-shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate max-w-[180px]" style={{ color: 'var(--color-text-primary)' }}>
                            {fileInfo.original_filename}
                          </p>
                          <p className="text-[10px] text-emerald-500 font-medium">
                            ✔ {t('publicForm.uploaded')}
                          </p>
                        </div>
                      </div>
                      <a
                        href={fileInfo.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-600"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        {t('common.download')}
                      </a>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Save Your Response ID Reminder ─────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="mb-8 p-4 rounded-xl"
              style={{ backgroundColor: 'var(--color-info-light)' }}
            >
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  {t('publicForm.saveIdReminder')}
                </p>
              </div>
            </motion.div>

            {/* ── Action Buttons ────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.4 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <button
                onClick={handleSubmitAnother}
                className="btn-primary gap-2 px-6 py-3 w-full sm:w-auto"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {t('publicForm.submitAnother')}
              </button>
              <button
                onClick={handleGoHome}
                className="btn-secondary gap-2 px-6 py-3 w-full sm:w-auto"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                {t('publicForm.backHome')}
              </button>
            </motion.div>
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.4 }}
          className="text-center text-xs mt-6"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          {t('publicForm.poweredBy')}
        </motion.p>
      </motion.div>
    </div>
  );
};

export default ResponseSuccess;
