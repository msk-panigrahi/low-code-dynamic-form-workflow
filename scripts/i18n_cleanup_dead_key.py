"""Remove dead keys (not present in EN) from all authored translation files."""
import json
import os

BASE = os.path.dirname(__file__)
LOCALES_DIR = os.path.normpath(
    os.path.join(BASE, "..", "frontend", "src", "i18n", "locales")
)
TRANSLATIONS_DIR = os.path.join(BASE, "translations")


def flat(d, p=""):
    for k, v in d.items():
        if isinstance(v, dict):
            yield from flat(v, p + k + ".")
        else:
            yield (p + k, v)


with open(os.path.join(LOCALES_DIR, "en", "translation.json"), encoding="utf-8") as f:
    en_map = set(k for k, _ in flat(json.load(f)))

total = 0
for fname in sorted(os.listdir(TRANSLATIONS_DIR)):
    if not fname.endswith(".json"):
        continue
    path = os.path.join(TRANSLATIONS_DIR, fname)
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    dead = [k for k in data if k not in en_map]
    if dead:
        for k in dead:
            del data[k]
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"{fname}: removed {dead}")
        total += len(dead)

print(f"Removed {total} dead keys total.")
