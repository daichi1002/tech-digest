"""Collect entries published in the last 24 hours from RSS/Atom feeds."""

import calendar
import re
import time

import feedparser

from collector import config


def _clean(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or "")).strip()[:400]


def fetch() -> list[dict]:
    since = time.time() - 86400
    items = []
    for feed_url in config.RSS_FEEDS:
        feed = feedparser.parse(feed_url)
        if feed.bozo and not feed.entries:
            print(f"[rss] failed: {feed_url}")
            continue
        for e in feed.entries:
            ts = e.get("published_parsed") or e.get("updated_parsed")
            if not ts or calendar.timegm(ts) < since:
                continue
            items.append({
                "source": "reddit" if "reddit.com" in feed_url else "rss",
                "feed": feed.feed.get("title", feed_url),
                "title": e.get("title", ""),
                "url": e.get("link", ""),
                "snippet": _clean(e.get("summary", "")),
            })
    print(f"[rss] {len(items)} items")
    return items
