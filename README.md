# Tech Digest

無料の情報源と Claude（サブスク枠の Claude Code）で毎朝テックニュースを集める個人用サイト。

## 仕組み

1. **収集**（`collector/sources/`）— `python -m collector.main collect` → `work/candidates.json`
   - `hn.py` — Hacker News（Algolia API、100 点以上）
   - `lobsters.py` — Lobsters の hottest
   - `github_trending.py` — GitHub Trending（日次）
   - `zenn.py` — Zenn の日次トレンド（いいね 20 以上）
   - `rss.py` — 公式ブログ、Qiita、Reddit（RSS）
   - 過去 7 日のダイジェストに載った URL は除外
2. **選別** — Claude Code の routine が [CURATE.md](CURATE.md) の手順に従い、Web 検索で漏れを補ってから
   重複統合・カテゴリ分類・重要度 1〜10 採点・日本語要約を行い `work/curated.json` を書く
   （ルールとスキーマは `collector/editorial.py`）
3. **公開** — `python -m collector.main publish` が検証して `site/data/YYYY-MM-DD.json` を出力 → routine が commit & push
4. **表示** — push を受けて GitHub Actions（`deploy.yml`）が `site/` を GitHub Pages にデプロイ

費用: Claude Code のサブスク枠内で動くため API 課金なし。公開リポジトリなら GitHub Pages も無料。

## セットアップ

1. GitHub に**公開**リポジトリを作って push（非公開リポジトリで Pages を使うには GitHub Pro 以上が必要）
2. Settings → Pages → Source を **GitHub Actions** に設定
3. Claude Code で毎朝の routine を作成し、プロンプトを「`CURATE.md` の手順を実行して」にする

## ローカル実行

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m collector.main collect     # 収集
# Claude Code に「CURATE.md の手順 2〜4 を実行して」と頼む
python -m http.server -d site 8000   # http://localhost:8000
```

## 有料オプション（現在は無効）

- **Claude API 版**: `ANTHROPIC_API_KEY` を設定して `python -m collector.main run-api`（収集 → API で選別 → 公開を一括実行）
- **Grok（X 検索）**: `collector/config.py` で `GROK_ENABLED = True` にして `XAI_API_KEY` を設定

## カスタマイズ

`collector/config.py` を編集: `RSS_FEEDS` / `HN_MIN_POINTS` / `MAX_ITEMS` / `CATEGORIES`
