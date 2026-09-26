import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

// ─── Rating Stars ─────────────────────────────────────────────────────
const RatingStars = ({ max = 5, value }) => (
  <div className="flex items-center gap-1">
    {Array.from({ length: max }).map((_, i) => (
      <svg
        key={i}
        className={`w-7 h-7 ${i < (value || 0) ? 'text-amber-400' : 'text-gray-200'} transition-colors`}
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ))}
  </div>
);

// ─── File Upload Field ─────────────────────────────────────────────────
const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const FileUploadField = ({ config }) => {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const fileInputRef = useRef(null);

  const allowedTypes = config.allowedTypes?.length > 0
    ? config.allowedTypes.map((t) => t.toLowerCase())
    : ALLOWED_EXTENSIONS;
  const maxSize = config.maximumSize || MAX_FILE_SIZE;

  const validateFile = useCallback((file) => {
    if (!file) return t('builder.previewNoFile');
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(ext)) {
      return t('builder.previewFileTypeErr', { ext, types: allowedTypes.join(', ') });
    }
    if (file.size > maxSize) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      const maxMB = (maxSize / 1024 / 1024).toFixed(0);
      return t('builder.previewFileSizeErr', { size: sizeMB, max: maxMB });
    }
    return null;
  }, [allowedTypes, maxSize, t]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = validateFile(file);
    if (error) {
      setFileError(error);
      setSelectedFile(null);
    } else {
      setSelectedFile(file);
      setFileError(null);
    }
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = (e) => {
    e.stopPropagation();
    setSelectedFile(null);
    setFileError(null);
  };

  return (
    <div>
      <div
        onClick={handleClickUpload}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer group
          ${selectedFile
            ? 'border-indigo-300 bg-indigo-50/50'
            : fileError
              ? 'border-red-300 bg-red-50/50'
              : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50/50'
          }`}
      >
        {selectedFile ? (
          <>
            <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-500 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="text-sm font-medium text-indigo-600 mb-1 break-all">{selectedFile.name}</p>
            <p className="text-xs text-gray-400 mb-3">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
            <button
              onClick={handleRemoveFile}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              {t('common.remove')}
            </button>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-400 group-hover:bg-indigo-100 group-hover:text-indigo-500 flex items-center justify-center mx-auto mb-3 transition-all">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="15" x2="12" y2="21" />
                <line x1="9" y1="18" x2="15" y2="18" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">{t('builder.previewUploadHint')}</p>
            <p className="text-xs text-gray-400">
              {allowedTypes.length > 0 && !allowedTypes.some(t => ALLOWED_EXTENSIONS.includes(t))
                ? `Allowed: ${allowedTypes.join(', ')}`
                : 'PDF, DOC, DOCX, TXT, JPG, PNG'}
            </p>
            {maxSize > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">
                Max file size: {(maxSize / 1024 / 1024).toFixed(0)} MB
              </p>
            )}
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={allowedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
      {fileError && (
        <div className="mt-2 flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <p className="text-xs text-red-700">{fileError}</p>
        </div>
      )}
    </div>
  );
};

// ─── Field Renderer ───────────────────────────────────────────────────
const FieldRenderer = ({ field }) => {
  const { t } = useTranslation();
  const config = field.config || {};
  const isRequired = field.is_required === 1 || field.is_required === true || config.required;
  const type = field.type || field.field_type;

  const renderByType = () => {
    switch (type) {
      case 'text':
        return (
          <input
            type="text"              placeholder={config.placeholder || t('publicForm.enterLabel', { label: (field.label?.toLowerCase() || 'text') })}
            defaultValue={config.defaultValue || ''}
            className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl
              placeholder:text-gray-400 text-gray-900
              focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400
              transition-all"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            placeholder={config.placeholder || t('builder.previewNumberPlaceholder')}
            min={config.minimum ?? undefined}
            max={config.maximum ?? undefined}
            step={config.allowDecimal ? '0.01' : '1'}
            defaultValue={config.defaultValue ?? ''}
            className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl
              placeholder:text-gray-400 text-gray-900
              focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400
              transition-all"
          />
        );

      case 'email':
        return (
          <input
            type="email"
            placeholder={config.placeholder || t('builder.previewEmailPlaceholder')}
            className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl
              placeholder:text-gray-400 text-gray-900
              focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400
              transition-all"
          />
        );

      case 'dropdown': {
        const options = config.options || [];
        return (
          <select className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl
            text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400
            transition-all">
            <option value="">{config.placeholder || t('publicForm.selectOption')}</option>
            {options.map((opt, i) => (
              <option key={i} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        );
      }

      case 'checkbox': {
        const options = config.options || [];
        return (
          <div className="space-y-2">
            {options.length === 0 ? (
              <p className="text-sm text-gray-400 italic">{t('builder.previewNoOptions')}</p>
            ) : (
              options.map((opt, i) => (
                <label key={i} className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-5 h-5 border-2 border-gray-300 rounded peer-checked:bg-indigo-600 peer-checked:border-indigo-600
                      peer-checked:after:content-[''] peer-checked:after:absolute peer-checked:after:top-[3px] peer-checked:after:left-[6px]
                      peer-checked:after:w-[6px] peer-checked:after:h-[10px] peer-checked:after:border-r-2 peer-checked:after:border-b-2
                      peer-checked:after:border-white peer-checked:after:rotate-45 transition-all
                      group-hover:border-indigo-400" />
                  </div>
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))
            )}
          </div>
        );
      }

      case 'date':
        return (
          <input
            type="date"
            min={config.minimumDate || undefined}
            max={config.maximumDate || undefined}
            className="w-full px-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl
              text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400
              transition-all"
          />
        );

      case 'file':
        return <FileUploadField config={config} />;

      case 'rating':
        return <RatingStars max={config.maximumStars || 5} value={config.defaultRating || 0} />;

      default:
        return <p className="text-sm text-gray-400 italic">Unknown field type: {type}</p>;
    }
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
        {field.label}
        {isRequired && <span className="text-red-400">*</span>}
      </label>
      {renderByType()}
    </div>
  );
};

// ─── FormPreview ─────────────────────────────────────────────────────
export const FormPreview = ({ title, description, fields }) => {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl mx-auto">
      {/* Form Header */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{title}</h1>
        {description && (
          <p className="text-sm text-gray-500">{description}</p>
        )}
      </div>

      {/* Fields */}
      {fields.length === 0 ? (
        <div className="text-center py-16 glass-card">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 text-gray-300 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-600 mb-1">{t('builder.previewNoFields')}</h3>
          <p className="text-sm text-gray-400">{t('builder.previewNoFieldsDesc')}</p>
        </div>
      ) : (
        <div className="glass-card p-6 space-y-5">
          {fields.map((field, index) => (
            <div key={field.id || index} className="animate-slide-up">
              <FieldRenderer field={field} />
              {index < fields.length - 1 && (
                <div className="border-b border-gray-100 mt-5" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Submit Button (preview only) */}
      {fields.length > 0 && (
        <div className="mt-6 text-center">
          <button className="btn-primary px-8 py-3 text-base gap-2" disabled>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {t('common.submit')}
          </button>
          <p className="text-xs text-gray-400 mt-2">{t('builder.previewModeHint')}</p>
        </div>
      )}
    </div>
  );
};
