"""Collect top Hacker News stories from the last 24 hours via the Algolia API."""

import time

import httpx

from collector import config

URL = "https://hn.algolia.com/api/v1/search"


def fetch() -> list[dict]:
    since = int(time.time()) - 86400
    params = {
        "tags": "story",
        "numericFilters": f"created_at_i>{since},points>{config.HN_MIN_POINTS}",
        "hitsPerPage": 50,
    }
    try:
        r = httpx.get(URL, params=params, timeout=30)
        r.raise_for_status()
    except httpx.HTTPError as e:
        print(f"[hn] failed: {e}")
        return []

    items = []
    for h in r.json().get("hits", []):
        hn_url = f"https://news.ycombinator.com/item?id={h['objectID']}"
        items.append({
            "source": "hn",
            "title": h.get("title", ""),
            "url": h.get("url") or hn_url,
            "post_url": hn_url,
            "snippet": f"{h.get('points', 0)} points, {h.get('num_comments', 0)} comments",
        })
    print(f"[hn] {len(items)} items")
    return items
