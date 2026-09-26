"""Post-translation validation: JSON validity + remaining EN-placeholder count per locale.

Usage: python scripts/i18n_validate_translations.py
Prints per-locale: total keys, keys still identical to EN (placeholders), and
lists placeholder keys (limited) so intentional ones (e.g. app.name) can be confirmed.
"""
import json
import os

LOCALES_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "frontend", "src", "i18n", "locales")
)
LANGS = [
    "en", "hi", "bn", "gu", "kn", "ml", "mr", "pa", "ta", "te",
    "ur", "ar", "zh", "ja", "ko", "de", "es", "fr", "it", "pt",
]


def flat(d, p=""):
    for k, v in d.items():
        if isinstance(v, dict):
            yield from flat(v, p + k + ".")
        else:
            yield (p + k, v)


with open(os.path.join(LOCALES_DIR, "en", "translation.json"), encoding="utf-8") as f:
    en_map = dict(flat(json.load(f)))

ok = True
for lang in LANGS:
    path = os.path.join(LOCALES_DIR, lang, "translation.json")
    try:
        with open(path, encoding="utf-8") as f:
            loc = json.load(f)
    except json.JSONDecodeError as e:
        print(f"[INVALID JSON] {lang}: {e}")
        ok = False
        continue
    loc_map = dict(flat(loc))
    placeholders = [k for k, v in loc_map.items() if k in en_map and v == en_map[k]]
    missing = [k for k in en_map if k not in loc_map]
    extra = [k for k in loc_map if k not in en_map]
    status = "OK"
    if missing:
        status = f"MISSING {len(missing)}"
        ok = False
    if lang != "en" and extra:
        status += f" EXTRA {len(extra)}"
    print(
        f"[{status}] {lang}: total={len(loc_map)} placeholders={len(placeholders)}"
        + (f" missing={len(missing)}" if missing else "")
        + (f" extra={len(extra)}" if extra and lang != "en" else "")
    )
    if placeholders and lang in ("hi", "ar", "de"):
        print("    placeholder sample:", placeholders[:8])

print("\nALL OK" if ok else "\nISSUES FOUND")
