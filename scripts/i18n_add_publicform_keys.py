"""Add remaining publicForm.* keys to the EN locale (other locales fall back to EN)."""
import json
import os

LOCALES_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src', 'i18n', 'locales')

NEW_KEYS = {
    'publicForm.goHome': 'Go Home',
    'publicForm.close': 'Close',
    'publicForm.openPdf': 'Open PDF',
    'publicForm.openFile': 'Open File',
    'publicForm.pdfHint': 'This PDF will open in a new tab for preview.',
    'publicForm.textHint': 'This text file will open in a new tab.',
    'publicForm.previewNotAvailable': 'Preview is not available for this file type',
    'publicForm.fileLabel': 'File: {{name}} · {{size}} KB · .{{ext}}',
    'publicForm.unknownType': 'Unknown',
    'publicForm.allFileTypes': 'All file types',
    'publicForm.maxSizeBadge': 'Max: {{size}}',
    'publicForm.multipleFiles': 'Multiple files',
    'publicForm.clickToUploadOne': 'Click to upload a file',
    'publicForm.clickToUploadMany': 'Click to upload files',
    'publicForm.dropFilesHere': 'Drop files here',
    'publicForm.dragAndDropOne': 'or drag and drop here',
    'publicForm.dragAndDropMany': 'Drag and drop files here',
    'publicForm.addMoreFiles': 'Add more files',
    'publicForm.unsupportedFileType': 'Unsupported file type',
    'publicForm.maxFileSize': 'Maximum file size is {{size}}MB',
    'publicForm.previewFile': 'Preview {{name}}',
    'publicForm.removeFile': 'Remove {{name}}',
    'publicForm.uploadAriaOne': 'Upload a file. Click or drag a file here.',
    'publicForm.uploadAriaMany': 'Upload files. Click or drag files here.',
    'publicForm.enterLabel': 'Enter {{label}}',
    'publicForm.enterPassword': 'Enter password',
    'publicForm.disabled': 'Disabled',
    'publicForm.invalidLink': 'Invalid or expired public link.',
    'publicForm.failedLoadServer': 'Failed to load form. Server may be unavailable.',
    'publicForm.closePreview': 'Close preview',
    'publicForm.shareForm': 'Share this form',
    'publicForm.noResponsesYet': 'No responses yet',
    'publicForm.copied': 'Copied!',
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
