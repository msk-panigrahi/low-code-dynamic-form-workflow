import React from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { RetentionPolicySection } from '../components/RetentionPolicySection';
import { useDarkMode, setDarkMode } from '../hooks/useDarkMode';

export const Settings = () => {
  const { t } = useTranslation();
  const { isDark } = useDarkMode();

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
        {t('settings.title')}
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-tertiary)' }}>
        {t('settings.subtitle')}
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Language */}
        <div className="card-surface p-6">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            {t('settings.language')}
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
            {t('settings.languageHint')}
          </p>
          <LanguageSwitcher />
        </div>

        {/* Appearance */}
        <div className="card-surface p-6">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
            </svg>
            {t('settings.appearance')}
          </h2>
          <p className="text-sm mb-5" style={{ color: 'var(--color-text-tertiary)' }}>
            {t('settings.appearanceHint')}
          </p>

          {/* Theme selector — Light / Dark (both fully implemented) */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDarkMode(false)}
              aria-pressed={!isDark}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                !isDark ? 'shadow-lg shadow-indigo-500/20' : 'hover:opacity-80'
              }`}
              style={!isDark
                ? { color: '#fff', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderColor: 'transparent' }
                : { color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
              {t('settings.light')}
            </button>

            <button
              type="button"
              onClick={() => setDarkMode(true)}
              aria-pressed={isDark}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                isDark ? 'shadow-lg shadow-indigo-500/20' : 'hover:opacity-80'
              }`}
              style={isDark
                ? { color: '#fff', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderColor: 'transparent' }
                : { color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              {t('settings.dark')}
            </button>
          </div>

          <p className="text-[11px] mt-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: isDark ? '#8b5cf6' : '#f59e0b' }} />
            {t('settings.currentTheme', { theme: isDark ? t('settings.dark') : t('settings.light') })}
          </p>
        </div>
      </div>

      {/* Retention Policy (Day 19) */}
      <div className="mt-6">
        <RetentionPolicySection />
      </div>
    </div>
  );
};
