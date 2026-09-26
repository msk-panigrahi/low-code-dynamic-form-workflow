import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'darkMode';

function readStored() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) return saved === 'true';
  } catch {
    // localStorage unavailable (privacy mode / SSR) — fall through.
  }
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

// Module-level shared store so every consumer (Navbar, Settings, …) stays in
// sync — toggling the theme in one place updates all of them instantly.
let currentDark = readStored();
const listeners = new Set();

function applyDark(value) {
  currentDark = Boolean(value);
  try {
    localStorage.setItem(STORAGE_KEY, String(currentDark));
  } catch {
    // Ignore persistence failures — the session still works.
  }
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', currentDark);
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return currentDark;
}

// Apply the persisted theme class as early as possible (before first paint).
if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('dark', currentDark);
}

export const useDarkMode = () => {
  const isDark = useSyncExternalStore(subscribe, getSnapshot);
  const toggle = useCallback(() => applyDark(!currentDark), []);
  return { isDark, toggle };
};

/** Programmatically set the theme (used by Settings' Light/Dark selector). */
export const setDarkMode = (value) => applyDark(Boolean(value));
