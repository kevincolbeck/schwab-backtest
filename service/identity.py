"""Public display identity for strategy owners (Phase G).

Resolves a Supabase user id to the ONLY things a public surface may show
about a person: {display_name, avatar_url}. Names come from OAuth metadata
(full_name / name / user_name / preferred_username) with the email local-part
(domain stripped) as the last resort, so a raw email address never reaches
the leaderboard or a strategy page. Lookups hit the Supabase admin users
endpoint with the service key (same env vars auth.py uses) behind an
in-memory ~15-minute TTL cache; every failure degrades to None, never an
error. The 'house' owner maps to a fixed identity without any lookup.
"""

import logging
import threading
import time
from typing import Dict, List, Optional

import httpx

from service import env  # noqa: F401  (loads .env)
from service import auth

logger = logging.getLogger(__name__)

CACHE_TTL = 15 * 60.0
FAILURE_TTL = 60.0  # brief negative cache so a down Supabase isn't hammered
HOUSE_IDENTITY = {"display_name": "House", "avatar_url": None}

_NAME_KEYS = ("full_name", "name", "user_name", "preferred_username")
_AVATAR_KEYS = ("avatar_url", "picture")

_cache: dict = {}  # user_id -> (expires_at, identity dict | None)
_cache_lock = threading.Lock()


def identity_from_user(data: dict) -> dict:
    """Derive the public identity from a Supabase admin user object."""
    meta = data.get("user_metadata") if isinstance(data.get("user_metadata"), dict) else {}
    display = None
    for key in _NAME_KEYS:
        value = meta.get(key)
        if isinstance(value, str) and value.strip():
            display = value.strip()
            break
    if display is None:
        email = data.get("email") or ""
        display = email.split("@", 1)[0].strip() or "Member"
    avatar = None
    for key in _AVATAR_KEYS:
        value = meta.get(key)
        if isinstance(value, str) and value.strip():
            avatar = value.strip()
            break
    return {"display_name": display[:80], "avatar_url": avatar}


def resolve(user_id: Optional[str]) -> Optional[dict]:
    """Public identity for one owner id. None = unknown (render anonymously)."""
    if not user_id:
        return None
    return resolve_many([user_id]).get(user_id)


def resolve_many(user_ids: List[str]) -> Dict[str, Optional[dict]]:
    """Batch resolve through the cache — one HTTP call per cache MISS only,
    so a warm cache serves a whole leaderboard without touching Supabase."""
    out: Dict[str, Optional[dict]] = {}
    misses: List[str] = []
    now = time.time()
    with _cache_lock:
        for user_id in user_ids:
            if user_id in out:
                continue
            if not user_id:
                out[user_id] = None
                continue
            if user_id == "house":
                out[user_id] = dict(HOUSE_IDENTITY)
                continue
            cached = _cache.get(user_id)
            if cached and cached[0] > now:
                out[user_id] = cached[1]
            else:
                misses.append(user_id)
    if not misses:
        return out

    pending = list(dict.fromkeys(misses))
    if not auth.auth_configured():
        for user_id in pending:
            out[user_id] = None
        return out
    try:
        with httpx.Client(timeout=10) as client:
            for user_id in pending:
                out[user_id] = _fetch(client, user_id)
    except Exception:
        logger.warning("identity client unavailable", exc_info=True)
        now = time.time()
        with _cache_lock:
            for user_id in pending:
                out.setdefault(user_id, None)
                _cache.setdefault(user_id, (now + FAILURE_TTL, None))
    return out


def _fetch(client: httpx.Client, user_id: str) -> Optional[dict]:
    """One admin-endpoint lookup; caches the result (failures cache briefly)."""
    ident = None
    try:
        resp = client.get(
            f"{auth.SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            headers={
                "apikey": auth.SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {auth.SUPABASE_SERVICE_KEY}",
            },
        )
        if resp.status_code == 200:
            data = resp.json()
            user_obj = data.get("user") if isinstance(data.get("user"), dict) else data
            ident = identity_from_user(user_obj)
        else:
            logger.warning("identity lookup for %s failed: %s", user_id, resp.status_code)
    except Exception:
        logger.warning("identity lookup for %s unreachable", user_id, exc_info=True)
    with _cache_lock:
        _cache[user_id] = (time.time() + (CACHE_TTL if ident else FAILURE_TTL), ident)
        if len(_cache) > 5000:
            _cache.clear()
    return ident
