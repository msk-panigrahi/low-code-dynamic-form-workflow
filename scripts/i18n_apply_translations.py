"""Apply curated per-language translations to a locale file.

Only keys whose current value still equals the EN placeholder value are
overwritten, so pre-existing (hand-authored) translations are preserved and
the script is idempotent/re-runnable.

Usage: python scripts/i18n_apply_translations.py <lang_code> <data.json>
"""
import json
import os
import sys

LOCALES_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src', 'i18n', 'locales')


def set_nested(data, dotted, value):
    parts = dotted.split('.')
    node = data
    for part in parts[:-1]:
        node = node.setdefault(part, {})
    node[parts[-1]] = value


def apply_translations(loc, data, en_map):
    """Merge flat key->value translations into a locale dict.

    Only keys whose current value still equals the EN placeholder value are
    overwritten, preserving pre-existing (hand-authored) translations.
    Returns (applied, skipped, errors).
    """
    def flat(d, p=''):
        for k, v in d.items():
            if isinstance(v, dict):
                yield from flat(v, p + k + '.')
            else:
                yield (p + k, v)

    loc_map = dict(flat(loc))

    applied = 0
    skipped = 0
    errors = []
    for key, value in data.items():
        if key not in en_map:
            errors.append(f'NOT IN EN: {key}')
            continue
        if loc_map.get(key) == en_map[key]:
            set_nested(loc, key, value)
            applied += 1
        else:
            skipped += 1  # pre-existing translation — preserve it
    return applied, skipped, errors


def main():
    code = sys.argv[1]
    data_path = sys.argv[2]

    en_path = os.path.join(LOCALES_DIR, 'en', 'translation.json')
    loc_path = os.path.join(LOCALES_DIR, code, 'translation.json')

    with open(en_path, encoding='utf-8') as f:
        en = json.load(f)
    with open(loc_path, encoding='utf-8') as f:
        loc = json.load(f)
    with open(data_path, encoding='utf-8') as f:
        data = json.load(f)

    def flat(d, p=''):
        for k, v in d.items():
            if isinstance(v, dict):
                yield from flat(v, p + k + '.')
            else:
                yield (p + k, v)

    en_map = dict(flat(en))

    applied, skipped, errors = apply_translations(loc, data, en_map)

    with open(loc_path, 'w', encoding='utf-8') as f:
        json.dump(loc, f, ensure_ascii=False, indent=2)
        f.write('\n')

    print(f'{code}: applied={applied} preserved={skipped}')
    if errors:
        print('ERRORS:')
        for e in errors[:30]:
            print(' ', e)
        sys.exit(1)


if __name__ == '__main__':
    main()
