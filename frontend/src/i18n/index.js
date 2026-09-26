import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  SUPPORTED_LANGUAGES,
  RTL_LANGUAGES,
  LANGUAGE_STORAGE_KEY,
} from './languages';

const DEFAULT_LANGUAGE = 'en';
const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

/**
 * Lazy-load a locale bundle. Vite will code-split each language file so only
 * the currently selected language (plus English fallback) is fetched.
 */
const loadLocale = (code) => import(`./locales/${code}/translation.json`).then((m) => m.default);

/** Read the persisted language (falling back to English or the browser language). */
const getSavedLanguage = () => {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && SUPPORTED_CODES.includes(saved)) return saved;
  } catch {
    // localStorage unavailable (privacy mode / SSR) — ignore.
  }
  const browser = typeof navigator !== 'undefined' ? navigator.language?.split('-')[0] : null;
  return browser && SUPPORTED_CODES.includes(browser) ? browser : DEFAULT_LANGUAGE;
};

/** Persist the selected language. */
const saveLanguage = (code) => {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
    // Ignore persistence failures — the session still works.
  }
};

/** Apply RTL/LTR direction + <html lang> to the document. */
const applyDirection = (code) => {
  if (typeof document === 'undefined') return;
  const isRtl = RTL_LANGUAGES.includes(code);
  document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', code);
};

/**
 * Switch language instantly: lazy-load the bundle if needed, then change.
 * The direction attribute is updated so the whole UI realigns (Arabic/Urdu → RTL).
 */
export const changeLanguage = async (code) => {
  if (!SUPPORTED_CODES.includes(code)) return i18n.language;

  if (!i18n.hasResourceBundle(code, 'translation')) {
    const bundle = await loadLocale(code);
    i18n.addResourceBundle(code, 'translation', bundle, true, true);
  }

  await i18n.changeLanguage(code);
  saveLanguage(code);
  applyDirection(code);
  return i18n.language;
};

/** Initialize i18next before the app renders. */
export const initI18n = async () => {
  const savedLang = getSavedLanguage();

  await i18n.use(initReactI18next).init({
    lng: savedLang,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_CODES,
    nonExplicitSupportedLngs: true,
    interpolation: {
      escapeValue: false, // React already escapes values.
    },
    react: {
      useSuspense: false, // We pre-load the active bundle; avoids Suspense flicker.
    },
    resources: {},
    initImmediate: false,
  });

  // Always load the English fallback bundle, then the active language bundle.
  // fallbackLng only works when the EN resources are actually present.
  const [enBundle, activeBundle] = await Promise.all([
    loadLocale(DEFAULT_LANGUAGE),
    loadLocale(savedLang),
  ]);
  i18n.addResourceBundle(DEFAULT_LANGUAGE, 'translation', enBundle, true, true);
  i18n.addResourceBundle(savedLang, 'translation', activeBundle, true, true);

  applyDirection(savedLang);
  return i18n;
};

export default i18n;
export { SUPPORTED_LANGUAGES, RTL_LANGUAGES };
