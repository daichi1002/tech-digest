"""Send today's headline as a Web Push notification to every registered device.

Env (GitHub Actions secrets):
  VAPID_PRIVATE_KEY   raw P-256 private key, base64url (created by scripts/setup_push.py)
  PUSH_SUBSCRIPTIONS  JSON array of PushSubscription objects copied from the app
  SITE_URL            URL opened when the notification is tapped
Exits 0 without sending when either secret is missing, so the workflow works before setup.
"""

import json
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit

from pywebpush import WebPushException, webpush

DATA_DIR = Path(__file__).resolve().parent.parent / "site" / "data"


def main() -> None:
    key = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
    subs_raw = os.environ.get("PUSH_SUBSCRIPTIONS", "").strip()
    if not key or not subs_raw:
        print("[push] VAPID_PRIVATE_KEY or PUSH_SUBSCRIPTIONS not set, skipping")
        return

    subs = json.loads(subs_raw)
    if isinstance(subs, dict):
        subs = [subs]

    latest = json.loads((DATA_DIR / "index.json").read_text())["dates"][0]
    digest = json.loads((DATA_DIR / f"{latest}.json").read_text())
    site_url = os.environ.get("SITE_URL", "./")
    payload = json.dumps({
        "title": f"Tech Digest {latest}（{len(digest['items'])}件）",
        "body": digest.get("headline") or "今日のダイジェストが届きました",
        "url": f"{site_url}?d={latest}",
    }, ensure_ascii=False)

    # VAPID "sub" must be a mailto: or a bare https origin (no path).
    parts = urlsplit(site_url)
    subject = f"{parts.scheme}://{parts.netloc}" if parts.netloc else "https://github.com"

    failed = 0
    for i, sub in enumerate(subs):
        try:
            webpush(sub, payload, vapid_private_key=key, vapid_claims={"sub": subject}, ttl=12 * 3600)
            print(f"[push] sent to device {i}")
        except WebPushException as e:
            failed += 1
            status = e.response.status_code if e.response is not None else "?"
            hint = " (subscription expired; remove it from PUSH_SUBSCRIPTIONS)" if status in (404, 410) else ""
            print(f"[push] device {i} failed: HTTP {status}{hint}")
    if failed == len(subs):
        sys.exit("[push] all deliveries failed")


if __name__ == "__main__":
    main()
