import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

// ─── Icons ─────────────────────────────────────────────────────────
const icons = {
  success: (
    <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

const DEFAULT_DURATION = 4500; // auto-dismiss after 4.5s
const EXIT_DURATION = 250; // must match .toast-exit animation duration

// ─── Context ───────────────────────────────────────────────────────
const ToastContext = createContext(null);

// ─── Single Toast Item ─────────────────────────────────────────────
const ToastItem = ({ toast, onDismiss }) => {
  const { t } = useTranslation();
  const [exiting, setExiting] = useState(false);
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(toast.duration || DEFAULT_DURATION);
  const startRef = useRef(Date.now());
  const dismissTimerRef = useRef(null);
  const exitTimerRef = useRef(null);
  const exitingRef = useRef(false);

  // Cleanup timers on unmount
  useEffect(() => () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
  }, []);

  const startDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    startRef.current = Date.now();
    dismissTimerRef.current = setTimeout(() => {
      exitingRef.current = true;
      setExiting(true);
      exitTimerRef.current = setTimeout(() => onDismiss(toast.id), EXIT_DURATION);
    }, remainingRef.current);
  }, [onDismiss, toast.id]);

  // Auto-dismiss with pause-on-hover support
  useEffect(() => {
    if (exiting) return undefined;

    if (paused) {
      // Hovering — subtract elapsed time and hold
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (Date.now() - startRef.current)
      );
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      return undefined;
    }

    startDismissTimer();
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [paused, exiting, startDismissTimer]);

  const handleDismiss = () => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    setExiting(true);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    exitTimerRef.current = setTimeout(() => onDismiss(toast.id), EXIT_DURATION);
  };

  const typeClass =
    toast.type === 'success'
      ? 'toast-success'
      : toast.type === 'error'
        ? 'toast-error'
        : toast.type === 'warning'
          ? 'toast-warning'
          : 'toast-info';

  return (
    <div
      className={`toast ${typeClass} ${exiting ? 'toast-exit' : 'toast-enter'}`}
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex-shrink-0 mt-0.5">{icons[toast.type] || icons.info}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.message && <p className="text-xs opacity-80 mt-0.5">{toast.message}</p>}
      </div>
      <button
        onClick={handleDismiss}
        aria-label={t('common.dismissNotification')}
        className="flex-shrink-0 p-0.5 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
};

// ─── Viewport (rendered once by ToastProvider via a portal) ───────
const ToastViewport = () => {
  const { toasts, removeToast } = useContext(ToastContext);
  if (toasts.length === 0) return null;

  return createPortal(
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={removeToast} />
      ))}
    </div>,
    document.body
  );
};

// ─── Provider ──────────────────────────────────────────────────────
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ type = 'info', title, message, duration } = {}) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, title, message, duration }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback((title, message) => addToast({ type: 'success', title, message }), [addToast]);
  const error = useCallback((title, message) => addToast({ type: 'error', title, message }), [addToast]);
  const warning = useCallback((title, message) => addToast({ type: 'warning', title, message }), [addToast]);
  const info = useCallback((title, message) => addToast({ type: 'info', title, message }), [addToast]);

  const value = { toasts, addToast, removeToast, success, error, warning, info };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
};

// ─── Hook (backward compatible) ────────────────────────────────────
export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  // ToastContainer is kept as a harmless no-op so existing call sites that
  // render <ToastContainer /> keep working — the real viewport is rendered
  // once by ToastProvider on document.body.
  const ToastContainer = useCallback(() => null, []);

  return { ...ctx, ToastContainer, toastError: ctx.error };
};
