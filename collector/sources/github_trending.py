"""Collect today's GitHub trending repositories by parsing the trending page."""

import html
import re

import httpx

URL = "https://github.com/trending?since=daily"


def _text(s: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def fetch() -> list[dict]:
    try:
        r = httpx.get(URL, timeout=30, headers={"User-Agent": "tech-digest/0.1"})
        r.raise_for_status()
    except httpx.HTTPError as e:
        print(f"[github] failed: {e}")
        return []

    items = []
    for block in r.text.split('<article class="Box-row">')[1:]:
        repo = re.search(r'<h2[^>]*>.*?href="/([^/"]+/[^/"]+)"', block, re.DOTALL)
        if not repo:
            continue
        desc = re.search(r'<p class="col-9[^"]*">(.*?)</p>', block, re.DOTALL)
        lang = re.search(r'itemprop="programmingLanguage">(.*?)<', block)
        today = re.search(r"([\d,]+) stars today", block)
        name = repo.group(1)
        items.append({
            "source": "github",
            "title": name,
            "url": f"https://github.com/{name}",
            "snippet": " / ".join(filter(None, [
                _text(desc.group(1)) if desc else "",
                lang.group(1) if lang else "",
                f"{today.group(1)} stars today" if today else "",
            ])),
        })
    print(f"[github] {len(items)} items")
    return items
