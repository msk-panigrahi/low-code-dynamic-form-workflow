"""Add new responses.* keys to the EN locale (other locales fall back to EN)."""
import json
import os

LOCALES_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src', 'i18n', 'locales')

NEW_KEYS = {
    'responses.subtitle': 'View and manage form submissions',
    'responses.details': 'Response Details',
    'responses.submittedOn': 'Submitted {{date}}',
    'responses.fieldResponses': 'Field Responses ({{count}})',
    'responses.noFieldResponses': 'No field responses recorded for this submission.',
    'responses.noFormsDesc': 'Create and publish a form to start collecting responses.',
    'responses.createForm': 'Create a Form',
    'responses.responseCount_one': '{{count}} response',
    'responses.responseCount_other': '{{count}} responses',
    'responses.totalCount': '{{count}} total',
    'responses.submissions': 'Submissions',
    'responses.searchPlaceholder': 'Search by Response ID...',
    'responses.noMatches': 'No matches found',
    'responses.tryDifferentQuery': 'Try a different search query.',
    'responses.noSubmissionsDesc': "Share your form's public link to start collecting responses.",
    'responses.responseId': 'Response ID',
    'responses.date': 'Date',
    'responses.fields': 'Fields',
    'responses.status': 'Status',
    'responses.actions': 'Actions',
    'responses.view': 'View',
    'responses.pageOf': 'Page {{current}} of {{total}}',
    'responses.previous': 'Previous',
    'responses.next': 'Next',
    'responses.noData': 'No data found',
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
