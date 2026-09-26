import React from 'react';
import { useTranslation } from 'react-i18next';

export const FieldConfigEditor = ({ fieldType, config, onChange, label, onLabelChange, required, onRequiredChange }) => {
  const { t } = useTranslation();
  const handleNumberChange = (name, value) => {
    onChange(name, value === '' ? null : Number(value));
  };

  // ─── Text ────────────────────────────────────────────────────────────
  const renderTextConfig = () => (
    <>
      <div>
        <label className="input-label">{t('builder.placeholder')}</label>
        <input
          type="text"
          value={config.placeholder || ''}
          onChange={(e) => onChange('placeholder', e.target.value)}
          placeholder={t('builder.placeholderExample')}
          className="input-field"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="input-label">{t('builder.minLength')}</label>
          <input
            type="number"
            value={config.minimumLength ?? ''}
            onChange={(e) => handleNumberChange('minimumLength', e.target.value)}
            placeholder="0"
            min="0"
            className="input-field"
          />
        </div>
        <div>
          <label className="input-label">{t('builder.maxLength')}</label>
          <input
            type="number"
            value={config.maximumLength ?? ''}
            onChange={(e) => handleNumberChange('maximumLength', e.target.value)}
            placeholder="100"
            min="0"
            className="input-field"
          />
        </div>
      </div>
      <div>
        <label className="input-label">{t('builder.defaultValue')}</label>
        <input
          type="text"
          value={config.defaultValue || ''}
          onChange={(e) => onChange('defaultValue', e.target.value || null)}
          placeholder={t('builder.optionalDefaultText')}
          className="input-field"
        />
      </div>
    </>
  );

  // ─── Number (NO Placeholder) ─────────────────────────────────────────
  const renderNumberConfig = () => (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="input-label">{t('builder.minValue')}</label>
          <input
            type="number"
            value={config.minimum ?? ''}
            onChange={(e) => handleNumberChange('minimum', e.target.value)}
            placeholder="0"
            className="input-field"
          />
        </div>
        <div>
          <label className="input-label">{t('builder.maxValue')}</label>
          <input
            type="number"
            value={config.maximum ?? ''}
            onChange={(e) => handleNumberChange('maximum', e.target.value)}
            placeholder="100"
            className="input-field"
          />
        </div>
      </div>
      <div>
        <label className="input-label">{t('builder.defaultValue')}</label>
        <input
          type="number"
          value={config.defaultValue ?? ''}
          onChange={(e) => handleNumberChange('defaultValue', e.target.value)}
          placeholder={t('builder.optionalDefaultValue')}
          className="input-field"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="allow-decimal"
          checked={!!config.allowDecimal}
          onChange={(e) => onChange('allowDecimal', e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
        />
        <label htmlFor="allow-decimal" className="text-sm text-gray-700 cursor-pointer select-none">
          {t('builder.allowDecimals')}
        </label>
      </div>
    </>
  );

  // ─── Email ───────────────────────────────────────────────────────────
  const renderEmailConfig = () => (
    <>
      <div>
        <label className="input-label">{t('builder.placeholder')}</label>
        <input
          type="text"
          value={config.placeholder || ''}
          onChange={(e) => onChange('placeholder', e.target.value)}
          placeholder={t('builder.emailExample')}
          className="input-field"
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        {t('builder.emailValidationAuto')}
      </div>
    </>
  );

  // ─── Dropdown ────────────────────────────────────────────────────────
  const renderDropdownConfig = () => {
    const options = config.options || [];

    const handleAddOption = () => {
      const newOptions = [...options, { label: '', value: '', order: options.length }];
      onChange('options', newOptions);
    };

    const handleRemoveOption = (index) => {
      onChange('options', options.filter((_, i) => i !== index));
    };

    const handleOptionLabelChange = (index, value) => {
      const updated = [...options];
      updated[index] = {
        ...updated[index],
        label: value,
        value: value.toLowerCase().replace(/\s+/g, '_'),
      };
      onChange('options', updated);
    };

    const handleMoveOptionUp = (index) => {
      if (index === 0) return;
      const updated = [...options];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      onChange('options', updated);
    };

    const handleMoveOptionDown = (index) => {
      if (index >= options.length - 1) return;
      const updated = [...options];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      onChange('options', updated);
    };

    return (
      <>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="input-label !mb-0">{t('builder.options')}</label>
            <button type="button" onClick={handleAddOption} className="btn-plus">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t('builder.addOption')}
            </button>
          </div>
          {options.length === 0 ? (
            <div className="text-center py-5 border-2 border-dashed border-gray-200 rounded-xl">
              <svg className="w-7 h-7 mx-auto text-gray-300 mb-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <p className="text-xs text-gray-400">{t('builder.noOptionsYet')}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {options.map((option, idx) => (
                <div key={idx} className="option-item">
                  <button
                    type="button"
                    onClick={() => handleMoveOptionUp(idx)}
                    disabled={idx === 0}
                    className="flex-shrink-0 p-1 text-gray-300 hover:text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title={t('builder.moveUp')}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveOptionDown(idx)}
                    disabled={idx === options.length - 1}
                    className="flex-shrink-0 p-1 text-gray-300 hover:text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title={t('builder.moveDown')}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <polyline points="19 12 12 19 5 12" />
                    </svg>
                  </button>
                  <span className="option-number">{idx + 1}</span>
                  <input
                    type="text"
                    value={option.label}
                    onChange={(e) => handleOptionLabelChange(idx, e.target.value)}
                    placeholder={t('builder.optionN', { n: idx + 1 })}
                    className="input-field flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    className="option-remove"
                    title={t('builder.removeOption')}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="input-label">{t('builder.defaultOption')}</label>
          <select
            value={config.defaultOption || ''}
            onChange={(e) => onChange('defaultOption', e.target.value || null)}
            className="input-field"
          >
            <option value="">{t('builder.none')}</option>
            {options.filter((o) => o.label.trim()).map((opt, idx) => (
              <option key={idx} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </>
    );
  };

  // ─── Checkbox ────────────────────────────────────────────────────────
  const renderCheckboxConfig = () => {
    const options = config.options || [];

    const handleAddOption = () => {
      onChange('options', [...options, { label: '', value: '', order: options.length }]);
    };

    const handleRemoveOption = (index) => {
      onChange('options', options.filter((_, i) => i !== index));
    };

    const handleOptionLabelChange = (index, value) => {
      const updated = [...options];
      updated[index] = {
        ...updated[index],
        label: value,
        value: value.toLowerCase().replace(/\s+/g, '_'),
      };
      onChange('options', updated);
    };

    return (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="input-label !mb-0">{t('builder.checkboxOptions')}</label>
          <button type="button" onClick={handleAddOption} className="btn-plus">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t('builder.addOption')}
          </button>
        </div>
        {options.length === 0 ? (
          <div className="text-center py-5 border-2 border-dashed border-gray-200 rounded-xl">
            <svg className="w-7 h-7 mx-auto text-gray-300 mb-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 11 12 14 22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            <p className="text-xs text-gray-400">{t('builder.noOptionsYet')}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {options.map((option, idx) => (
              <div key={idx} className="option-item">
                <div className="flex-shrink-0 w-5 h-5 border-2 border-gray-300 rounded" />
                <input
                  type="text"
                  value={option.label}
                  onChange={(e) => handleOptionLabelChange(idx, e.target.value)}
                  placeholder={`Option ${idx + 1}`}
                  className="input-field flex-1"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveOption(idx)}
                  className="option-remove"
                  title={t('builder.removeOption')}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── Date ────────────────────────────────────────────────────────────
  const renderDateConfig = () => (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="input-label">{t('builder.minDate')}</label>
        <input
          type="date"
          value={config.minimumDate || ''}
          onChange={(e) => onChange('minimumDate', e.target.value || null)}
          className="input-field"
        />
      </div>
      <div>
        <label className="input-label">{t('builder.maxDate')}</label>
        <input
          type="date"
          value={config.maximumDate || ''}
          onChange={(e) => onChange('maximumDate', e.target.value || null)}
          className="input-field"
        />
      </div>
    </div>
  );

  // ─── File Upload ─────────────────────────────────────────────────────
  const renderFileConfig = () => (
    <>
      <div>
        <label className="input-label">{t('builder.allowedExtensions')}</label>
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {['.pdf', '.doc', '.docx', '.jpg', '.png', '.xls', '.xlsx', '.csv', '.txt', '.zip'].map((ext) => {
            const isSelected = (config.allowedTypes || []).includes(ext);
            return (
              <button
                key={ext}
                type="button"
                onClick={() => {
                  const current = config.allowedTypes || [];
                  onChange('allowedTypes', isSelected ? current.filter((t) => t !== ext) : [...current, ext]);
                }}
                className={`chip ${isSelected ? 'chip-active' : 'chip-default'}`}
              >
                {ext}
              </button>
            );
          })}
        </div>
        {(config.allowedTypes?.length || 0) > 0 && (
          <p className="text-[11px] text-gray-400">
            {t('builder.extensionsSelected', { count: config.allowedTypes.length })}
          </p>
        )}
      </div>
      <div>
        <label className="input-label">{t('builder.maxFileSizeBytes')}</label>
        <input
          type="number"
          value={config.maximumSize ?? ''}
          onChange={(e) => handleNumberChange('maximumSize', e.target.value)}
          placeholder={t('builder.sizeExample')}
          min="0"
          className="input-field"
        />
        <p className="text-[11px] text-gray-400 mt-1">{t('builder.leaveEmptyForNoLimit')}</p>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          id="allow-multiple-files"
          checked={!!config.multiple}
          onChange={(e) => onChange('multiple', e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
        />
        <label htmlFor="allow-multiple-files" className="text-sm text-gray-700 cursor-pointer select-none">
          {t('builder.allowMultipleFiles')}
        </label>
      </div>
    </>
  );

  // ─── Rating ──────────────────────────────────────────────────────────
  const renderRatingConfig = () => (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="input-label">{t('builder.minStars')}</label>
        <input
          type="number"
          value={config.minimumStars ?? 1}
          onChange={(e) => handleNumberChange('minimumStars', e.target.value)}
          min="1"
          max="10"
          className="input-field"
        />
      </div>
      <div>
        <label className="input-label">{t('builder.maxStars')}</label>
        <input
          type="number"
          value={config.maximumStars ?? 5}
          onChange={(e) => handleNumberChange('maximumStars', e.target.value)}
          min="1"
          max="10"
          className="input-field"
        />
      </div>
      <div>
        <label className="input-label">{t('builder.default')}</label>
        <input
          type="number"
          value={config.defaultRating ?? ''}
          onChange={(e) => handleNumberChange('defaultRating', e.target.value)}
          placeholder={t('builder.none')}
          min="1"
          max="10"
          className="input-field"
        />
      </div>
    </div>
  );

  // ─── Router ──────────────────────────────────────────────────────────
  const renderConfigByType = () => {
    switch (fieldType?.id) {
      case 'text': return renderTextConfig();
      case 'number': return renderNumberConfig();
      case 'email': return renderEmailConfig();
      case 'dropdown': return renderDropdownConfig();
      case 'checkbox': return renderCheckboxConfig();
      case 'date': return renderDateConfig();
      case 'file': return renderFileConfig();
      case 'rating': return renderRatingConfig();
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Label — every field type has this */}
      <div>
        <label className="input-label">
          {t('builder.label')} <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder={t('builder.enterLabel', { type: fieldType?.name?.toLowerCase() || 'field' })}
          className="input-field"
        />
      </div>

      {renderConfigByType()}

      {/* Required toggle */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <label htmlFor="field-required-config" className="text-sm font-medium text-gray-700 select-none cursor-pointer">
          {t('builder.requiredField')}
        </label>
        <div className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            id="field-required-config"
            checked={required}
            onChange={(e) => onRequiredChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-10 h-6 bg-gray-200 rounded-full peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white" />
        </div>
      </div>
    </div>
  );
};
