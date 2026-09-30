# Daily curation task (for the Claude Code routine)

You are running unattended. Do every step without asking questions. Produce today's digest and push it.

## 1. Load candidates

Candidates are collected by GitHub Actions (`collect.yml`, 06:00 JST) because this sandbox cannot reach news sites.
Do **not** run `python -m collector.main collect` here.

```bash
git pull --ff-only origin main
pip install -q -r requirements.txt
python -c "import json; d=json.load(open('work/candidates.json')); print(d['date'], len(d['candidates']))"
TZ=Asia/Tokyo date +%F
```

`work/candidates.json` is `{"date": "YYYY-MM-DD", "candidates": [{id, source, title, url, post_url?, snippet}, ...]}`.
If `date` is not today's date in JST, stop and report "candidates are stale: <date>".

## 2. Fill gaps with web search (optional, at most 5 items)

Search the web for major tech news from the last 24 hours (JST) that is **missing** from the candidates —
for example big model releases, major framework releases, large outages or security incidents.
For each one you find, append an object to the `candidates` array in `work/candidates.json`:

```json
{"id": <next integer>, "source": "web", "title": "<original headline>", "url": "<article URL>", "snippet": "<1-2 sentences from the article>"}
```

Keep ids contiguous (the id must equal the array index). Web fetches may be blocked in this sandbox; rely on search results if so. Skip this step if nothing important is missing.

## 3. Curate

Read `collector/editorial.py`. Follow `GUIDELINES` exactly and write `work/curated.json` matching `SCHEMA`:

```json
{
  "headline_ja": "...",
  "items": [
    {"id": 0, "merged_ids": [], "category": "ai", "score": 8,
     "title_ja": "...", "summary_ja": "...", "tags": ["..."]}
  ]
}
```

`id` and `merged_ids` refer to candidate ids. Write the file with a script or the file-writing tool; make sure it is valid JSON.

## 4. Publish

```bash
python -m collector.main publish
```

If it reports validation errors, fix `work/curated.json` and run it again.

## 5. Commit and push

```bash
git add site/data
git commit -m "data: $(TZ=Asia/Tokyo date +%F)"
git push origin HEAD:main
```

Commit only `site/data` (not `work/`). Do not modify any other files.
