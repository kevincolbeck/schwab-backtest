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

TEST vs LIVE: Stripe keeps entirely separate objects per mode, so price IDs
created in test DO NOT exist in live. Run this once per mode.

    # test mode (default) — reads STRIPE_SECRET_KEY, writes IDs into .env
    python scripts/setup_stripe_v2.py

    # live mode — reads STRIPE_SECRET_KEY_LIVE, PRINTS IDs and writes nothing
    python scripts/setup_stripe_v2.py --live

Live IDs are deliberately never written to local env files: local dev and the
test suite must never point at real money. Paste the printed values into
Vercel (Production) instead.
"""

import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
LIVE = "--live" in sys.argv


def load_env(path: Path) -> dict:
    env = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env


ENV = load_env(REPO / ".env")
if LIVE:
    KEY = ENV.get("STRIPE_SECRET_KEY_LIVE")
    if not KEY:
        sys.exit(
            "STRIPE_SECRET_KEY_LIVE missing from .env.\n"
            "Add your live secret key there (it stays gitignored), then re-run "
            "with --live. Keep STRIPE_SECRET_KEY as the TEST key so local dev "
            "and pytest never touch real money."
        )
    if not KEY.startswith("sk_live_"):
        sys.exit("--live requires a key starting with sk_live_")
    print("MODE: LIVE — creating real, chargeable prices.\n")
else:
    KEY = ENV.get("STRIPE_SECRET_KEY")
    if not KEY:
        sys.exit("STRIPE_SECRET_KEY missing from .env")
    if not KEY.startswith("sk_test_"):
        sys.exit(
            "STRIPE_SECRET_KEY is not a test key. Live prices must be created "
            "explicitly: put the live key in STRIPE_SECRET_KEY_LIVE and run "
            "with --live."
        )
    print("MODE: TEST\n")


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
    # Top-up packs (overflow rail, footer-level on /pricing). One-time, so no
    # `interval` — they also need recreating per mode.
    {"env": "STRIPE_PRICE_PACK_SMALL", "lookup": "ctb_pack_small",
     "product": "Credit Pack — 500", "amount": 1000, "interval": None},
    {"env": "STRIPE_PRICE_PACK_LARGE", "lookup": "ctb_pack_large",
     "product": "Credit Pack — 1500", "amount": 2500, "interval": None},
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
    params = {
        "product": products[p["product"]],
        "unit_amount": p["amount"],
        "currency": "usd",
        "lookup_key": p["lookup"],
    }
    if p["interval"]:
        params["recurring[interval]"] = p["interval"]
    price = stripe("POST", "prices", params)
    resolved[p["env"]] = price["id"]
    cadence = f"/{p['interval']}" if p["interval"] else " one-time"
    print(f"created {p['lookup']}: {price['id']}  (${p['amount'] / 100:.0f}{cadence})")

if LIVE:
    # Never write live IDs locally — local dev and pytest must stay on test.
    print("\n(local env files deliberately NOT modified in live mode)")
else:
    for env_path in (REPO / ".env", REPO / "web" / ".env.local"):
        env = load_env(env_path)
        lines = [f"{k}={v}" for k, v in resolved.items() if k not in env]
        if lines:
            with env_path.open("a", encoding="utf-8") as fp:
                fp.write("\n" + "\n".join(lines) + "\n")
            print(f"appended {len(lines)} price ids to {env_path}")

banner = "LIVE" if LIVE else "TEST"
print(f"\n=== {banner} price IDs — set these in Vercel (Production) ===")
for k, v in resolved.items():
    print(f"{k}={v}")
if LIVE:
    print(
        "\nAlso set in Vercel Production:\n"
        "  STRIPE_SECRET_KEY=sk_live_...        (the live secret key)\n"
        "  STRIPE_WEBHOOK_SECRET=whsec_...      (from the LIVE webhook endpoint)\n"
        "Then redeploy. Checkout verifies every price's amount against\n"
        "web/src/lib/pricing.ts, so a test/live mix-up fails closed (503),\n"
        "never a wrong charge."
    )
