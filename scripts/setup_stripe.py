"""Create the Pro/Max Stripe products + prices (idempotent) and print price IDs.

Usage (repo root): python scripts/setup_stripe.py
Reads STRIPE_SECRET_KEY from .env; appends STRIPE_PRICE_PRO / STRIPE_PRICE_MAX
to .env and web/.env.local if they aren't set yet.
"""

import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent


def load_env(path: Path) -> dict:
    env = {}
    if path.exists():
        for line in path.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env


ENV = load_env(REPO / ".env")
KEY = ENV.get("STRIPE_SECRET_KEY")
if not KEY:
    sys.exit("STRIPE_SECRET_KEY missing from .env")


def stripe(method: str, path: str, data: dict | None = None) -> dict:
    body = urllib.parse.urlencode(data).encode() if data else None
    req = urllib.request.Request(
        f"https://api.stripe.com/v1/{path}",
        data=body,
        method=method,
        headers={"Authorization": f"Bearer {KEY}"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


PLANS = [
    {"lookup": "ctb_pro", "name": "Chat-to-Backtest Pro", "amount": 2900, "recurring": True},
    {"lookup": "ctb_max", "name": "Chat-to-Backtest Max", "amount": 7900, "recurring": True},
    {"lookup": "ctb_pack_small", "name": "Credit Pack — 500", "amount": 1000, "recurring": False},
    {"lookup": "ctb_pack_large", "name": "Credit Pack — 1500", "amount": 2500, "recurring": False},
]

price_ids = {}
lookup_qs = "&".join(f"lookup_keys[]={p['lookup']}" for p in PLANS)
existing = stripe("GET", f"prices?{lookup_qs}&limit=10")
by_lookup = {p["lookup_key"]: p["id"] for p in existing.get("data", [])}

for plan in PLANS:
    if plan["lookup"] in by_lookup:
        price_ids[plan["lookup"]] = by_lookup[plan["lookup"]]
        print(f"exists  {plan['name']}: {by_lookup[plan['lookup']]}")
        continue
    product = stripe("POST", "products", {"name": plan["name"]})
    price_params = {
        "product": product["id"],
        "unit_amount": plan["amount"],
        "currency": "usd",
        "lookup_key": plan["lookup"],
    }
    if plan["recurring"]:
        price_params["recurring[interval]"] = "month"
    price = stripe("POST", "prices", price_params)
    price_ids[plan["lookup"]] = price["id"]
    print(f"created {plan['name']}: {price['id']}")

# Append to env files if missing
for env_path in (REPO / ".env", REPO / "web" / ".env.local"):
    env = load_env(env_path)
    lines = []
    if "STRIPE_PRICE_PRO" not in env:
        lines.append(f"STRIPE_PRICE_PRO={price_ids['ctb_pro']}")
    if "STRIPE_PRICE_MAX" not in env:
        lines.append(f"STRIPE_PRICE_MAX={price_ids['ctb_max']}")
    if "STRIPE_PRICE_PACK_SMALL" not in env:
        lines.append(f"STRIPE_PRICE_PACK_SMALL={price_ids['ctb_pack_small']}")
    if "STRIPE_PRICE_PACK_LARGE" not in env:
        lines.append(f"STRIPE_PRICE_PACK_LARGE={price_ids['ctb_pack_large']}")
    if lines:
        with env_path.open("a", encoding="utf-8") as fp:
            fp.write("\n" + "\n".join(lines) + "\n")
        print(f"appended {len(lines)} price ids to {env_path.name}")

print("\nstripe setup complete")
