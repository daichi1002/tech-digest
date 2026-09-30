"""Topics, sources, and model settings. Edit this file to tune what gets collected."""

CATEGORIES = {
    "ai": "AI / LLM",
    "web": "Web / Frontend",
    "backend": "Backend",
    "infra": "Infra / Cloud",
    "mobile": "Mobile / iOS",
}

RSS_FEEDS = [
    # Official blogs
    "https://github.blog/feed/",
    "https://blog.cloudflare.com/rss/",
    "https://aws.amazon.com/blogs/aws/feed/",
    "https://developer.apple.com/news/rss/news.rss",
    "https://openai.com/news/rss.xml",
    # Japanese communities
    "https://qiita.com/popular-items/feed",
    # Reddit (top of the day)
    "https://www.reddit.com/r/programming/top/.rss?t=day",
    "https://www.reddit.com/r/LocalLLaMA/top/.rss?t=day",
    "https://www.reddit.com/r/webdev/top/.rss?t=day",
    "https://www.reddit.com/r/devops/top/.rss?t=day",
    "https://www.reddit.com/r/iOSProgramming/top/.rss?t=day",
]

HN_MIN_POINTS = 100

# Zenn daily trend API
ZENN_COUNT = 30
ZENN_MIN_LIKES = 20

# Skip URLs already published in the last N days of digests.
DEDUPE_DAYS = 7

# Max items kept per daily digest after curation.
MAX_ITEMS = 40

# --- Grok (X search). Disabled: paid API. Set True and XAI_API_KEY to re-enable. ---
GROK_ENABLED = False
GROK_MODEL = "grok-4.7"
GROK_QUERIES = {
    "ai": "LLM, AI model releases, AI agents, ML research papers, AI developer tools",
    "web": "React, Next.js, TypeScript, CSS, browsers, web platform, frontend tooling",
    "backend": "backend engineering, databases, Go, Rust, Python, Node.js, APIs, distributed systems",
    "infra": "AWS, GCP, Azure, Kubernetes, DevOps, SRE, observability, security incidents",
    "mobile": "Swift, SwiftUI, iOS, Xcode, Android, Kotlin, React Native, Flutter",
}
# Optional: restrict Grok to these X handles (max 10). Empty = search all of X.
GROK_ALLOWED_HANDLES: list[str] = []

# --- Claude API mode only (`python -m collector.main run-api`). Routine mode uses Claude Code. ---
CLAUDE_MODEL = "claude-opus-5-5"
