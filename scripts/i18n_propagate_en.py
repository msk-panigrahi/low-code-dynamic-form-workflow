"""Propagate missing EN keys into every locale.

Adds any key present in EN but missing in a locale (deep merge, preserving
existing translations). New keys get the English value as a placeholder so
every locale has a complete, consistent key structure — translators can then
fill in the translations and i18next falls back to EN for anything left.

Usage: python scripts/i18n_propagate_en.py
"""
import json
import os

LOCALES_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src', 'i18n', 'locales')


def merge_missing(en, data):
    """Deep-merge EN into data, adding only keys that are missing."""
    added = 0
    for key, value in en.items():
        if isinstance(value, dict):
            if not isinstance(data.get(key), dict):
                data[key] = {}
            added += merge_missing(value, data[key])
        elif key not in data:
            data[key] = value
            added += 1
    return added


def main():
    en_path = os.path.join(LOCALES_DIR, 'en', 'translation.json')
    with open(en_path, encoding='utf-8') as f:
        en = json.load(f)

    total = 0
    for code in sorted(os.listdir(LOCALES_DIR)):
        if code == 'en':
            continue
        tpath = os.path.join(LOCALES_DIR, code, 'translation.json')
        if not os.path.isfile(tpath):
            continue
        with open(tpath, encoding='utf-8') as f:
            data = json.load(f)
        added = merge_missing(en, data)
        with open(tpath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')
        total += added
        print(f'{code}: +{added} keys')

    print(f'\nTotal keys added across locales: {total}')


if __name__ == '__main__':
    main()
