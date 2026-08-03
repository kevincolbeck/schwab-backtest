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

# Plan limits (master plan Phase 4). None = unlimited.
PLAN_LIMITS = {
    "anon": {"runs_per_day": int(os.getenv("ANON_RUNS_PER_DAY", "10")), "max_symbols": 10,
             "deployments": 0, "private": False, "all_us": False},
    "free": {"runs_per_day": 10, "max_symbols": 10, "deployments": 1, "private": False, "all_us": False},
    "pro": {"runs_per_day": None, "max_symbols": 100, "deployments": 5, "private": True, "all_us": False},
    "max": {"runs_per_day": None, "max_symbols": 200, "deployments": 25, "private": True, "all_us": True},
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
    if user is None:
        return PLAN_LIMITS["anon"]
    return PLAN_LIMITS.get(user.get("plan", "free"), PLAN_LIMITS["free"])


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
