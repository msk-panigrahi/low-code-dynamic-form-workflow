"""Apply authored flat translation files to all locale files.

Usage: python scripts/i18n_apply_all.py
Reads scripts/translations/<lang>.json (flat key -> value) and merges each
into frontend/src/i18n/locales/<lang>/translation.json by setting the nested
value at the dotted key path (creating intermediate dicts as needed).
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from i18n_apply_translations import apply_translations  # noqa: E402

LANGS = [
    "bn", "gu", "kn", "ml", "mr", "pa", "ta", "te",
    "ur", "ar", "zh", "ja", "ko",
    "de", "es", "fr", "it", "pt",
]

BASE = os.path.dirname(__file__)
LOCALES_DIR = os.path.normpath(
    os.path.join(BASE, "..", "frontend", "src", "i18n", "locales")
)
TRANSLATIONS_DIR = os.path.join(BASE, "translations")


def flat(d, p=''):
    for k, v in d.items():
        if isinstance(v, dict):
            yield from flat(v, p + k + '.')
        else:
            yield (p + k, v)


with open(os.path.join(LOCALES_DIR, "en", "translation.json"), encoding="utf-8") as f:
    en_map = dict(flat(json.load(f)))

for lang in LANGS:
    tpath = os.path.join(TRANSLATIONS_DIR, f"{lang}.json")
    if not os.path.exists(tpath):
        print(f"[SKIP] {lang}: no authored file at {tpath}")
        continue
    with open(tpath, encoding="utf-8") as f:
        flat = json.load(f)
    lpath = os.path.join(LOCALES_DIR, lang, "translation.json")
    with open(lpath, encoding="utf-8") as f:
        locale = json.load(f)
    applied, skipped, errors = apply_translations(locale, flat, en_map)
    with open(lpath, "w", encoding="utf-8") as f:
        json.dump(locale, f, ensure_ascii=False, indent=2)
        f.write("\n")
    status = f"[OK] {lang}: applied={applied} preserved={skipped}"
    if errors:
        status += f" ERRORS={len(errors)}"
    print(status)
    for e in errors[:10]:
        print("   ", e)

print("Done.")
