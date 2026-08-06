"""Supabase-backed identity + plan limits for the API.

Tokens are verified by asking Supabase auth itself (GET /auth/v1/user), so no
JWT secret ships with this service. Plans come from the profiles table via the
service-role key. When SUPABASE_URL isn't configured (local dev without auth),
every caller is anonymous and dev-open defaults apply.
"""

import hashlib
import logging
import os
import time
from typing import Optional

import httpx

from service import env  # noqa: F401  (loads .env)

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

# Plan capabilities (§5 flat tiers). None = unlimited. Every per-day number is
# a QUIET fair-use cap, not an advertised quota — the product sells
# capabilities, and these caps exist to stop scripts, not people. Chat caps
# are the real COGS boundary (model tokens): they're sized so even a
# worst-case adversarial month stays at/above break-even at the §5 prices
# (math in docs/pricing-model.md §5) while typical usage never notices.
PLAN_LIMITS = {
    "anon": {"runs_per_day": int(os.getenv("ANON_RUNS_PER_DAY", "10")), "max_symbols": 10,
             "deployments": 0, "private": False, "all_us": False,
             "intraday": False, "crypto": False, "chat_per_day": None,
             "explain_per_day": None},  # anon uses EXPLAIN_PER_DAY_ANON
    "free": {"runs_per_day": int(os.getenv("FREE_RUNS_PER_DAY", "50")), "max_symbols": 10,
             "deployments": 1, "private": False, "all_us": False,
             "intraday": False, "crypto": False,
             "chat_per_day": int(os.getenv("FREE_CHAT_PER_DAY", "5")),
             "explain_per_day": int(os.getenv("FREE_EXPLAIN_PER_DAY", "5"))},
    "pro": {"runs_per_day": None, "max_symbols": 100, "deployments": 10, "private": True,
            "all_us": False, "intraday": True, "crypto": False,
            "chat_per_day": int(os.getenv("PRO_CHAT_PER_DAY", "15")),
            "explain_per_day": int(os.getenv("PRO_EXPLAIN_PER_DAY", "10"))},
    "max": {"runs_per_day": None, "max_symbols": 200, "deployments": None, "private": True,
            "all_us": True, "intraday": True, "crypto": True,
            "chat_per_day": int(os.getenv("MAX_CHAT_PER_DAY", "40")),
            "explain_per_day": int(os.getenv("MAX_EXPLAIN_PER_DAY", "20"))},
}

_token_cache: dict = {}  # token_hash -> (expires_at, user_dict)
_TOKEN_TTL = 60.0


def auth_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_ANON_KEY and SUPABASE_SERVICE_KEY)


def get_user(authorization: Optional[str]) -> Optional[dict]:
    """Resolve a Bearer token to {id, email, plan}. None = anonymous."""
    if not auth_configured() or not authorization:
        return None
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        return None

    key = hashlib.sha256(token.encode()).hexdigest()
    cached = _token_cache.get(key)
    if cached and cached[0] > time.time():
        return cached[1]

    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"},
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            user = {"id": data["id"], "email": data.get("email", ""), "plan": "free"}
            service_headers = {
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            }
            prof = client.get(
                f"{SUPABASE_URL}/rest/v1/profiles",
                params={"id": f"eq.{user['id']}", "select": "plan"},
                headers=service_headers,
            )
            rows = prof.json() if prof.status_code == 200 else []
            if rows and rows[0].get("plan") in PLAN_LIMITS:
                user["plan"] = rows[0]["plan"]
            elif prof.status_code == 200 and not rows:
                # Self-heal: create the profile row if the signup trigger
                # didn't (or predates the migration). Plan defaults to free.
                client.post(
                    f"{SUPABASE_URL}/rest/v1/profiles",
                    json={"id": user["id"]},
                    headers={**service_headers, "Prefer": "resolution=ignore-duplicates"},
                )
    except Exception:
        logger.warning("supabase auth lookup failed", exc_info=True)
        return None

    _token_cache[key] = (time.time() + _TOKEN_TTL, user)
    if len(_token_cache) > 5000:
        _token_cache.clear()
    return user


def limits_for(user: Optional[dict]) -> dict:
    """Capability set for a user, including any earned referral slots.

    Referral bonuses are additive on top of the plan and NEVER change any
    other capability — a referred free user gets a second deployment slot, not
    intraday, not crypto, not a bigger symbol cap. §5's flat tiers stay the
    thing you buy; the referral just widens one number.
    """
def _plan_limits_for(user: Optional[dict]) -> dict:
    if user is None:
        # Dev-open: with auth unconfigured there are no accounts, so there are
        # no plans to gate by — everything the rest of the code treats as
        # "dev-open" (rate limits, the /backtest 401) behaves the same way.
        # In production auth IS configured, so this branch never widens
        # anything; anonymous visitors get the anon capability set.
        if not auth_configured():
            return PLAN_LIMITS["max"]
        return PLAN_LIMITS["anon"]
    return PLAN_LIMITS.get(user.get("plan", "free"), PLAN_LIMITS["free"])


def limits_for(user: Optional[dict]) -> dict:
    limits = _plan_limits_for(user)
    if user is None:
        return limits
    # Import here: referrals imports auth, and a module-level import would be
    # circular.
    from service import referrals

    bonus = referrals.bonus_deployments(user.get("id"))
    if not bonus:
        return limits
    slots = limits["deployments"]
    if slots is None:
        return limits  # max plan is already unlimited — nothing to add to
    # Copy: PLAN_LIMITS entries are module-level dicts shared by every request.
    return {**limits, "deployments": slots + bonus}


# ── Simple per-day run counter (single-instance v1; move to Postgres later) ──

_run_counts: dict = {}


def check_and_count_run(identity: str, limit: Optional[int]) -> bool:
    """True if this run is allowed; counts it. identity = user id or client IP."""
    if limit is None:
        return True
    day = time.strftime("%Y-%m-%d")
    key = (identity, day)
    count = _run_counts.get(key, 0)
    if count >= limit:
        return False
    _run_counts[key] = count + 1
    if len(_run_counts) > 50000:
        stale = [k for k in _run_counts if k[1] != day]
        for k in stale:
            _run_counts.pop(k, None)
    return True
