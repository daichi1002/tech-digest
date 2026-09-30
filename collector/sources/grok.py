"""Collect trending tech posts from X via the xAI Responses API x_search tool."""

import json
import os
import re
from datetime import date, timedelta

import httpx

from collector import config

XAI_URL = "https://api.x.ai/v1/responses"

PROMPT = """Search X for the most notable tech news and discussions from the last 24 hours about:
{topic}

Pick up to 10 items that a professional software engineer would care about
(releases, announcements, notable incidents, widely discussed posts). Skip memes, ads and engagement bait.

Respond with ONLY a JSON array, no prose, no code fences. Each element:
{{"title": "...", "url": "link to the article/repo/announcement if the post links one, else the post URL",
  "post_url": "https://x.com/.../status/...", "author": "@handle", "summary": "1-2 sentences"}}"""


def _extract_text(resp: dict) -> str:
    if resp.get("output_text"):
        return resp["output_text"]
    parts = []
    for item in resp.get("output", []):
        if item.get("type") != "message":
            continue
        for c in item.get("content", []):
            if c.get("type") == "output_text":
                parts.append(c.get("text", ""))
    return "\n".join(parts)


def _parse_items(text: str) -> list[dict]:
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if not match:
        return []
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return []
    return [d for d in data if isinstance(d, dict) and d.get("url")]


def fetch() -> list[dict]:
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        print("[grok] XAI_API_KEY not set, skipping")
        return []

    tool = {
        "type": "x_search",
        "from_date": (date.today() - timedelta(days=1)).isoformat(),
    }
    if config.GROK_ALLOWED_HANDLES:
        tool["allowed_x_handles"] = config.GROK_ALLOWED_HANDLES[:10]

    items: list[dict] = []
    with httpx.Client(timeout=300, headers={"Authorization": f"Bearer {api_key}"}) as client:
        for category, topic in config.GROK_QUERIES.items():
            body = {
                "model": config.GROK_MODEL,
                "input": [{"role": "user", "content": PROMPT.format(topic=topic)}],
                "tools": [tool],
            }
            try:
                r = client.post(XAI_URL, json=body)
                r.raise_for_status()
            except httpx.HTTPError as e:
                print(f"[grok] {category} failed: {e}")
                continue
            found = _parse_items(_extract_text(r.json()))
            print(f"[grok] {category}: {len(found)} items")
            for it in found:
                items.append({
                    "source": "x",
                    "hint_category": category,
                    "title": it.get("title", ""),
                    "url": it["url"],
                    "post_url": it.get("post_url"),
                    "author": it.get("author"),
                    "snippet": it.get("summary", ""),
                })
    return items
