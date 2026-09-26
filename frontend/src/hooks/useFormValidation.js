import { useState, useCallback, useMemo } from 'react';
import i18n from '../i18n';

const t = (key, opts) => i18n.t(key, opts);

// ─── Email Regex ──────────────────────────────────────────────────
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ─── Helpers ──────────────────────────────────────────────────────
function getStr(value) {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function isEmpty(value) {
  if (value == null) return true;
  if (typeof value === 'boolean') return false;
  if (typeof value === 'number') return false;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'string') return value.trim() === '';
  return String(value).trim() === '';
}

// ─── Individual Field Validators ──────────────────────────────────

function validateText(value, config, isRequired, label) {
  const errors = [];
  const str = getStr(value);

  if (isRequired && isEmpty(value)) { errors.push(t('validation.required')); return errors; }
  if (isEmpty(value)) return errors;
  if (str.trim() === '') { errors.push(t('validation.required')); return errors; }

  const minLen = config.minimumLength;
  if (minLen != null && str.length < Number(minLen)) {
    errors.push(t('validation.minChars', { count: Number(minLen) }));
  }

  const maxLen = config.maximumLength;
  if (maxLen != null && str.length > Number(maxLen)) {
    errors.push(t('validation.maxChars', { count: Number(maxLen) }));
  }

  return errors;
}

function validateNumber(value, config, isRequired, label) {
  const errors = [];

  if (isRequired && isEmpty(value)) { errors.push(t('validation.required')); return errors; }
  if (isEmpty(value)) return errors;

  const allowDecimal = config.allowDecimal === true;
  const str = getStr(value).trim();

  if (str === '') {
    if (isRequired) errors.push(t('validation.required'));
    return errors;
  }

  // Check for valid number
  if (isNaN(Number(str)) || str === '') {
    errors.push(t('validation.invalidNumber'));
    return errors;
  }

  if (!allowDecimal && str.includes('.')) {
    errors.push(t('validation.noDecimals'));
    return errors;
  }

  const num = Number(str);

  const minVal = config.minimum;
  if (minVal != null && num < Number(minVal)) {
    errors.push(t('validation.minValue', { value: Number(minVal) }));
  }

  const maxVal = config.maximum;
  if (maxVal != null && num > Number(maxVal)) {
    errors.push(t('validation.maxValue', { value: Number(maxVal) }));
  }

  return errors;
}

function validateEmail(value, config, isRequired, label) {
  const errors = [];
  const str = getStr(value);

  if (isRequired && isEmpty(value)) { errors.push(t('validation.required')); return errors; }
  if (isEmpty(value)) return errors;

  if (!EMAIL_REGEX.test(str.trim())) {
    errors.push(t('validation.invalidEmail'));
  }

  return errors;
}

function validateDropdown(value, config, isRequired, label) {
  const errors = [];
  const str = getStr(value);

  if (isRequired && isEmpty(value)) { errors.push(t('validation.required')); return errors; }
  if (isEmpty(value)) return errors;

  const options = config.options || [];
  const validValues = new Set(options.map((o) => o.value));

  if (str && !validValues.has(str)) {
    errors.push(t('validation.invalidOption'));
  }

  return errors;
}

function validateCheckbox(value, config, isRequired, label) {
  const errors = [];

  // Single boolean checkbox
  if (typeof value === 'boolean') {
    if (isRequired && !value) errors.push(t('validation.required'));
    return errors;
  }

  // Multi-checkbox: array of selected values
  const selected = Array.isArray(value) ? value : (isEmpty(value) ? [] : [String(value)]);

  if (isRequired && selected.length === 0) { errors.push(t('validation.required')); return errors; }
  if (selected.length === 0) return errors;

  const minSel = config.minimumSelections;
  if (minSel != null && selected.length < Number(minSel)) {
    errors.push(t('validation.minOptions', { count: Number(minSel) }));
  }

  const maxSel = config.maximumSelections;
  if (maxSel != null && selected.length > Number(maxSel)) {
    errors.push(t('validation.maxOptions', { count: Number(maxSel) }));
  }

  const options = config.options || [];
  if (options.length > 0) {
    const validValues = new Set(options.map((o) => o.value));
    const invalid = selected.filter((v) => !validValues.has(v));
    if (invalid.length > 0) errors.push(t('validation.invalidSelection'));
  }

  return errors;
}

function validateDate(value, config, isRequired, label) {
  const errors = [];
  const str = getStr(value);

  if (isRequired && isEmpty(value)) { errors.push(t('validation.required')); return errors; }
  if (isEmpty(value)) return errors;

  if (!DATE_REGEX.test(str.trim())) {
    errors.push(t('validation.invalidDate'));
    return errors;
  }

  const parsed = new Date(str + 'T00:00:00');
  if (isNaN(parsed.getTime())) {
    errors.push(t('validation.invalidDateShort'));
    return errors;
  }

  const minDateStr = config.minimumDate;
  if (minDateStr) {
    const minDate = new Date(minDateStr.substring(0, 10) + 'T00:00:00');
    if (!isNaN(minDate.getTime()) && parsed < minDate) {
      const formatted = `${(minDate.getMonth() + 1).toString().padStart(2, '0')}/${minDate.getDate().toString().padStart(2, '0')}/${minDate.getFullYear()}`;
      errors.push(t('validation.dateAfter', { date: formatted }));
    }
  }

  const maxDateStr = config.maximumDate;
  if (maxDateStr) {
    const maxDate = new Date(maxDateStr.substring(0, 10) + 'T00:00:00');
    if (!isNaN(maxDate.getTime()) && parsed > maxDate) {
      const formatted = `${(maxDate.getMonth() + 1).toString().padStart(2, '0')}/${maxDate.getDate().toString().padStart(2, '0')}/${maxDate.getFullYear()}`;
      errors.push(t('validation.dateBefore', { date: formatted }));
    }
  }

  return errors;
}

function validateFile(value, config, isRequired, label) {
  const errors = [];

  if (isRequired && isEmpty(value)) { errors.push(t('validation.required')); return errors; }
  if (isEmpty(value)) return errors;

  const str = getStr(value);

  // Parse filename and optional size (format: "filename.ext||size")
  let fileName = str;
  let fileSize = null;
  if (str.includes('||')) {
    const parts = str.split('||', 2);
    fileName = parts[0];
    fileSize = parseInt(parts[1], 10);
  }

  // Extension validation
  const allowedTypes = config.allowedTypes || [];
  if (allowedTypes.length > 0 && fileName) {
    const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : fileName.toLowerCase();
    const allowedLower = allowedTypes.map((t) => t.toLowerCase().replace(/^\./, ''));
    if (!allowedLower.includes(ext)) {
      errors.push(t('validation.invalidFileType'));
    }
  }

  // Size validation
  const maxSize = config.maximumSize;
  if (maxSize != null && fileSize != null && !isNaN(fileSize)) {
    if (fileSize > Number(maxSize)) {
      errors.push(t('validation.fileTooLarge'));
    }
  }

  return errors;
}

function validateRating(value, config, isRequired, label) {
  const errors = [];

  if (isRequired && isEmpty(value)) { errors.push(t('validation.required')); return errors; }
  if (isEmpty(value)) return errors;

  const rating = parseInt(String(value), 10);
  if (isNaN(rating)) {
    errors.push(t('validation.invalidRating'));
    return errors;
  }

  const minStars = config.minimumStars != null ? Number(config.minimumStars) : 1;
  if (rating < minStars) {
    errors.push(t('validation.minRating', { count: minStars }));
  }

  const maxStars = config.maximumStars != null ? Number(config.maximumStars) : 5;
  if (rating > maxStars) {
    errors.push(t('validation.maxRating', { count: maxStars }));
  }

  return errors;
}

// ─── Field Validation Router ──────────────────────────────────────
const VALIDATOR_MAP = {
  text: validateText,
  textarea: validateText,
  number: validateNumber,
  email: validateEmail,
  password: validateText,
  dropdown: validateDropdown,
  radio: validateDropdown,
  checkbox: validateCheckbox,
  date: validateDate,
  file: validateFile,
  rating: validateRating,
};

export function validateField(field, value, fieldState) {
  const isRequired = fieldState?.required || field.is_required;
  const isHidden = fieldState?.visible === false;
  const validator = VALIDATOR_MAP[field.type];

  // Skip hidden fields entirely
  if (isHidden) return [];

  // Unknown type – only check required
  if (!validator) {
    if (isRequired && isEmpty(value)) return [t('validation.required')];
    return [];
  }

  return validator(value, field.config || {}, isRequired, field.label);
}

export function validateForm(fields, formValues, fieldStates) {
  const errors = {};

  for (const field of fields) {
    const state = fieldStates[field.id] || {};
    const fieldErrors = validateField(field, formValues[field.id], state);
    if (fieldErrors.length > 0) {
      errors[field.id] = fieldErrors;
    }
  }

  return errors;
}

// ─── Hook ─────────────────────────────────────────────────────────
export function useFormValidation(fields, formValues, fieldStates) {
  const [errors, setErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState(new Set());
  const [submitted, setSubmitted] = useState(false);

  // Compute all field validation errors on every value change
  const allErrors = useMemo(() => {
    return validateForm(fields, formValues, fieldStates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, formValues, fieldStates, i18n.language]);

  // Re-validate touched fields on every value change (real-time)
  const displayErrors = useMemo(() => {
    if (touchedFields.size === 0 && !submitted) return {};

    const result = {};
    for (const fieldId of touchedFields) {
      if (allErrors[fieldId]) {
        result[fieldId] = allErrors[fieldId];
      }
    }

    // On submit attempt, show ALL errors (client-side + server-side)
    if (submitted) {
      // Merge client-side validation errors
      Object.assign(result, allErrors);

      // Merge in server-side errors (from setServerErrors)
      if (Object.keys(errors).length > 0) {
        Object.assign(result, errors);
      }
    }

    return result;
  }, [allErrors, touchedFields, submitted, errors]);

  const touchField = useCallback((fieldId) => {
    setTouchedFields((prev) => {
      if (prev.has(fieldId)) return prev;
      const next = new Set(prev);
      next.add(fieldId);
      return next;
    });
  }, []);

  const touchAllFields = useCallback(() => {
    const allIds = new Set(fields.map((f) => f.id));
    setTouchedFields(allIds);
    setSubmitted(true);
  }, [fields]);

  const setServerErrors = useCallback((serverErrors) => {
    if (serverErrors && typeof serverErrors === 'object') {
      // Convert string-keyed errors to number-keyed errors
      const converted = {};
      for (const [key, msgs] of Object.entries(serverErrors)) {
        converted[Number(key)] = msgs;
      }
      setErrors(converted);
      setSubmitted(true);
    }
  }, []);

  const resetValidation = useCallback(() => {
    setErrors({});
    setTouchedFields(new Set());
    setSubmitted(false);
  }, []);

  return {
    // Errors to display (only for touched fields + submit)
    errors: submitted ? allErrors : displayErrors,
    // Raw all-field errors (for submit checking)
    allErrors,
    touchField,
    touchAllFields,
    setServerErrors,
    resetValidation,
    hasErrors: Object.keys(allErrors).length > 0,
  };
}
