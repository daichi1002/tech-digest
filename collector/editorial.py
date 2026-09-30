"""Editorial rules and output schema shared by both curation modes (Claude API and Claude Code routine)."""

from collector import config

GUIDELINES = f"""You are the editor of a personal daily tech news digest for a Japanese software engineer
who follows AI/LLM, web frontend, backend, infra/cloud, and mobile/iOS.

You receive candidate items collected from Hacker News, Lobsters, GitHub Trending, Zenn (Japanese dev articles), Reddit, and RSS feeds.
Your job:
- Merge duplicates: when several candidates cover the same story, keep one and list the others in `merged_ids`.
- Drop items that are not about software/tech, are marketing fluff, or lack substance.
- Assign exactly one category ({", ".join(config.CATEGORIES)}) and a 1-10 importance score
  (10 = must-read today for this engineer).
- Write a concise Japanese title and a 2-3 sentence Japanese summary explaining what happened and why it matters.
  Keep product names, library names and technical terms in their original spelling.
- Only use facts present in the candidate data; do not invent version numbers or details.
- Also write `headline_ja`: one Japanese line summarizing today's biggest theme.
Return at most {config.MAX_ITEMS} items, sorted by score descending."""

SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "merged_ids": {"type": "array", "items": {"type": "integer"}},
                    "category": {"type": "string", "enum": list(config.CATEGORIES)},
                    "score": {"type": "integer"},
                    "title_ja": {"type": "string"},
                    "summary_ja": {"type": "string"},
                    "tags": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["id", "merged_ids", "category", "score", "title_ja", "summary_ja", "tags"],
                "additionalProperties": False,
            },
        },
        "headline_ja": {"type": "string"},
    },
    "required": ["items", "headline_ja"],
    "additionalProperties": False,
}

_ITEM_TYPES = {
    "id": int, "merged_ids": list, "category": str, "score": int,
    "title_ja": str, "summary_ja": str, "tags": list,
}


def validate(result: object, n_candidates: int) -> list[str]:
    """Return a list of problems with a curation result; empty means valid."""
    if not isinstance(result, dict):
        return ["top level must be an object"]
    errors = []
    if not isinstance(result.get("headline_ja"), str):
        errors.append("headline_ja must be a string")
    items = result.get("items")
    if not isinstance(items, list):
        return errors + ["items must be an array"]
    for i, it in enumerate(items):
        if not isinstance(it, dict):
            errors.append(f"items[{i}] must be an object")
            continue
        for key, typ in _ITEM_TYPES.items():
            if not isinstance(it.get(key), typ) or (typ is int and isinstance(it.get(key), bool)):
                errors.append(f"items[{i}].{key} must be {typ.__name__}")
        if isinstance(it.get("id"), int) and not 0 <= it["id"] < n_candidates:
            errors.append(f"items[{i}].id {it['id']} out of range 0..{n_candidates - 1}")
        if it.get("category") not in config.CATEGORIES:
            errors.append(f"items[{i}].category {it.get('category')!r} not in {list(config.CATEGORIES)}")
    return errors


def assemble(candidates: list[dict], result: dict) -> dict:
    """Join a validated curation result with candidate metadata into the published digest shape."""
    items = []
    for it in result["items"]:
        src = candidates[it["id"]]
        related = [
            {"source": candidates[m]["source"], "url": candidates[m].get("post_url") or candidates[m]["url"]}
            for m in it["merged_ids"]
            if isinstance(m, int) and 0 <= m < len(candidates) and m != it["id"]
        ]
        items.append({
            "title": it["title_ja"],
            "original_title": src["title"],
            "summary": it["summary_ja"],
            "url": src["url"],
            "source": src["source"],
            "post_url": src.get("post_url"),
            "author": src.get("author"),
            "category": it["category"],
            "score": max(1, min(10, it["score"])),
            "tags": it["tags"],
            "related": related,
        })
    items.sort(key=lambda x: -x["score"])
    return {"headline": result["headline_ja"], "items": items[: config.MAX_ITEMS]}
