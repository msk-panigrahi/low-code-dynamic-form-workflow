"""Add new builder.* keys to the EN locale (other locales fall back to EN)."""
import json
import os

LOCALES_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src', 'i18n', 'locales')

NEW_KEYS = {
    'builder.titleRequired': 'Form title is required',
    'builder.createFailed': 'Failed to create form',
    'builder.titlePlaceholder': 'e.g. Customer Feedback Survey',
    'builder.descPlaceholder': 'e.g. Help us improve our service by filling out this quick survey',
    'builder.creating': 'Creating Form...',
    'builder.createButton': 'Create Form',
    'builder.fieldLabelRequired': 'Field label is required',
    'builder.cannotEditNoId': 'Cannot edit field without ID',
    'builder.saveFailed': 'Failed to save field',
    'builder.updateFailed': 'Failed to update field',
    'builder.deleteFailed': 'Failed to delete field',
    'builder.duplicateFailed': 'Failed to duplicate field',
    'builder.reorderFailed': 'Failed to save new order',
    'builder.copySuffix': ' (Copy)',
    'builder.fieldCount': '{{count}} fields',
    'builder.fieldCount_one': '{{count}} field',
    'builder.builder': 'Builder',
    'builder.preview': 'Preview',
    'builder.publish': 'Publish',
    'builder.archive': 'Archive',
    'builder.new': 'New',
    'builder.generating': 'Generating...',
    'builder.shareableLink': 'Shareable Link',
    'builder.addFieldFirst': 'Add at least one field first',
    'builder.publishThisForm': 'Publish this form',
    'builder.formStats': 'Form Stats',
    'builder.editAsNewDraft': 'Edit as New Draft',
    'builder.locked': 'Locked',
    'builder.immutableHint': 'This version is immutable. {{action}}',
    'builder.createDraftHint': 'Create a new draft to make changes.',
    'builder.archivedHint': 'Archived forms cannot receive new submissions.',
    'builder.dragToReorder': 'Drag to reorder',
    'builder.immutable': 'Immutable',
    'builder.editProperties': 'Edit properties',
    'builder.duplicate': 'Duplicate',
    'builder.delete': 'Delete',
    'builder.clearHighlight': 'Click to clear highlight',
    'builder.highlightRules': 'Click to highlight related rules',
    'builder.logic': 'Logic',
    'builder.required': 'Required',
    'builder.thisField': 'this field',
    'builder.formCreatedToast': 'Form Created',
    'builder.formCreatedMsg': '"{{title}}" has been created successfully',
    'builder.fieldAddedToast': 'Field Added',
    'builder.fieldAddedMsg': '"{{label}}" has been added to the form',
    'builder.fieldUpdatedToast': 'Field Updated',
    'builder.fieldUpdatedMsg': '"{{label}}" has been updated',
    'builder.fieldDeletedToast': 'Field Deleted',
    'builder.fieldDeletedMsg': '"{{label}}" has been deleted',
    'builder.fieldDeletedNoIdMsg': 'Field removed from form',
    'builder.fieldDuplicatedToast': 'Field Duplicated',
    'builder.fieldDuplicatedMsg': '"{{label}}" has been duplicated',
    'builder.fieldsReorderedToast': 'Fields Reordered',
    'builder.fieldsReorderedMsg': 'The field order has been updated',
    'builder.linkGeneratedToast': 'Link Generated',
    'builder.linkGeneratedMsg': 'Shareable link created successfully',
    'builder.generateLinkFailed': 'Generate Link Failed',
    'builder.generateLinkErr': 'Failed to generate shareable link',
    'builder.publishedToast': 'Published',
    'builder.publishedMsg': 'Version {{version}} published successfully',
    'builder.publishFailedToast': 'Publish Failed',
    'builder.publishFailedErr': 'Failed to publish form',
    'builder.archivedToast': 'Archived',
    'builder.archivedMsg': 'Form archived successfully',
    'builder.archiveFailedToast': 'Archive Failed',
    'builder.archiveFailedErr': 'Failed to archive form',
    'builder.draftCreatedToast': 'Draft Created',
    'builder.draftCreatedMsg': 'Draft version {{version}} created',
    'builder.draftCreateErr': 'Failed to create draft',
    'builder.loadVersionErr': 'Failed to load version',
    'builder.linkCopiedToast': 'Link Copied',
    'builder.linkCopiedMsg': '✓ Link Copied Successfully',
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
