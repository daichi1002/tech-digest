"""Collect Zenn daily trending articles."""

import httpx

from collector import config

URL = "https://zenn.dev/api/articles"


def fetch() -> list[dict]:
    try:
        r = httpx.get(URL, params={"order": "daily", "count": config.ZENN_COUNT}, timeout=30)
        r.raise_for_status()
    except httpx.HTTPError as e:
        print(f"[zenn] failed: {e}")
        return []

    items = []
    for a in r.json().get("articles", []):
        if a.get("liked_count", 0) < config.ZENN_MIN_LIKES:
            continue
        author = (a.get("publication") or a.get("user") or {}).get("name") or (a.get("user") or {}).get("username")
        items.append({
            "source": "zenn",
            "title": a["title"],
            "url": f"https://zenn.dev{a['path']}",
            "author": author,
            "snippet": f"{a['liked_count']} likes, {a.get('article_type', '')}, published {a['published_at'][:10]}",
        })
    print(f"[zenn] {len(items)} items")
    return items
