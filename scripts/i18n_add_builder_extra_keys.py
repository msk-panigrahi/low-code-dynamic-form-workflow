"""Add remaining builder.* and common.* keys to the EN locale (other locales fall back to EN)."""
import json
import os

LOCALES_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src', 'i18n', 'locales')

NEW_KEYS = {
    'common.error': 'Error',
    'builder.validation': 'Validation',
    'builder.placeholderLabel': 'Placeholder: {{value}}',
    'builder.minLengthLabel': 'Min Length: {{value}}',
    'builder.maxLengthLabel': 'Max Length: {{value}}',
    'builder.minimumLabel': 'Minimum: {{value}}',
    'builder.maximumLabel': 'Maximum: {{value}}',
    'builder.fromLabel': 'From: {{value}}',
    'builder.toLabel': 'To: {{value}}',
    'builder.allowedLabel': 'Allowed: {{value}}',
    'builder.maxLabel': 'Max: {{value}} MB',
    'builder.maxStarsLabel': 'Max Stars: {{value}}',
    'builder.optionsCount': '{{count}} options',
    'builder.optionsCount_one': '{{count}} option',
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
