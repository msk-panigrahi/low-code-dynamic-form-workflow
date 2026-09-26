/**
 * Converts any thrown API error into a friendly, human-readable message.
 *
 * Priority:
 *  1. Known backend `error_code` → mapped to a translated message
 *  2. Backend-provided `message` (our structured auth responses)
 *  3. Backend-provided `detail` (legacy FastAPI error bodies)
 *  4. Status-code based fallback (localized)
 *  5. Generic fallback (localized)
 */

import i18n from '../i18n';

// Map backend error codes to translation keys so auth errors are fully localized.
const ERROR_CODE_KEYS = {
  EMAIL_EXISTS: 'auth.emailExists',
  USERNAME_EXISTS: 'auth.usernameTaken',
  INVALID_CREDENTIALS: 'auth.incorrectPassword',
  USER_NOT_FOUND: 'auth.noAccountFound',
  ACCOUNT_DISABLED: 'auth.accountDisabledMsg',
  NOT_AUTHENTICATED: 'auth.notAuthenticated',
  INVALID_TOKEN: 'auth.sessionExpiredMsg',
};

const STATUS_KEYS = {
  400: 'errors.validation',
  401: 'errors.unauthorized',
  403: 'errors.forbidden',
  404: 'errors.notFound',
  409: 'errors.conflict',
  500: 'errors.server',
};

export const getErrorMessage = (error, fallbackKey = 'errors.generic') => {
  if (!error) return i18n.t(fallbackKey);

  // Known backend error code → localized message
  const code = error?.response?.data?.error_code;
  if (code && ERROR_CODE_KEYS[code]) {
    return i18n.t(ERROR_CODE_KEYS[code]);
  }

  // Request timeout (Axios uses code ECONNABORTED)
  if (error.code === 'ECONNABORTED' || /timeout of/i.test(error.message || '')) {
    return i18n.t('errors.timeout');
  }

  // Network error — no HTTP response was received
  if (!error.response) {
    return i18n.t('errors.network');
  }

  const { status, data } = error.response;

  // Prefer the structured backend message
  if (data && typeof data.message === 'string' && data.message.trim()) {
    return data.message;
  }

  // Fall back to legacy `detail` shape used by other endpoints
  if (data && typeof data.detail === 'string' && data.detail.trim()) {
    return data.detail;
  }

  return i18n.t(STATUS_KEYS[status] || fallbackKey);
};
