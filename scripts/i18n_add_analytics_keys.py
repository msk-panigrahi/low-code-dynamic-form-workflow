"""Add analytics.* keys to the EN locale (other locales fall back to EN)."""
import json
import os

LOCALES_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src', 'i18n', 'locales')

NEW_KEYS = {
    # nav
    'nav.analytics': 'Analytics',
    # builder tab
    'builder.analytics': 'Analytics',
    # analytics page + per-form screen
    'analytics.title': 'Analytics',
    'analytics.subtitle': 'Monitor form performance, completion rates and response insights',
    'analytics.totalForms': 'Total Forms',
    'analytics.totalSubmissions': 'Total Submissions',
    'analytics.completionRate': 'Completion Rate',
    'analytics.averageTime': 'Average Time',
    'analytics.startedSessions': 'Started Sessions',
    'analytics.perFormTitle': 'Form Analytics',
    'analytics.viewFormAnalytics': 'View analytics for {{name}}',
    'analytics.formAnalytics': 'Form Analytics',
    'analytics.environment': 'Environment',
    'analytics.env.production': 'Production',
    'analytics.env.development': 'Development',
    'analytics.refresh': 'Refresh',
    'analytics.loadFailed': 'Failed to load analytics. Please try again.',
    'analytics.loadFailedTitle': 'Could not load analytics',
    'analytics.emptyTitle': 'No Analytics Available Yet',
    'analytics.emptyDesc': 'Once respondents start submitting, insights like completion rate and average time will appear here.',
    'analytics.chartsTitle': 'Trends & Charts',
    'analytics.chartsComingSoon': 'Charts Coming Soon',
    'analytics.chartsDesc': 'Interactive charts for submission trends, field analytics and export will land here.',
    'analytics.comingSoon': 'Coming Soon',
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
