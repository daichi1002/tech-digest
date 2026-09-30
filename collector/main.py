"""Daily pipeline.

Routine mode (free, Claude Code subscription) — see CURATE.md:
  python -m collector.main collect   # fetch sources -> work/candidates.json (run by GitHub Actions)
  (Claude Code routine writes work/curated.json)
  python -m collector.main publish   # validate -> site/data/YYYY-MM-DD.json

API mode (paid, needs ANTHROPIC_API_KEY):
  python -m collector.main run-api   # collect + Claude API curation + publish
"""

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from collector import config, editorial
from collector.sources import github_trending, hn, lobsters, rss, zenn

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "site" / "data"
WORK_DIR = ROOT / "work"
CANDIDATES = WORK_DIR / "candidates.json"
CURATED = WORK_DIR / "curated.json"
JST = timezone(timedelta(hours=9))


def _today() -> str:
    return datetime.now(JST).date().isoformat()


def _norm(url: str) -> str:
    p = urlsplit(url)
    return urlunsplit((p.scheme, p.netloc.lower().removeprefix("www."), p.path.rstrip("/"), "", ""))


def _recent_urls() -> set[str]:
    """URLs published in digests from the previous DEDUPE_DAYS days (today excluded, so re-runs work)."""
    today = datetime.now(JST).date()
    urls = set()
    for n in range(1, config.DEDUPE_DAYS + 1):
        path = DATA_DIR / f"{today - timedelta(days=n)}.json"
        if path.exists():
            urls |= {_norm(it["url"]) for it in json.loads(path.read_text())["items"]}
    return urls


def collect() -> list[dict]:
    fetched = hn.fetch() + lobsters.fetch() + github_trending.fetch() + zenn.fetch() + rss.fetch()
    if config.GROK_ENABLED:
        from collector.sources import grok
        fetched = grok.fetch() + fetched

    published = _recent_urls()
    seen: dict[str, dict] = {}
    for item in fetched:
        if not editorial.safe_url(item.get("url")) or not item.get("title"):
            continue
        key = _norm(item["url"])
        if key not in seen and key not in published:
            seen[key] = item
    candidates = list(seen.values())
    print(f"[collect] {len(candidates)} unique candidates")
    return candidates


def write_digest(digest: dict) -> None:
    today = _today()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    digest = {
        "date": today,
        "generated_at": datetime.now(JST).isoformat(timespec="minutes"),
        "categories": config.CATEGORIES,
        **digest,
    }
    (DATA_DIR / f"{today}.json").write_text(json.dumps(digest, ensure_ascii=False, indent=2))

    index_path = DATA_DIR / "index.json"
    index = json.loads(index_path.read_text()) if index_path.exists() else {"dates": []}
    dates = sorted(set(index["dates"]) | {today}, reverse=True)
    index_path.write_text(json.dumps({"dates": dates}, indent=2))
    print(f"[publish] wrote {len(digest['items'])} items for {today}")


def cmd_collect() -> None:
    candidates = collect()
    if not candidates:
        sys.exit("[collect] no candidates collected")
    WORK_DIR.mkdir(exist_ok=True)
    listing = [{"id": i, **c} for i, c in enumerate(candidates)]
    CANDIDATES.write_text(json.dumps({"date": _today(), "candidates": listing}, ensure_ascii=False, indent=1))
    CURATED.unlink(missing_ok=True)
    print(f"[collect] wrote {CANDIDATES.relative_to(ROOT)}")


def cmd_publish() -> None:
    data = json.loads(CANDIDATES.read_text())
    if data["date"] != _today():
        sys.exit(f"[publish] candidates are from {data['date']}, not today ({_today()}); collection did not run")
    candidates = data["candidates"]
    try:
        result = json.loads(CURATED.read_text())
    except (FileNotFoundError, json.JSONDecodeError) as e:
        sys.exit(f"[publish] cannot read {CURATED.relative_to(ROOT)}: {e}")
    errors = editorial.validate(result, len(candidates))
    if errors:
        sys.exit("[publish] invalid curated.json:\n  " + "\n  ".join(errors))
    write_digest(editorial.assemble(candidates, result))


def cmd_run_api() -> None:
    from collector.curate import curate
    candidates = collect()
    if not candidates:
        sys.exit("[collect] no candidates collected")
    write_digest(curate(candidates))


COMMANDS = {"collect": cmd_collect, "publish": cmd_publish, "run-api": cmd_run_api}

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in COMMANDS:
        sys.exit(__doc__)
    COMMANDS[sys.argv[1]]()
