"""Pre-deploy checks for commits that publish a digest.

Usage:
  python scripts/check_data.py paths <file>...   # every changed path must be a digest file
  python scripts/check_data.py digests           # every site/data/*.json must match the published shape

The Claude Code routine reads third-party text and pushes straight to main, so a data commit is treated as
untrusted: it may only touch site/data/*.json, and those files must be plain data with http(s) links.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from collector import config  # noqa: E402
from collector.editorial import MAX_LEN, MAX_TAG_LEN, MAX_TAGS, safe_url  # noqa: E402

DATA_DIR = ROOT / "site" / "data"
DATA_PATH = re.compile(r"site/data/(\d{4}-\d{2}-\d{2}|index)\.json")
DATE = re.compile(r"\d{4}-\d{2}-\d{2}")
MAX_SHORT = 200


def check_paths(paths: list[str]) -> list[str]:
    return [f"{p}: data commits may only change site/data/*.json" for p in paths if not DATA_PATH.fullmatch(p)]


def _str(value: object, limit: int, optional: bool = False) -> bool:
    return (optional and value is None) or (isinstance(value, str) and len(value) <= limit)


def check_digest(path: Path) -> list[str]:
    d = json.loads(path.read_text())
    name = path.name
    errors = []
    if d.get("date") != path.stem:
        errors.append(f"{name}: date does not match file name")
    if not _str(d.get("generated_at"), 40):
        errors.append(f"{name}: generated_at must be a short string")
    if d.get("categories") != config.CATEGORIES:
        errors.append(f"{name}: categories differ from collector/config.py")
    if not _str(d.get("headline"), MAX_LEN["headline_ja"]):
        errors.append(f"{name}: headline must be a string <= {MAX_LEN['headline_ja']} chars")
    items = d.get("items")
    if not isinstance(items, list) or len(items) > config.MAX_ITEMS:
        return errors + [f"{name}: items must be a list of <= {config.MAX_ITEMS}"]
    for i, it in enumerate(items):
        where = f"{name}: items[{i}]"
        if not isinstance(it, dict):
            errors.append(f"{where} must be an object")
            continue
        if not safe_url(it.get("url")):
            errors.append(f"{where}.url must be http(s)")
        if it.get("post_url") is not None and not safe_url(it["post_url"]):
            errors.append(f"{where}.post_url must be http(s) or null")
        if not _str(it.get("title"), MAX_LEN["title_ja"]) or not _str(it.get("summary"), MAX_LEN["summary_ja"]):
            errors.append(f"{where}: title/summary missing or too long")
        if not _str(it.get("original_title"), 500) or not _str(it.get("author"), MAX_SHORT, optional=True):
            errors.append(f"{where}: original_title/author must be short strings")
        if not _str(it.get("source"), 20) or it.get("category") not in config.CATEGORIES:
            errors.append(f"{where}: bad source or category")
        score = it.get("score")
        if not isinstance(score, int) or isinstance(score, bool) or not 1 <= score <= 10:
            errors.append(f"{where}.score must be an integer 1..10")
        tags = it.get("tags")
        if not isinstance(tags, list) or len(tags) > MAX_TAGS or not all(_str(t, MAX_TAG_LEN) for t in tags):
            errors.append(f"{where}.tags must be <= {MAX_TAGS} short strings")
        related = it.get("related")
        if not isinstance(related, list) or not all(
            isinstance(r, dict) and _str(r.get("source"), 20) and safe_url(r.get("url")) for r in related
        ):
            errors.append(f"{where}.related must be a list of {{source, http(s) url}}")
    return errors


def check_digests() -> list[str]:
    errors = []
    index = json.loads((DATA_DIR / "index.json").read_text())
    dates = index.get("dates") if isinstance(index, dict) else None
    if not isinstance(dates, list) or not all(isinstance(x, str) and DATE.fullmatch(x) for x in dates):
        errors.append("index.json: dates must be a list of YYYY-MM-DD strings")
    for path in sorted(DATA_DIR.glob("*.json")):
        if path.name == "index.json":
            continue
        try:
            errors += check_digest(path)
        except (json.JSONDecodeError, AttributeError) as e:
            errors.append(f"{path.name}: {e}")
    return errors


def main() -> None:
    if len(sys.argv) >= 2 and sys.argv[1] == "paths":
        errors = check_paths(sys.argv[2:])
    elif sys.argv[1:] == ["digests"]:
        errors = check_digests()
    else:
        sys.exit(__doc__)
    for e in errors:
        print(f"::error::{e}")
    if errors:
        sys.exit(1)
    print("[check] ok")


if __name__ == "__main__":
    main()
