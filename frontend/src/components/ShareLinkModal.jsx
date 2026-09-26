import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

// ─── QR Code Generator (pure client-side, no library needed) ─────
// Simple QR code that encodes the URL as a QR code using a canvas element
// We use a lightweight approach via QRServer API for simplicity
const QRCodeDisplay = ({ url, size = 180 }) => {
  return (
    <div className="relative">
      <img
        src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`}
        alt="QR Code"
        className="mx-auto rounded-xl"
        style={{ width: size, height: size }}
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />
    </div>
  );
};

// ─── Share Link Modal ──────────────────────────────────────────────
export const ShareLinkModal = ({ isOpen, onClose, publicUrl, formVersion, onCopy }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(null);

  // ─── Copy to clipboard ─────────────────────────────
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setCopyError(null);
      if (onCopy) onCopy();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      try {
        const textarea = document.createElement('textarea');
        textarea.value = publicUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopied(true);
        setCopyError(null);
        if (onCopy) onCopy();
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        setCopyError(t('builder.copyLinkFailed'));
      }
    }
  }, [publicUrl, onCopy]);

  // ─── Regenerate (reuse - close modal) ─────────────
  const handleClose = () => {
    setCopied(false);
    setCopyError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg"
          >
            <div
              className="card-surface p-6 md:p-8 rounded-2xl shadow-2xl border overflow-hidden"
              style={{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border)' }}
            >
              {/* Header */}
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  {t('builder.sharePublicForm')}
                </h2>
                <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('builder.shareLinkDesc')}
                </p>
              </div>

              {/* QR Code */}
              <div className="flex justify-center mb-5">
                <div className="p-4 rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--color-border)' }}>
                  <QRCodeDisplay url={publicUrl} size={170} />
                </div>
              </div>

              {/* URL Display */}
              <div className="mb-5">
                <label className="input-label text-xs mb-1.5 block" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('builder.publicFormUrl')}
                </label>
                <div
                  className="input-field flex items-center gap-2 px-3 py-2.5 rounded-xl border select-all cursor-text"
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-secondary)',
                  }}
                  onClick={(e) => {
                    const range = document.createRange();
                    range.selectNodeContents(e.currentTarget);
                    window.getSelection().removeAllRanges();
                    window.getSelection().addRange(range);
                  }}
                >
                  <svg className="w-4 h-4 flex-shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  <span className="text-sm font-mono truncate">{publicUrl}</span>
                </div>
              </div>

              {/* Version Badge */}
              <div className="flex items-center justify-center gap-2 mb-5">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)' }}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t('workflow.published')}
                </span>
                <span
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-mono font-bold"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}
                >
                  v{formVersion}
                </span>
              </div>

              {/* Copy Error */}
              {copyError && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 rounded-xl mb-4"
                  style={{ backgroundColor: 'var(--color-error-light)' }}
                >
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <span className="text-xs font-medium text-red-600">{copyError}</span>
                </motion.div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 btn-secondary gap-2 text-sm py-2.5"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  {t('common.close')}
                </button>

                <button
                  onClick={handleCopy}
                  className={`flex-1 gap-2 text-sm py-2.5 rounded-xl font-semibold transition-all duration-200 ${
                    copied
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                      : 'btn-primary'
                  }`}
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {t('common.copied')} ✓
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      {t('builder.copyLink')}
                    </>
                  )}
                </button>
              </div>

              {/* Hint text */}
              <p className="text-xs text-center mt-4 opacity-60" style={{ color: 'var(--color-text-tertiary)' }}>
                {t('builder.qrHint')}
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ShareLinkModal;
