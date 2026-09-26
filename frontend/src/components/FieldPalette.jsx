import React from 'react';
import { useTranslation } from 'react-i18next';

const icons = {
  text: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  ),
  number: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  ),
  email: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  dropdown: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 10l4 4 4-4" />
      <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
    </svg>
  ),
  checkbox: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  ),
  date: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  file: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="15" x2="12" y2="21" />
      <line x1="9" y1="18" x2="15" y2="18" />
    </svg>
  ),
  rating: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
};

const iconColors = {
  text: {
    bg: 'bg-blue-100',
    text: 'text-blue-600',
    active: 'bg-blue-600',
  },
  number: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-600',
    active: 'bg-emerald-600',
  },
  email: {
    bg: 'bg-violet-100',
    text: 'text-violet-600',
    active: 'bg-violet-600',
  },
  dropdown: {
    bg: 'bg-orange-100',
    text: 'text-orange-600',
    active: 'bg-orange-600',
  },
  checkbox: {
    bg: 'bg-purple-100',
    text: 'text-purple-600',
    active: 'bg-purple-600',
  },
  date: {
    bg: 'bg-cyan-100',
    text: 'text-cyan-600',
    active: 'bg-cyan-600',
  },
  file: {
    bg: 'bg-rose-100',
    text: 'text-rose-600',
    active: 'bg-rose-600',
  },
  rating: {
    bg: 'bg-amber-100',
    text: 'text-amber-600',
    active: 'bg-amber-600',
  },
};

export const FieldPalette = ({ fieldTypes, activeFieldType, onFieldTypeClick, readOnly = false }) => {
  const { t } = useTranslation();
  if (!fieldTypes) return null;

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg shadow-gray-200/50 p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center shadow-sm">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-800">{t('builder.fieldPalette')}</h2>
          <p className="text-xs text-gray-400">{t('builder.fieldPaletteHint')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {fieldTypes.map((field) => {
          const isActive = activeFieldType?.id === field.id;
          const colors = iconColors[field.icon] || { bg: 'bg-gray-100', text: 'text-gray-600', active: 'bg-gray-600' };

          return (              <button
              key={field.id}
              onClick={() => !readOnly && onFieldTypeClick(field)}
              disabled={readOnly}
              className={`
                flex flex-col items-center justify-center p-4 rounded-2xl
                border-2 cursor-pointer select-none
                transition-all duration-200 ease-out
                min-h-[120px]
                ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}
                ${isActive
                  ? 'border-indigo-500/60 bg-indigo-50/80 shadow-md shadow-indigo-500/5 -translate-y-0.5'
                  : 'border-transparent shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-gray-200/80'
                }
              `}
              style={!isActive && !readOnly ? { backgroundColor: 'var(--color-card-bg)' } : {}}
            >
              <div className={`
                w-11 h-11 rounded-xl flex items-center justify-center mb-2.5
                transition-all duration-200
                ${isActive
                  ? `${colors.active} text-white shadow-sm shadow-gray-900/10`
                  : `${colors.bg} ${colors.text}`
                }
              `}>
                {icons[field.icon] || icons.text}
              </div>
              <h3 className={`
                text-sm font-semibold text-center leading-tight transition-colors duration-200
                ${isActive ? 'text-indigo-700' : 'text-gray-800'}
              `}>
                {field.name}
              </h3>
              <p className={`
                text-[11px] text-center mt-0.5 leading-tight transition-colors duration-200
                ${isActive ? 'text-indigo-500' : 'text-gray-400'}
              `}>
                {field.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
