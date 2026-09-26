import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { formService, analyticsService } from '../services';
import { useConditionalRules } from '../hooks/useConditionalRules';
import { useFormValidation, validateForm } from '../hooks/useFormValidation';

// ─── Field Icons Lookup ──────────────────────────────────────────────
const fieldIcons = {
  text: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  ),
  textarea: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  number: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  ),
  email: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  dropdown: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 10l4 4 4-4" /><rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
    </svg>
  ),
  checkbox: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" /><polyline points="9 12 11 14 15 10" />
    </svg>
  ),
  radio: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  date: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  file: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="15" x2="12" y2="21" /><line x1="9" y1="18" x2="15" y2="18" />
    </svg>
  ),
  password: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  rating: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
};

const typeColors = {
  text: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30',
  textarea: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/30',
  number: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30',
  email: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/30',
  dropdown: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/30',
  checkbox: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30',
  radio: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-500/30',
  date: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/30',
  file: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30',
  password: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/30',
  rating: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30',
};

// ─── Skeleton Loader ────────────────────────────────────────────────
const SkeletonLoader = () => (
  <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--color-bg)' }}>
    <div className="w-full max-w-2xl">
      <div className="card-surface p-8 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="space-y-2 flex-1">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse w-2/3" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse w-1/3" />
          </div>
        </div>
        <div className="flex gap-2 mb-8">
          <div className="h-7 w-24 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
          <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="mb-4 p-5 rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse w-1/4 mb-3" />
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          </div>
        ))}
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse mt-6" />
      </div>
    </div>
  </div>
);

// ─── Invalid Link Page ─────────────────────────────────────────────
const InvalidLinkPage = ({ onGoHome }) => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--color-bg)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-md"
      >
        <div className="w-24 h-24 rounded-3xl mx-auto mb-6 flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-error-light)' }}>
          <svg className="w-12 h-12 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>{t('publicForm.formNotFound')}</h1>
        <p className="text-base mb-8" style={{ color: 'var(--color-text-tertiary)' }}>{t('publicForm.linkInvalid')}</p>
        <button onClick={onGoHome} className="btn-primary gap-2 px-6 py-3 text-sm">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          {t('publicForm.goHome')}
        </button>
      </motion.div>
    </div>
  );
};

// ─── File Preview Icons ─────────────────────────────────────────────
const ImagePreviewIcon = ({ src, alt }) => {
  const [imgError, setImgError] = useState(false);
  if (imgError) {
    return (
      <div className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
        <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>
    );
  }
  return (
    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        onError={() => setImgError(true)}
      />
    </div>
  );
};

const PdfFileIcon = () => (
  <div className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
    <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M16 15H8" /><path d="M16 18H8" /><path d="M10 12H8" /><path d="M16 12h-2" />
    </svg>
  </div>
);

const GenericFileIcon = () => (
  <div className="w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
    <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  </div>
);

// ─── File Preview Modal ────────────────────────────────────────────
const FilePreviewModal = ({ file, previewUrl, onClose }) => {
  const { t } = useTranslation();
  const modalRef = useRef(null);
  const ext = file.name.split('.').pop()?.toLowerCase();
  const isPreviewableImage = PREVIEW_IMAGE_EXTS.includes(ext);
  const isPdf = ext === 'pdf';
  const isTextPreviewable = ext === 'txt' || ext === 'csv' || ext === 'json' || ext === 'xml' || ext === 'log';

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleBackdropClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={t('publicForm.previewFile', { name: file.name })}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: 'var(--color-card-bg)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {isPreviewableImage ? (
              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
              </div>
            ) : isPdf ? (
              <PdfFileIcon />
            ) : (
              <GenericFileIcon />
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate max-w-[300px]" style={{ color: 'var(--color-text-primary)' }}>
                {file.name}
              </h3>
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                {(file.size / 1024).toFixed(1)} KB &middot; {file.type || ext.toUpperCase() || t('publicForm.unknownType')}
              </p>
            </div>
          </div>            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label={t('publicForm.closePreview')}
              title={t('common.close')}
              type="button"
            >
            <svg className="w-5 h-5" style={{ color: 'var(--color-text-tertiary)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center min-h-[300px]" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
          {isPreviewableImage && previewUrl ? (
            <img
              src={previewUrl}
              alt={file.name}
              className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-lg"
            />
          ) : isPdf ? (
            <div className="text-center py-12">
              <PdfFileIcon />
              <p className="mt-4 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                {t('publicForm.pdfHint')}
              </p>
              <button
                onClick={() => {
                  const pdfUrl = URL.createObjectURL(file);
                  window.open(pdfUrl, '_blank');
                }}
                className="mt-4 btn-primary gap-2 text-sm"
                type="button"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                {t('publicForm.openPdf')}
              </button>
            </div>
          ) : isTextPreviewable ? (
            <div className="text-center py-12">
              <GenericFileIcon />
              <p className="mt-4 text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                {t('publicForm.textHint')}
              </p>
              <button
                onClick={() => {
                  const textUrl = URL.createObjectURL(file);
                  window.open(textUrl, '_blank');
                }}
                className="mt-4 btn-primary gap-2 text-sm"
                type="button"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                {t('publicForm.openFile')}
              </button>
            </div>
          ) : (
            <div className="text-center py-12 max-w-sm">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                <svg className="w-8 h-8" style={{ color: 'var(--color-text-tertiary)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                {t('publicForm.previewNotAvailable')}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                {t('publicForm.fileLabel', { name: file.name, size: (file.size / 1024).toFixed(1), ext })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── File Upload Field Component ────────────────────────────────────
const SUPPORTED_IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const PREVIEW_IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];

const FileUploadField = ({ field, fileObj, onFileChange, onBlur, isDisabled, hasError, errorBorderColor }) => {
  const { t } = useTranslation();
  const config = field.config || {};
  const allowedTypes = config.allowedTypes || [];
  const maxSize = config.maximumSize; // in bytes
  const allowMultiple = config.multiple === true;

  const [clientFileError, setClientFileError] = useState(null);
  const [objectUrls, setObjectUrls] = useState({});
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);
  const objectUrlsRef = useRef({});

  // Track object URLs for cleanup
  useEffect(() => {
    objectUrlsRef.current = objectUrls;
  }, [objectUrls]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(objectUrlsRef.current).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  // Show allowed types info
  const displayAllowedTypes = allowedTypes.length > 0
    ? allowedTypes.join(', ')
    : t('publicForm.allFileTypes');

  // Show max size info
  const displayMaxSize = maxSize
    ? `${(Number(maxSize) / (1024 * 1024)).toFixed(0)} MB`
    : null;

  const isImageFile = useCallback((file) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    return SUPPORTED_IMAGE_EXTS.includes(ext);
  }, []);

  const isPdfFile = useCallback((file) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ext === 'pdf';
  }, []);

  const createPreviewUrl = useCallback((file) => {
    // Only create object URLs for image files that can be previewed
    if (isImageFile(file)) {
      return URL.createObjectURL(file);
    }
    return null;
  }, [isImageFile]);

  const formatFileSize = useCallback((bytes) => {
    if (bytes == null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  // Get selected files as a normalized array
  const selectedFiles = useMemo(() => {
    if (allowMultiple) {
      return Array.isArray(fileObj) ? fileObj : [];
    }
    return fileObj instanceof File ? [fileObj] : [];
  }, [fileObj, allowMultiple]);

  const hasSelection = selectedFiles.length > 0;

  // Validate a single file and return error message or null
  const validateSingleFile = useCallback((file) => {
    if (!file) return null;

    // Extension validation
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (allowedTypes.length > 0) {
      const allowedLower = allowedTypes.map((t) => t.toLowerCase().replace(/^\./, ''));
      if (!allowedLower.includes(ext)) {
        return t('publicForm.unsupportedFileType');
      }
    }

    // Size validation
    if (maxSize && file.size > Number(maxSize)) {
      const maxMB = (Number(maxSize) / (1024 * 1024)).toFixed(0);
      return t('publicForm.maxFileSize', { size: maxMB });
    }

    return null;
  }, [allowedTypes, maxSize]);

  const handleFileSelect = useCallback((fileList) => {
    if (!fileList || fileList.length === 0) return;

    if (allowMultiple) {
      // Multiple files mode
      const filesArray = Array.from(fileList);
      const currentFiles = Array.isArray(fileObj) ? [...fileObj] : [];
      const newObjectUrls = {};
      const errors = [];

      for (const file of filesArray) {
        const error = validateSingleFile(file);
        if (error) {
          errors.push(`${file.name}: ${error}`);
          continue;
        }
        currentFiles.push(file);
        const url = createPreviewUrl(file);
        if (url) {
          newObjectUrls[file.name] = url;
        }
      }

      if (errors.length > 0) {
        setClientFileError(errors.join('. '));
      } else {
        setClientFileError(null);
      }

      setObjectUrls((prev) => ({ ...prev, ...newObjectUrls }));

      if (currentFiles.length > 0) {
        onFileChange(field.id, currentFiles);
      }

      // Reset input value
      if (fileInputRef.current) fileInputRef.current.value = '';
      onBlur(field.id);
    } else {
      // Single file mode (existing behavior)
      const file = fileList[0];
      if (!file) {
        setClientFileError(null);
        onFileChange(field.id, null);
        return;
      }

      // Validate
      const error = validateSingleFile(file);
      if (error) {
        setClientFileError(error);
        onFileChange(field.id, null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        onBlur(field.id);
        return;
      }

      // Revoke previous object URL before creating new one
      Object.values(objectUrls).forEach((url) => URL.revokeObjectURL(url));

      const url = createPreviewUrl(file);
      setObjectUrls(url ? { [file.name]: url } : {});
      setClientFileError(null);
      onFileChange(field.id, file);
      onBlur(field.id);

      // Reset input value so the same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [allowMultiple, fileObj, validateSingleFile, createPreviewUrl, objectUrls, onFileChange, onBlur, field.id]);

  const handleChange = useCallback((e) => {
    handleFileSelect(e.target.files);
  }, [handleFileSelect]);

  const handleRemoveSingleFile = useCallback((e, fileToRemove) => {
    e.stopPropagation();

    // Revoke object URL for this file
    if (objectUrls[fileToRemove.name]) {
      URL.revokeObjectURL(objectUrls[fileToRemove.name]);
      setObjectUrls((prev) => {
        const next = { ...prev };
        delete next[fileToRemove.name];
        return next;
      });
    }

    if (allowMultiple) {
      const current = Array.isArray(fileObj) ? fileObj : [];
      const remaining = current.filter((f) => f !== fileToRemove && f.name !== fileToRemove.name);
      onFileChange(field.id, remaining.length > 0 ? remaining : null);
    } else {
      // Revoke all object URLs for single file mode
      Object.values(objectUrls).forEach((url) => URL.revokeObjectURL(url));
      setObjectUrls({});
      setClientFileError(null);
      onFileChange(field.id, null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [allowMultiple, fileObj, objectUrls, onFileChange, field.id]);

  const handleRemoveAllFiles = useCallback((e) => {
    e.stopPropagation();
    // Revoke all object URLs
    Object.values(objectUrls).forEach((url) => URL.revokeObjectURL(url));
    setObjectUrls({});
    setClientFileError(null);
    onFileChange(field.id, null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [objectUrls, onFileChange, field.id]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDisabled) setIsDragOver(true);
  }, [isDisabled]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (isDisabled) return;
    const droppedFiles = e.dataTransfer?.files;
    if (droppedFiles && droppedFiles.length > 0) {
      handleFileSelect(droppedFiles);
    }
  }, [isDisabled, handleFileSelect]);

  // ─── Preview handlers ───────────────────────────────────────
  const handleOpenPreview = useCallback((e, file) => {
    e.stopPropagation();
    const ext = file.name.split('.').pop()?.toLowerCase();
    const isPreviewableImage = PREVIEW_IMAGE_EXTS.includes(ext);

    if (isPreviewableImage) {
      // Create a dedicated object URL for the modal preview
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setPreviewFile(file);
    } else if (ext === 'pdf' || ext === 'txt' || ext === 'csv' || ext === 'json' || ext === 'xml' || ext === 'log') {
      // For PDF/text files, open directly in a new tab
      const url = URL.createObjectURL(file);
      window.open(url, '_blank');
      // Revoke the URL after a delay to let the new tab load
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } else {
      // For unsupported types, show the info modal
      setPreviewUrl(null);
      setPreviewFile(file);
    }
  }, []);

  const handleClosePreview = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewFile(null);
  }, [previewUrl]);

  const effectiveError = hasError || !!clientFileError;
  const borderColor = effectiveError ? errorBorderColor : 'var(--color-border)';

  return (
    <div>
      <div
        onClick={() => !isDisabled && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        aria-label={allowMultiple ? t('publicForm.uploadAriaMany') : t('publicForm.uploadAriaOne')}
        onKeyDown={(e) => {
          if (!isDisabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`w-full rounded-xl border-2 border-dashed text-center transition-all duration-200 ${
          isDisabled
            ? 'opacity-60 cursor-not-allowed'
            : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30'
        } ${
          isDragOver && !isDisabled
            ? 'border-indigo-400 bg-indigo-50/50 dark:bg-indigo-500/10 scale-[1.01]'
            : ''
        }`}
        style={{
          backgroundColor: isDragOver && !isDisabled ? undefined : 'var(--color-bg-tertiary)',
          borderColor: isDragOver && !isDisabled
            ? '#818cf8'
            : hasSelection && !effectiveError
              ? 'var(--color-success)'
              : borderColor,
          padding: hasSelection ? '16px' : '28px 20px',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleChange}
          disabled={isDisabled}
          multiple={allowMultiple}
          className="hidden"
          id={`file-${field.id}`}
          accept={allowedTypes.length > 0 ? allowedTypes.join(',') : undefined}
        />
        <label htmlFor={`file-${field.id}`} className="cursor-pointer block">
          {hasSelection ? (
            <>
              {/* Selected state: show file previews */}
              <div className="space-y-2">
                {selectedFiles.map((file, idx) => {
                  const isImage = isImageFile(file);
                  const isPdf = isPdfFile(file);
                  const previewUrl = objectUrls[file.name];

                  return (
                    <div
                      key={`${file.name}-${file.size}-${idx}`}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all duration-200 group/file-card"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* File icon / thumbnail */}
                        {isImage && previewUrl ? (
                          <ImagePreviewIcon src={previewUrl} alt={file.name} />
                        ) : isPdf ? (
                          <PdfFileIcon />
                        ) : (
                          <GenericFileIcon />
                        )}

                        {/* File info */}
                        <div className="flex flex-col items-start min-w-0">
                          <span className="text-sm font-medium truncate max-w-[200px]" style={{ color: 'var(--color-text-primary)' }}>
                            {file.name}
                          </span>
                          <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                            <span>{formatFileSize(file.size)}</span>
                            {isImage && <span className="px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">{t('publicForm.preview')}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Preview button */}
                      <button
                        onClick={(e) => handleOpenPreview(e, file)}
                        className="flex-shrink-0 p-2 rounded-lg opacity-60 hover:opacity-100 bg-transparent hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all duration-200 group/pv-btn"
                        title={t('publicForm.previewFile', { name: file.name })}
                        aria-label={t('publicForm.previewFile', { name: file.name })}
                        type="button"
                      >
                        <svg className="w-4 h-4 text-gray-400 group-hover/pv-btn:text-blue-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>

                      {/* Remove button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (allowMultiple && selectedFiles.length > 1) {
                            handleRemoveSingleFile(e, file);
                          } else {
                            handleRemoveAllFiles(e);
                          }
                        }}
                        className="flex-shrink-0 p-2 rounded-lg opacity-60 hover:opacity-100 bg-transparent hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-200 group/rm-btn"
                        title={t('publicForm.removeFile', { name: file.name })}
                        aria-label={t('publicForm.removeFile', { name: file.name })}
                        type="button"
                      >
                        <svg className="w-4 h-4 text-gray-400 group-hover/rm-btn:text-red-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  );
                })}

                {/* Add more files button for multiple mode */}
                {allowMultiple && !isDisabled && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-all duration-200 cursor-pointer group"
                  >
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span className="text-xs font-medium text-gray-400 group-hover:text-indigo-500 transition-colors">
                      {t('publicForm.addMoreFiles')}
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Idle state: upload prompt */}
              <div className="flex flex-col items-center gap-3">
                {/* Upload icon */}
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                  isDragOver
                    ? 'bg-indigo-100 dark:bg-indigo-500/20 scale-110'
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  <svg className={`w-7 h-7 transition-all duration-200 ${
                    isDragOver
                      ? 'text-indigo-500'
                      : 'text-gray-400'
                  }`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                    {isDragOver ? t('publicForm.dropFilesHere') : (allowMultiple ? t('publicForm.clickToUploadMany') : t('publicForm.clickToUploadOne'))}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                    {allowMultiple ? t('publicForm.dragAndDropMany') : t('publicForm.dragAndDropOne')}
                  </p>
                </div>

                {/* Info badges */}
                <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border"
                    style={{
                      backgroundColor: 'var(--color-bg-secondary)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    {displayAllowedTypes}
                  </span>
                  {displayMaxSize && (
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border"
                      style={{
                        backgroundColor: 'var(--color-bg-secondary)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-tertiary)',
                      }}
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
                      </svg>
                      {t('publicForm.maxSizeBadge', { size: displayMaxSize })}
                    </span>
                  )}
                  {allowMultiple && (
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border"
                      style={{
                        backgroundColor: 'var(--color-purple-light)',
                        borderColor: 'var(--color-purple)',
                        color: 'var(--color-purple)',
                      }}
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M3 16v5h5" /><path d="M16 21h5v-5" />
                      </svg>
                      {t('publicForm.multipleFiles')}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </label>
      </div>

      {/* Error message */}
      {clientFileError && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 text-xs font-medium flex items-center gap-1.5"
          style={{ color: 'var(--color-error)' }}
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {clientFileError}
        </motion.p>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          previewUrl={previewUrl}
          onClose={handleClosePreview}
        />
      )}
    </div>
  );
};

// ─── Render Field Based on Type ─────────────────────────────────────
const PublicFieldRenderer = ({ field, value, onChange, fieldState, errors, onBlur, fileObjects }) => {
  const { t } = useTranslation();
  const { label, type, config } = field;
  const icon = fieldIcons[type] || fieldIcons.text;
  const colorClass = typeColors[type] || 'bg-gray-50 text-gray-700 border-gray-200';

  // Determine effective state: static required from config OR rule-required
  const isRequired = fieldState?.required || field.is_required;
  const isDisabled = fieldState?.disabled || false;
  const isHidden = fieldState?.visible === false;

  // Field errors
  const fieldErrors = errors?.[field.id] || [];
  const hasError = fieldErrors.length > 0;

  // Hidden fields should not render at all
  if (isHidden) return null;

  const handleChange = (e) => {
    let val;
    const target = e.target;
    if (type === 'checkbox' && config?.options?.length) {
      // Multi-checkbox: get checked values
      const checked = target.checked;
      const optValue = target.value;
      const current = Array.isArray(value) ? value : [];
      if (checked) {
        val = [...current, optValue];
      } else {
        val = current.filter((v) => v !== optValue);
      }
    } else if (type === 'checkbox' && !config?.options?.length) {
      // Single checkbox
      val = target.checked;
    } else {
      val = target.value;
    }
    onChange(field.id, val);
  };

  const handleBlur = (e) => {
    onBlur?.(field.id);
  };

  const renderInput = () => {
    const errorBorderColor = 'var(--color-error, #ef4444)';
    const inputClass = `w-full px-4 py-2.5 rounded-xl border text-sm transition-all duration-200
      focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400
      ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-indigo-300'}
    `;
    const inputStyle = {
      backgroundColor: isDisabled ? 'var(--color-bg-tertiary)' : 'var(--color-input-bg)',
      borderColor: hasError ? errorBorderColor : 'var(--color-input-border)',
      color: 'var(--color-text-primary)',
    };

    switch (type) {
      case 'text':
      case 'textarea':
        if (type === 'textarea') {
          return (
            <textarea
              rows={3}
              value={value ?? ''}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isDisabled}
              placeholder={config?.placeholder || t('publicForm.enterLabel', { label: label.toLowerCase() })}
              className={`${inputClass} resize-none`}
              style={inputStyle}
            />
          );
        }
        return (
          <input
            type="text"
            value={value ?? ''}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isDisabled}
            placeholder={config?.placeholder || `Enter ${label.toLowerCase()}`}
            className={inputClass}
            style={inputStyle}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value ?? ''}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isDisabled}
            placeholder={config?.placeholder || '0'}
            className={inputClass}
            style={inputStyle}
          />
        );

      case 'email':
        return (
          <input
            type="email"
            value={value ?? ''}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isDisabled}
            placeholder={config?.placeholder || 'email@example.com'}
            className={inputClass}
            style={inputStyle}
          />
        );

      case 'password':
        return (
          <input
            type="password"
            value={value ?? ''}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isDisabled}
            placeholder={config?.placeholder || t('publicForm.enterPassword')}
            className={inputClass}
            style={inputStyle}
          />
        );

      case 'dropdown': {
        const options = config?.options || [];
        return (
          <div className="relative">
            <select
              value={value ?? ''}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isDisabled}
              className={`${inputClass} appearance-none pr-10 ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              style={{
                ...inputStyle,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238892a6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                backgroundSize: '16px',
              }}
            >
              <option value="">{t('publicForm.selectOption')}</option>
              {options.map((opt, i) => (
                <option key={i} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        );
      }

      case 'radio': {
        const options = config?.options || [];
        return (
          <div className="space-y-2">
            {options.map((opt, i) => (
              <label key={i} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${isDisabled ? 'opacity-60' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                <input
                  type="radio"
                  name={`field-${field.id}`}
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  disabled={isDisabled}
                  className="w-4 h-4 accent-indigo-500"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        );
      }

      case 'checkbox':
      case 'multi_checkbox': {
        const options = config?.options || [];
        if (options.length === 0) {
          // Single checkbox
          return (
            <label className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${isDisabled ? 'opacity-60' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
              <input
                type="checkbox"
                checked={!!value}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={isDisabled}
                className="w-4 h-4 rounded accent-indigo-500"
              />
              <span className="text-sm">{config?.checkboxLabel || label}</span>
            </label>
          );
        }
        return (
          <div className="space-y-2">
            {options.map((opt, i) => {
              const checked = Array.isArray(value) && value.includes(opt.value);
              return (
                <label key={i} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${isDisabled ? 'opacity-60' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                  <input
                    type="checkbox"
                    value={opt.value}
                    checked={checked}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    disabled={isDisabled}
                    className="w-4 h-4 rounded accent-indigo-500"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              );
            })}
          </div>
        );
      }

      case 'date':
        return (
          <input
            type="date"
            value={value ?? ''}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isDisabled}
            className={inputClass}
            style={inputStyle}
          />
        );

      case 'rating': {
        const maxStars = config?.maximumStars || 5;
        const currentRating = parseInt(value) || 0;
        return (
          <div className="flex gap-1.5">
            {Array.from({ length: maxStars }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (!isDisabled) {
                    onChange(field.id, String(i + 1));
                    handleBlur({});
                  }
                }}
                disabled={isDisabled}
                className={`p-1 transition-all duration-150 ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-110'}`}
              >
                <svg
                  className={`w-7 h-7 transition-colors duration-150 ${i < currentRating ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
                  viewBox="0 0 24 24"
                  fill={i < currentRating ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            ))}
          </div>
        );
      }

      case 'file':
        // File fields use a custom file change handler.
        // Pass the actual File object from fileObjects (not the formValues string)
        return <FileUploadField
          field={field}
          fileObj={fileObjects?.[field.id] || null}
          onFileChange={onChange}
          onBlur={handleBlur}
          isDisabled={isDisabled}
          hasError={hasError}
          errorBorderColor={errorBorderColor}
        />;

      default:
        return (
          <input
            type="text"
            value={value ?? ''}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isDisabled}
            placeholder={config?.placeholder || `Enter ${label.toLowerCase()}`}
            className={inputClass}
            style={inputStyle}
          />
        );
    }
  };

  return (
    <motion.div
      id={`field-${field.id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: field.order * 0.05, duration: 0.3 }}
      className={`p-5 rounded-xl border transition-all duration-200 ${hasError ? 'border-red-400/50' : ''}`}
      style={{
        backgroundColor: 'var(--color-card-bg)',
        borderColor: hasError ? 'var(--color-error)' : 'var(--color-border)',
      }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <div className={`p-1 rounded-md ${colorClass}`}>
          {icon}
        </div>
        <label className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {label}
          {isRequired && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${colorClass} ml-auto`}>
          {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
        </span>
        {isDisabled && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600">
            {t('publicForm.disabled')}
          </span>
        )}
      </div>
      {renderInput()}
      {/* Validation Error Messages */}
      {hasError && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2"
        >
          {fieldErrors.map((errMsg, idx) => (
            <p
              key={idx}
              className="text-xs font-medium"
              style={{ color: 'var(--color-error)' }}
            >
              {errMsg}
            </p>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
};

// ─── Public Form Page ──────────────────────────────────────────────
export const PublicFormPage = () => {
  const { link_token } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState(null);
  const [fields, setFields] = useState([]);
  const [version, setVersion] = useState(null);
  const [formId, setFormId] = useState(null);

  // Form values state
  const [formValues, setFormValues] = useState({});

  // File objects state (separate from formValues for File object tracking)
  const [fileObjects, setFileObjects] = useState({});

  // Upload progress tracking
  const [uploadProgress, setUploadProgress] = useState(null);

  // Uploaded file metadata from server response
  const [uploadedFiles, setUploadedFiles] = useState([]);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [responseId, setResponseId] = useState(null);
  const [copied, setCopied] = useState(false);

  // Idempotency key for preventing duplicate submissions
  const idempotencyKeyRef = useRef(crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

  // Analytics: started-session tracking (Day 14). sessionInfo is captured when
  // the form opens and forwarded with the submission for completion-time math.
  const sessionRef = useRef(null);

  // Load conditional rules and get field states
  const { fieldStates } = useConditionalRules(formId, formValues);

  // Form validation hook
  const {
    errors: displayErrors,
    allErrors,
    touchField,
    touchAllFields,
    setServerErrors,
    resetValidation,
    hasErrors,
  } = useFormValidation(fields, formValues, fieldStates);

  // Track previously hidden fields to clear their values
  const prevHiddenFieldsRef = useRef(new Set());

  // Clear values of hidden fields
  useEffect(() => {
    const currentHidden = new Set(
      Object.entries(fieldStates)
        .filter(([, state]) => state.visible === false)
        .map(([fid]) => Number(fid)),
    );

    // Find fields that were just hidden
    const justHidden = [...currentHidden].filter(
      (fid) => !prevHiddenFieldsRef.current.has(fid),
    );

    if (justHidden.length > 0) {
      setFormValues((prev) => {
        const next = { ...prev };
        for (const fid of justHidden) {
          delete next[fid];
        }
        return next;
      });
      // Also clear validation errors for hidden fields
      resetValidation();
    }

    prevHiddenFieldsRef.current = currentHidden;
  }, [fieldStates, resetValidation]);

  // Forget the tracked session for this link after a successful submission,
  // so the NEXT time the respondent opens the form it counts as a fresh
  // started session with a new started_at (not the original one).
  const clearTrackedSession = useCallback((token) => {
    try {
      window.sessionStorage.removeItem(`formflow:session:${token}`);
    } catch (e) {
      // non-fatal
    }
    sessionRef.current = null;
  }, []);

  // Track a started session whenever the public form opens (fire-and-forget).
  // Must never block or break form loading.
  //
  // The session id is persisted in sessionStorage (keyed by link token) so a
  // single visitor opening the form once counts as ONE started session — even
  // if React StrictMode double-invokes the mount effect.
  //
  // Reuse is restricted to sessions created within the last 5 minutes. A
  // returning visitor who reopens the form later mints a fresh session so
  // their completion time is measured from the CURRENT open, not the first.
  // The stored entry is cleared on successful submission (see handleSubmit).
  const trackStartedSession = useCallback((token) => {
    try {
      const storageKey = `formflow:session:${token}`;
      let sessionInfo = null;
      try {
        const raw = window.sessionStorage.getItem(storageKey);
        if (raw) sessionInfo = JSON.parse(raw);
      } catch (e) {
        sessionInfo = null;
      }

      const isRecent =
        sessionInfo?.started_at &&
        Date.now() - new Date(sessionInfo.started_at).getTime() < 5 * 60 * 1000;

      if (sessionInfo?.session_id && isRecent) {
        // Already tracked for this tab + link: reuse it and do NOT re-track.
        sessionRef.current = {
          session_id: sessionInfo.session_id,
          started_at: sessionInfo.started_at,
        };
        return;
      }

      const sessionId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const startedAt = new Date().toISOString();
      sessionRef.current = { session_id: sessionId, started_at: startedAt };
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(sessionRef.current));
      } catch (e) {
        // sessionStorage unavailable (private mode etc.) — tracking still works
        // for this page load, just without reload-dedup.
      }
      analyticsService.trackSession(token, sessionId, startedAt);
    } catch (err) {
      // Non-fatal: analytics should never interrupt the public form.
      console.warn('Failed to start analytics session:', err);
    }
  }, []);

  useEffect(() => {
    fetchPublicForm();
  }, [link_token]);

  const fetchPublicForm = async () => {
    if (!link_token) return;
    try {
      setLoading(true);
      setError(null);
      const data = await formService.getPublicForm(link_token);
      if (data.success) {
        setFormData(data.form);
        const sortedFields = (data.fields || []).sort((a, b) => a.order - b.order);
        setFields(sortedFields);
        setVersion(data.version);

        // Extract formId from response (may be in form object)
        if (data.form?.id) {
          setFormId(data.form.id);
        }

        // Analytics: record that this public form was opened (non-blocking)
        trackStartedSession(link_token);

        // Initialize form values from field defaults
        const initialValues = {};
        for (const f of sortedFields) {
          if (f.type === 'checkbox' && !f.config?.options?.length) {
            initialValues[f.id] = false;
          } else if (f.type === 'number') {
            initialValues[f.id] = '';
          } else {
            initialValues[f.id] = '';
          }
        }
        setFormValues(initialValues);
      } else {
        setError(t('publicForm.invalidLink'));
      }
    } catch (err) {
      console.error('Error fetching public form:', err);
      if (err.response?.status === 404) {
        setError('not_found');
      } else {
        setError(err.response?.data?.detail || t('publicForm.failedLoadServer'));
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Field change handler ─────────────────────────────────────
  const handleFieldChange = useCallback((fieldId, value) => {
    // Check if this is a file field (value is File, array of Files, or null)
    // IMPORTANT: For multi-file arrays, we verify value[0] instanceof File
    // to prevent catching checkbox arrays (which are string[] not File[]).
    if (value instanceof File) {
      // Single file - store File object separately and validation string in formValues
      setFileObjects((prev) => ({ ...prev, [fieldId]: value }));
      setFormValues((prev) => ({
        ...prev,
        [fieldId]: `${value.name}||${value.size}`,
      }));
    } else if (value === null) {
      // File removed- clear both fileObjects and formValues
      setFileObjects((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
      setFormValues((prev) => ({ ...prev, [fieldId]: '' }));
    } else if (Array.isArray(value) && value.length > 0 && value[0] instanceof File) {
      // Multiple files (all elements are File instances, not checkbox strings)
      setFileObjects((prev) => ({ ...prev, [fieldId]: value }));
      setFormValues((prev) => ({
        ...prev,
        [fieldId]: value.map((f) => `${f.name}||${f.size}`).join(','),
      }));
    } else {
      // Regular field value (text, number, checkbox array, dropdown, etc.)
      setFormValues((prev) => ({ ...prev, [fieldId]: value }));
    }
  }, []);

  // ─── Blur handler ──────────────────────────────────────────────
  const handleFieldBlur = useCallback((fieldId) => {
    touchField(fieldId);
  }, [touchField]);

  // ─── Submit handler ────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    // Prevent duplicate submissions while processing
    if (submitting) return;

    // Mark all visible fields as touched and validate
    touchAllFields();

    // Compute errors synchronously from current formValues to avoid stale closure
    const syncErrors = validateForm(fields, formValues, fieldStates);

    // Client-side validation: check if there are any errors
    if (Object.keys(syncErrors).length > 0) {
      // Scroll to first error
      const firstErrorField = fields.find((f) => syncErrors[f.id]);
      if (firstErrorField) {
        const el = document.getElementById(`field-${firstErrorField.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    try {
      setSubmitting(true);
      setUploadProgress(0);

      if (link_token && formId) {
        // Check if there are file fields with files selected
        const hasFiles = Object.keys(fileObjects).length > 0;

        if (hasFiles) {
          // ── Multipart submission with files ──────────────────────
          const fileFields = [];
          for (const [fieldId, fileOrArray] of Object.entries(fileObjects)) {
            if (Array.isArray(fileOrArray)) {
              // Multiple files per field
              for (const file of fileOrArray) {
                fileFields.push({
                  fieldId: Number(fieldId),
                  file,
                });
              }
            } else if (fileOrArray instanceof File) {
              // Single file per field
              fileFields.push({
                fieldId: Number(fieldId),
                file: fileOrArray,
              });
            }
          }

          setUploadProgress(0);
          const response = await formService.submitFormWithFiles(
            link_token,
            formValues,
            fileFields,
            (pct) => setUploadProgress(pct),
            idempotencyKeyRef.current,
            sessionRef.current,
          );
          setUploadProgress(100);

          if (response.success) {
            // Analytics: this session is now completed — forget it so a future
            // visit starts a brand-new session with a fresh started_at.
            clearTrackedSession(link_token);
            navigate('/submitted', {
              state: {
                response_id: response.response_id || null,
                submitted_at: response.submitted_at || new Date().toISOString(),
                form_name: formData?.title || null,
                fields_submitted: response.summary?.fields_submitted,
                files_uploaded: response.summary?.files_uploaded,
                uploaded_files: response.files || [],
              },
            });
          } else {
            // Backend returned validation errors
            console.log('Backend validation errors:', response.errors);
            setServerErrors(response.errors || {});

            if (response.errors) {
              const firstErrorId = Number(Object.keys(response.errors)[0]);
              const el = document.getElementById(`field-${firstErrorId}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        } else {
          // ── JSON submission (no files) ───────────────────────────
          const payload = { form_values: formValues };
          if (sessionRef.current?.session_id) {
            payload.session_id = sessionRef.current.session_id;
            payload.started_at = sessionRef.current.started_at;
          }
          console.log('Submitting Payload:', JSON.stringify(payload, null, 2));

          const response = await formService.submitForm(link_token, payload, idempotencyKeyRef.current);

          if (response.success) {
            // Analytics: this session is now completed — forget it so a future
            // visit starts a brand-new session with a fresh started_at.
            clearTrackedSession(link_token);
            navigate('/submitted', {
              state: {
                response_id: response.response_id || null,
                submitted_at: response.submitted_at || new Date().toISOString(),
                form_name: formData?.title || null,
                fields_submitted: response.summary?.fields_submitted,
                files_uploaded: response.summary?.files_uploaded,
                uploaded_files: response.files || [],
              },
            });
          } else {
            console.log('Backend validation errors:', response.errors);
            setServerErrors(response.errors || {});

            if (response.errors) {
              const firstErrorId = Number(Object.keys(response.errors)[0]);
              const el = document.getElementById(`field-${firstErrorId}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }
      } else {
        // Fallback if no backend available
        await new Promise((resolve) => setTimeout(resolve, 500));
        clearTrackedSession(link_token);
        navigate('/submitted', {
          state: {
            response_id: null,
            submitted_at: new Date().toISOString(),
            form_name: formData?.title || null,
          },
        });
      }
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      console.error(`Submission error (status ${status}):`, data || err.message);

      if (data?.detail) console.log('Backend detail:', data.detail);
      if (data?.errors) console.log('Backend field errors:', data.errors);

      if (status === 400) {
        const serverErrors = data?.errors;
        if (serverErrors) {
          setServerErrors(serverErrors);
        } else {
          const detail = data?.detail;
          if (detail) console.log('Backend validation message:', detail);
        }
      } else if (status === 404) {
        setError('not_found');
      } else if (data?.errors) {
        setServerErrors(data.errors);
      } else if (data?.detail) {
        console.log('Unhandled backend error:', data.detail);
      }
      setUploadProgress(null);
    } finally {
      setSubmitting(false);
    }
  }, [touchAllFields, hasErrors, fields, allErrors, link_token, formId, formValues, fileObjects, setServerErrors, submitting]);

  // ─── Filter visible fields ────────────────────────────────────
  const visibleFields = useMemo(() => {
    return fields.filter((field) => {
      const state = fieldStates[field.id];
      return state?.visible !== false;
    });
  }, [fields, fieldStates]);

  const handleGoHome = () => {
    navigate('/');
  };

  // ─── Loading State ──────────────────────────────────
  if (loading) {
    return <SkeletonLoader />;
  }

  // ─── Submitted State (redirect) ─────────────────────
  if (submitted) {
    navigate('/submitted', {
      state: {
        response_id: responseId,
        submitted_at: new Date().toISOString(),
        form_name: formData?.title || null,
      },
    });
    return null;
  }

  // ─── Invalid Link ───────────────────────────────────
  if (error === 'not_found') {
    return <InvalidLinkPage onGoHome={handleGoHome} />;
  }

  // ─── Error State ────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: 'var(--color-bg)' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-error-light)' }}>
            <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>{t('publicForm.somethingWentWrong')}</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-tertiary)' }}>{error}</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={fetchPublicForm} className="btn-secondary gap-2 text-sm px-4 py-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>                        {t('common.retry')}
                      </button>
            <button onClick={handleGoHome} className="btn-primary gap-2 text-sm px-4 py-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
              </svg>                        {t('publicForm.goHome')}
                      </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── No data ────────────────────────────────────────
  if (!formData) {
    return <InvalidLinkPage onGoHome={handleGoHome} />;
  }          // ─── Public Form View (Editable) ──────────────────────
  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto">
        {/* Back to Home link */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <button
            onClick={handleGoHome}
            className="inline-flex items-center gap-1.5 text-sm font-medium transition-all duration-200 hover:gap-2"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
            {t('publicForm.backHome')}
          </button>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-surface rounded-2xl shadow-xl border overflow-hidden"
          style={{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-border)' }}
        >
          {/* Header */}
          <div className="p-6 md:p-8">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  {formData.title}
                </h1>
                {formData.description && (
                  <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                    {formData.description}
                  </p>
                )}
              </div>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2.5 flex-wrap mb-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold status-published">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {t('workflow.published')}
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-mono font-bold"
                style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                v{version}
              </span>
            </div>

            {/* Fields Count */}
            <p className="text-xs mb-6" style={{ color: 'var(--color-text-tertiary)' }}>
              {t('publicForm.fieldsInForm', { count: fields.length })}
              {visibleFields.length < fields.length && (
                <span className="ml-1">({t('publicForm.visibleCount', { count: visibleFields.length })})</span>
              )}
            </p>

            {/* Divider */}
            <div className="mb-6" style={{ borderTop: '1px solid var(--color-border)' }} />

            {/* Fields */}
            {fields.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                    style={{ color: 'var(--color-text-tertiary)' }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </div>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                  {t('builder.previewNoFieldsDesc')}
                </p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                {fields
                  .sort((a, b) => a.order - b.order)
                  .map((field) => (
                    <PublicFieldRenderer
                      key={field.id}
                      field={field}
                      value={formValues[field.id]}
                      onChange={handleFieldChange}
                      onBlur={handleFieldBlur}
                      fieldState={fieldStates[field.id]}
                      errors={displayErrors}
                      fileObjects={fileObjects}
                    />
                  ))}
              </div>
            )}

            {/* Validation Summary - only show when there are displayable errors */}
            {Object.keys(displayErrors).length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-4 rounded-xl"
                style={{ backgroundColor: 'var(--color-error-light)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                    {t('publicForm.fixErrors')}
                  </span>
                </div>
                <ul className="space-y-1 ml-6">
                  {fields
                    .filter((f) => displayErrors[f.id])
                    .map((field) => (
                      <li key={field.id} className="text-xs text-red-500 list-disc">
                        {field.label}: {displayErrors[field.id]?.[0] || t('publicForm.invalid')}
                      </li>
                    ))}
                </ul>
              </motion.div>
            )}

            {/* Divider */}
            <div className="mb-6" style={{ borderTop: '1px solid var(--color-border)' }} />

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={submitting || visibleFields.length === 0}
              className="w-full py-3 px-6 rounded-xl text-sm font-semibold
                bg-gradient-to-r from-indigo-600 to-indigo-500
                hover:from-indigo-700 hover:to-indigo-600
                active:scale-[0.98]
                text-white shadow-lg shadow-indigo-500/20
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
                disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
                transition-all duration-200"
            >
              {submitting ? (
                <span className="flex flex-col items-center gap-1">
                  <span className="inline-flex items-center gap-2">
                    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t('publicForm.submitting')}
                  </span>
                  {uploadProgress !== null && uploadProgress >= 0 && (
                    <span className="w-full max-w-[200px] h-1.5 bg-white/30 rounded-full overflow-hidden">
                      <span
                        className="block h-full bg-white rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                      />
                    </span>
                  )}
                  {uploadProgress !== null && uploadProgress >= 0 && (
                    <span className="text-[10px] opacity-75">
                      {uploadProgress}%
                    </span>
                  )}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t('publicForm.submit')}
                </span>
              )}
            </button>
          </div>

          {/* Footer */}
          <div className="px-6 md:px-8 py-3 flex items-center justify-between"
            style={{ backgroundColor: 'var(--color-bg-tertiary)', borderTop: '1px solid var(--color-border)' }}>
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              {t('publicForm.poweredBy')}
            </span>
            <span className="text-xs font-mono" style={{ color: 'var(--color-text-tertiary)' }}>
              form-v{version}
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PublicFormPage;
