"""Collect hottest Lobsters stories from the last 24 hours."""

import time
from datetime import datetime

import httpx

URL = "https://lobste.rs/hottest.json"


def fetch() -> list[dict]:
    try:
        r = httpx.get(URL, timeout=30, headers={"User-Agent": "tech-digest/0.1"})
        r.raise_for_status()
    except httpx.HTTPError as e:
        print(f"[lobsters] failed: {e}")
        return []

    since = time.time() - 86400
    items = []
    for s in r.json():
        try:
            if datetime.fromisoformat(s["created_at"]).timestamp() < since:
                continue
            items.append({
                "source": "lobsters",
                "title": s["title"],
                "url": s.get("url") or s["comments_url"],
                "post_url": s["comments_url"],
                "snippet": f"{s['score']} points, tags: {', '.join(s.get('tags', []))}",
            })
        except (KeyError, TypeError, ValueError) as e:
            print(f"[lobsters] skipped malformed story: {e!r}")
    print(f"[lobsters] {len(items)} items")
    return items
