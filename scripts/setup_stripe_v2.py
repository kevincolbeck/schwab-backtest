"""Create the §5 flat-tier Stripe prices (idempotent) and print their IDs.

§5 retires the credits-era $29/$79 monthly-only pricing for flat capability
tiers with an annual option:

    Pro  $39/mo   or  $390/yr  (2 months free)
    Max  $99/mo   or  $990/yr  (2 months free)

Top-up packs are unchanged and stay (footer-level) as the overflow rail.

Idempotent by `lookup_key`: re-running finds existing prices instead of
creating duplicates. Stripe prices are IMMUTABLE — changing an amount means a
new price object, which is why the old ctb_pro/ctb_max ($29/$79) are left
alone rather than edited. Existing subscribers keep billing on the old price
until they're migrated deliberately (see docs/pricing-model.md §5).

Usage (repo root): python scripts/setup_stripe_v2.py
Reads STRIPE_SECRET_KEY from .env; appends any missing STRIPE_PRICE_* to .env
and web/.env.local.
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
        for line in path.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env


ENV = load_env(REPO / ".env")
KEY = ENV.get("STRIPE_SECRET_KEY")
if not KEY:
    sys.exit("STRIPE_SECRET_KEY missing from .env")
if not KEY.startswith("sk_test_"):
    # Live-mode price creation should be a deliberate, separate act.
    print(f"WARNING: key prefix {KEY[:8]}… is not sk_test_ — creating LIVE prices.")


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


# env var name -> price definition. Annual = 10× monthly (2 months free).
PRICES = [
    {"env": "STRIPE_PRICE_PRO_V2", "lookup": "cb_pro_monthly_v2",
     "product": "Chat-to-Backtest Pro", "amount": 3900, "interval": "month"},
    {"env": "STRIPE_PRICE_PRO_ANNUAL", "lookup": "cb_pro_annual_v2",
     "product": "Chat-to-Backtest Pro", "amount": 39000, "interval": "year"},
    {"env": "STRIPE_PRICE_MAX_V2", "lookup": "cb_max_monthly_v2",
     "product": "Chat-to-Backtest Max", "amount": 9900, "interval": "month"},
    {"env": "STRIPE_PRICE_MAX_ANNUAL", "lookup": "cb_max_annual_v2",
     "product": "Chat-to-Backtest Max", "amount": 99000, "interval": "year"},
]

lookup_qs = "&".join(f"lookup_keys[]={p['lookup']}" for p in PRICES)
existing = stripe("GET", f"prices?{lookup_qs}&limit=20")
by_lookup = {p["lookup_key"]: p["id"] for p in existing.get("data", [])}

# One product per tier, reused across its monthly/annual prices.
products: dict = {}
for p in PRICES:
    if p["lookup"] in by_lookup:
        continue
    name = p["product"]
    if name not in products:
        found = stripe("GET", f"products/search?query={urllib.parse.quote(f'name:\"{name}\"')}")
        data = found.get("data") or []
        products[name] = data[0]["id"] if data else stripe("POST", "products", {"name": name})["id"]

resolved = {}
for p in PRICES:
    if p["lookup"] in by_lookup:
        resolved[p["env"]] = by_lookup[p["lookup"]]
        print(f"exists  {p['lookup']}: {by_lookup[p['lookup']]}")
        continue
    price = stripe("POST", "prices", {
        "product": products[p["product"]],
        "unit_amount": p["amount"],
        "currency": "usd",
        "lookup_key": p["lookup"],
        "recurring[interval]": p["interval"],
    })
    resolved[p["env"]] = price["id"]
    print(f"created {p['lookup']}: {price['id']}  (${p['amount'] / 100:.0f}/{p['interval']})")

for env_path in (REPO / ".env", REPO / "web" / ".env.local"):
    env = load_env(env_path)
    lines = [f"{k}={v}" for k, v in resolved.items() if k not in env]
    if lines:
        with env_path.open("a", encoding="utf-8") as fp:
            fp.write("\n" + "\n".join(lines) + "\n")
        print(f"appended {len(lines)} price ids to {env_path}")

print("\n=== Set these in Vercel (Production) ===")
for k, v in resolved.items():
    print(f"{k}={v}")
