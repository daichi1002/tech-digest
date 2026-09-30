"""One-time setup for daily push notifications.

Generates a VAPID key pair, stores the private key as the GitHub Actions secret
VAPID_PRIVATE_KEY (via the gh CLI; never printed), and writes the public key to
site/push-config.json so the app can subscribe.

Usage: python scripts/setup_push.py   (requires `gh auth login` and the cryptography package)
"""

import base64
import json
import subprocess
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

CONFIG = Path(__file__).resolve().parent.parent / "site" / "push-config.json"


def b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def main() -> None:
    if CONFIG.exists():
        raise SystemExit(f"{CONFIG} already exists. Delete it first to rotate keys (existing subscriptions will stop working).")

    key = ec.generate_private_key(ec.SECP256R1())
    private_raw = key.private_numbers().private_value.to_bytes(32, "big")
    public_raw = key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)

    subprocess.run(["gh", "secret", "set", "VAPID_PRIVATE_KEY"], input=b64url(private_raw).encode(), check=True)
    CONFIG.write_text(json.dumps({"vapidPublicKey": b64url(public_raw)}, indent=2) + "\n")
    print(f"Saved VAPID_PRIVATE_KEY secret and wrote {CONFIG.name}. Commit and push site/push-config.json.")


if __name__ == "__main__":
    main()
