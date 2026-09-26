"""Add validation.* keys to the EN locale (other locales fall back to EN)."""
import json
import os

LOCALES_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src', 'i18n', 'locales')

NEW_KEYS = {
    'validation.required': 'This field is required',
    'validation.minChars': 'Minimum {{count}} characters required',
    'validation.maxChars': 'Maximum length exceeded ({{count}} characters)',
    'validation.invalidNumber': 'Please enter a valid number',
    'validation.noDecimals': 'Decimal values are not allowed',
    'validation.minValue': 'Value must be at least {{value}}',
    'validation.maxValue': 'Value cannot exceed {{value}}',
    'validation.invalidEmail': 'Please enter a valid email address',
    'validation.invalidOption': 'Invalid option selected',
    'validation.minOptions_one': 'Please select at least {{count}} option',
    'validation.minOptions_other': 'Please select at least {{count}} options',
    'validation.maxOptions_one': 'Maximum {{count}} option allowed',
    'validation.maxOptions_other': 'Maximum {{count}} options allowed',
    'validation.invalidSelection': 'Please select a valid option',
    'validation.invalidDate': 'Invalid date (use YYYY-MM-DD format)',
    'validation.invalidDateShort': 'Invalid date',
    'validation.dateAfter': 'Date must be after {{date}}',
    'validation.dateBefore': 'Date cannot be after {{date}}',
    'validation.invalidFileType': 'Unsupported file type',
    'validation.fileTooLarge': 'Maximum file size exceeded',
    'validation.invalidRating': 'Please provide a valid rating',
    'validation.minRating_one': 'Minimum rating is {{count}} star',
    'validation.minRating_other': 'Minimum rating is {{count}} stars',
    'validation.maxRating_one': 'Maximum rating is {{count}} star',
    'validation.maxRating_other': 'Maximum rating is {{count}} stars',
}


def set_nested(data, dotted, value):
    parts = dotted.split('.')
    node = data
    for part in parts[:-1]:
        node = node.setdefault(part, {})
    node[parts[-1]] = value


def main():
    en_path = os.path.join(LOCALES_DIR, 'en', 'translation.json')
    with open(en_path, encoding='utf-8') as f:
        en = json.load(f)

    added = []
    for key, value in NEW_KEYS.items():
        parts = key.split('.')
        node = en
        exists = True
        for part in parts:
            if isinstance(node, dict) and part in node:
                node = node[part]
            else:
                exists = False
                break
        if not exists:
            set_nested(en, key, value)
            added.append(key)

    with open(en_path, 'w', encoding='utf-8') as f:
        json.dump(en, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f'Added {len(added)} keys: {added}')


if __name__ == '__main__':
    main()
