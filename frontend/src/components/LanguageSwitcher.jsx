import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage, SUPPORTED_LANGUAGES } from '../i18n';

/**
 * Searchable language selector.
 *
 * Features:
 *  - Globe icon + current language flag/name
 *  - Animated dropdown with search input
 *  - Keyboard accessible (ArrowDown / ArrowUp / Enter / Escape / Tab)
 *  - Announces the change to screen readers via a visually-hidden live region
 *  - Closes on outside click and on Escape
 */
export const LanguageSwitcher = ({ compact = false }) => {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [announcement, setAnnouncement] = useState('');

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) || SUPPORTED_LANGUAGES[0];

  const filtered = SUPPORTED_LANGUAGES.filter((lang) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      lang.name.toLowerCase().includes(q) ||
      lang.nativeName.toLowerCase().includes(q) ||
      lang.code.toLowerCase().includes(q)
    );
  });

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
    setQuery('');
    setHighlighted(0);
  }, []);

  const selectLanguage = useCallback(
    async (lang) => {
      await changeLanguage(lang.code);
      setAnnouncement(t('common.languageChanged', { name: lang.nativeName }));
      setOpen(false);
    },
    [t]
  );

  // Focus search when dropdown opens
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => searchRef.current?.focus(), 60);
      return () => clearTimeout(id);
    }
    setHighlighted(0);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const lang = filtered[highlighted];
      if (lang) selectLanguage(lang);
    }
  };

  return (
    <div className="lang-switcher" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        className="lang-switcher-trigger"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('common.language')}
        title={t('common.language')}
      >
        <svg className="lang-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        {!compact && (
          <span className="lang-trigger-label">
            <span className="lang-flag" aria-hidden="true">{current.flag}</span>
            <span className="lang-trigger-name">{current.nativeName}</span>
          </span>
        )}
        <svg className={`lang-chevron ${open ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="lang-dropdown" role="listbox" aria-label={t('common.language')}>
          <div className="lang-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlighted(0);
              }}
              placeholder={t('common.search')}
              aria-label={t('common.search')}
            />
          </div>

          <ul className="lang-list">
            {filtered.length === 0 ? (
              <li className="lang-empty">{t('common.noData')}</li>
            ) : (
              filtered.map((lang, idx) => (
                <li
                  key={lang.code}
                  role="option"
                  aria-selected={lang.code === i18n.language}
                  className={`lang-item ${lang.code === i18n.language ? 'active' : ''} ${idx === highlighted ? 'highlighted' : ''}`}
                  onMouseEnter={() => setHighlighted(idx)}
                  onClick={() => selectLanguage(lang)}
                >
                  <span className="lang-flag" aria-hidden="true">{lang.flag}</span>
                  <span className="lang-item-names">
                    <span className="lang-item-native">{lang.nativeName}</span>
                    <span className="lang-item-english">{lang.name}</span>
                  </span>
                  {lang.code === i18n.language && (
                    <svg className="lang-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {/* Screen reader announcement */}
      <div role="status" aria-live="polite" className="sr-only" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
};
