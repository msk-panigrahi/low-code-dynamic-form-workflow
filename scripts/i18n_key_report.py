"""Report translation keys used in frontend components vs. locale files.

Usage: python scripts/i18n_key_report.py
"""
import json
import os
import re
import sys

FRONTEND_SRC = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src')
LOCALES_DIR = os.path.join(FRONTEND_SRC, 'i18n', 'locales')

KEY_RE = re.compile(r"t\(['\"]([^'\"]+)['\"]")


def walk(path):
    for root, _dirs, files in os.walk(path):
        for f in files:
            if f.endswith('.jsx') or f.endswith('.js'):
                yield os.path.join(root, f)


def flatten(data, prefix=''):
    """Yield dotted paths for every leaf in a JSON object."""
    if isinstance(data, dict):
        for k, v in data.items():
            yield from flatten(v, f'{prefix}.{k}' if prefix else k)
    elif isinstance(data, list):
        for i, v in enumerate(data):
            yield from flatten(v, f'{prefix}.{i}')
    else:
        yield prefix


def main():
    used_keys = set()
    for path in walk(FRONTEND_SRC):
        if 'locales' in path or 'i18n' in path.replace('\\', '/'):
            continue
        with open(path, encoding='utf-8') as f:
            text = f.read()
        for m in KEY_RE.finditer(text):
            used_keys.add(m.group(1))

    locale_files = {}
    for code in os.listdir(LOCALES_DIR):
        ldir = os.path.join(LOCALES_DIR, code)
        if not os.path.isdir(ldir):
            continue
        tpath = os.path.join(ldir, 'translation.json')
        with open(tpath, encoding='utf-8') as f:
            locale_files[code] = set(flatten(json.load(f)))

    en_keys = locale_files.get('en', set())
    missing_en = sorted(k for k in used_keys if k not in en_keys)
    print(f'Used keys: {len(used_keys)}')
    print(f'Keys missing from EN: {len(missing_en)}')
    for k in missing_en:
        print(f'  MISSING EN: {k}')
    print()
    for code, keys in locale_files.items():
        missing = sorted(k for k in used_keys if k not in keys)
        if missing:
            print(f'{code}: {len(missing)} missing')


if __name__ == '__main__':
    main()
