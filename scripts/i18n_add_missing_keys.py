"""Add missing keys to the EN locale and verify array keys stay arrays.

Only the EN locale needs the new keys — i18next falls back to EN for
any key missing in other locales (fallbackLng: 'en').

Usage: python scripts/i18n_add_missing_keys.py
"""
import json
import os
import sys

LOCALES_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src', 'i18n', 'locales')

# Keys that were genuinely referenced but missing from EN.
MISSING_EN = {
    'auth.accessDenied': 'Access Denied',
    'auth.goToLogin': 'Go to Login',
    'auth.loginRequired': 'Please log in to access this page.',
    'publicForm.uploaded': 'Uploaded',
    'publicForm.saveIdReminder': "Please save your Response ID for future reference. You'll need it to track your submission.",
    'publicForm.poweredBy': 'Powered by Low-Code Form Builder',
    'settings.languageHint': 'Choose your preferred language. It will be applied instantly across the app.',
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
    for key, value in MISSING_EN.items():
        parts = key.split('.')
        # Check the key truly doesn't exist at that exact leaf.
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
    print(f'Added {len(added)} keys to EN: {added}')

    # Verify strengthLabels is an array in every locale (Register uses returnObjects).
    problems = []
    for code in os.listdir(LOCALES_DIR):
        tpath = os.path.join(LOCALES_DIR, code, 'translation.json')
        if not os.path.isfile(tpath):
            continue
        with open(tpath, encoding='utf-8') as f:
            data = json.load(f)
        sl = data.get('auth', {}).get('strengthLabels')
        if not isinstance(sl, list):
            problems.append(f'{code}: strengthLabels={type(sl).__name__}')
    if problems:
        print('PROBLEMS:', problems)
        sys.exit(1)
    print('strengthLabels is an array in all locales. OK')


if __name__ == '__main__':
    main()
