import React from 'react';
import { useTranslation } from 'react-i18next';
import { FieldConfigEditor } from './FieldConfigEditor';

const fieldIcons = {
  text: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  ),
  number: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  ),
  email: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  dropdown: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 10l4 4 4-4" /><rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
    </svg>
  ),
  checkbox: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" /><polyline points="9 12 11 14 15 10" />
    </svg>
  ),
  date: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  file: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="15" x2="12" y2="21" /><line x1="9" y1="18" x2="15" y2="18" />
    </svg>
  ),
  rating: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
};

const typeColors = {
  text: 'bg-blue-50 text-blue-700 border-blue-200',
  number: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  email: 'bg-violet-50 text-violet-700 border-violet-200',
  dropdown: 'bg-orange-50 text-orange-700 border-orange-200',
  checkbox: 'bg-purple-50 text-purple-700 border-purple-200',
  date: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  file: 'bg-rose-50 text-rose-700 border-rose-200',
  rating: 'bg-amber-50 text-amber-700 border-amber-200',
};

export const PropertyPanel = ({
  fieldType,
  field,
  mode,
  config,
  onConfigChange,
  label,
  onLabelChange,
  required,
  onRequiredChange,
  onSave,
  onCancel,
  saving,
}) => {
  const { t } = useTranslation();

  // ─── Empty State ──────────────────────────────────────────────────
  if (!mode) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200/70 shadow-sm overflow-hidden sticky top-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">{t('builder.fieldProperties')}</h3>
        </div>
        <div className="px-5 py-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 text-gray-300 flex items-center justify-center mx-auto mb-5 border border-gray-200/50">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          <h4 className="text-sm font-semibold text-gray-500 mb-2">{t('builder.noFieldSelected')}</h4>
          <p className="text-xs text-gray-400 leading-relaxed max-w-[220px] mx-auto">
            {t('builder.noFieldSelectedDesc')}
          </p>
          <div className="mt-5 space-y-2 text-left max-w-[220px] mx-auto">
            <div className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
              <span className="text-[11px] text-gray-400">{t('builder.noFieldSelectedTip1')}</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
              <span className="text-[11px] text-gray-400">{t('builder.noFieldSelectedTip2')}</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
              <span className="text-[11px] text-gray-400">{t('builder.noFieldSelectedTip3')}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Active State ─────────────────────────────────────────────────
  const displayType = field?.type || fieldType?.id;
  const displayName = fieldType?.name || '';
  const icon = fieldIcons[displayType] || fieldIcons.text;

  return (
    <div className="bg-white rounded-2xl border border-gray-200/70 shadow-sm overflow-hidden sticky top-6 animate-fade-in">
      {/* Header */}
      <div className={`px-5 py-3.5 border-b border-gray-100 ${
        mode === 'edit' ? 'bg-gradient-to-r from-amber-50/80 to-orange-50/80' : 'bg-gradient-to-r from-indigo-50/80 to-blue-50/80'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm ${
            mode === 'edit' ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-indigo-600 text-white shadow-indigo-500/20'
          }`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-800 truncate leading-tight">
              {mode === 'edit' ? t('builder.editField') : t('builder.addField')}
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">{displayName}</p>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-all"
              title={t('common.close')}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 max-h-[calc(100vh-280px)] overflow-y-auto">
        <FieldConfigEditor
          fieldType={fieldType}
          config={config}
          onChange={onConfigChange}
          label={label}
          onLabelChange={onLabelChange}
          required={required}
          onRequiredChange={onRequiredChange}
        />
      </div>

      {/* Footer */}
      <div className="px-5 py-3.5 bg-gray-50/80 border-t border-gray-100 flex items-center justify-end gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center px-3 py-2
              bg-white text-gray-700 font-medium text-xs rounded-xl
              border border-gray-200 hover:bg-gray-50 hover:border-gray-300
              transition-all duration-150"
          >
            {t('common.cancel')}
          </button>
        )}
        {onSave && (
          <button
            onClick={onSave}
            disabled={saving || !label?.trim()}
            className="inline-flex items-center justify-center px-4 py-2 text-xs font-medium rounded-xl gap-1.5
              text-white bg-gradient-to-r from-indigo-600 to-indigo-500
              hover:from-indigo-700 hover:to-indigo-600
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200 ease-out"
          >
            {saving ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('builder.saving')}
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {mode === 'edit' ? t('builder.updateField') : t('builder.addField')}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
