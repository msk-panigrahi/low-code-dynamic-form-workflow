"""Verify authored translations preserve {{...}} interpolation tokens from EN.

For each authored flat file in scripts/translations/, checks that every key's
value contains exactly the same set of {{token}} occurrences as the EN value.
Run: python scripts/i18n_check_tokens.py
"""
import json
import os
import re

BASE = os.path.dirname(__file__)
LOCALES_DIR = os.path.normpath(
    os.path.join(BASE, "..", "frontend", "src", "i18n", "locales")
)
TRANSLATIONS_DIR = os.path.join(BASE, "translations")

TOKEN_RE = re.compile(r"\{\{[^}]+\}\}")


def flat(d, p=""):
    for k, v in d.items():
        if isinstance(v, dict):
            yield from flat(v, p + k + ".")
        else:
            yield (p + k, v)


with open(os.path.join(LOCALES_DIR, "en", "translation.json"), encoding="utf-8") as f:
    en_map = dict(flat(json.load(f)))

problems = 0
checked = 0
for fname in sorted(os.listdir(TRANSLATIONS_DIR)):
    if not fname.endswith(".json"):
        continue
    lang = fname[:-5]
    with open(os.path.join(TRANSLATIONS_DIR, fname), encoding="utf-8") as f:
        data = json.load(f)
    for key, value in data.items():
        if key not in en_map:
            continue  # dead key (not in EN) reported separately
        en_tokens = TOKEN_RE.findall(en_map[key])
        val_tokens = TOKEN_RE.findall(value)
        # Compare as multisets: natural-language word order legitimately
        # reorders tokens; what matters is none are dropped or added.
        if sorted(en_tokens) != sorted(val_tokens):
            problems += 1
            print(
                f"[TOKEN MISMATCH] {lang}.{key}: EN={en_map[key]!r} -> {value!r}"
            )
        checked += 1

print(f"\nChecked {checked} authored values.")
if problems:
    print(f"FOUND {problems} token mismatches")
    raise SystemExit(1)
print("ALL TOKENS PRESERVED")
