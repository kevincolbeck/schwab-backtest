"""Credit system client (Claude-style usage billing).

Balances live in Supabase (credits_ledger + atomic RPCs from
APPLY_ME_PART3.sql); this module is a thin, fail-open client: when the RPCs
aren't installed yet (or auth is off), credits are DISABLED and the older
per-day limits still protect the endpoints — the system deploys dormant and
switches itself on when the SQL lands.
"""

import logging
import os
import threading
import time
from typing import Optional, Tuple

import httpx

from service import env  # noqa: F401
from service import auth

logger = logging.getLogger(__name__)

SIGNUP_GRANT = 250

# What actions cost (docs/pricing-model.md is the tunable source of truth).
COSTS = {
    "chat": 5,
    "explain": 5,
    "backtest_1d": 10,
    "backtest_intraday": 25,       # 15m / 30m / 60m
    "backtest_intraday_fast": 50,  # 1m / 5m
}

MONTHLY_GRANTS = {"pro": 2500, "max": 10000}
PACKS = {"small": {"credits": 500, "usd": 10}, "large": {"credits": 1500, "usd": 25}}


def backtest_cost(timeframe: str) -> int:
    tf = (timeframe or "1d").strip()
    if tf in ("1m", "5m"):
        return COSTS["backtest_intraday_fast"]
    if tf in ("15m", "30m", "60m"):
        return COSTS["backtest_intraday"]
    return COSTS["backtest_1d"]


_state_lock = threading.Lock()
_disabled_until = 0.0  # backoff when RPCs are missing/unreachable


def _rpc(name: str, payload: dict) -> Optional[int]:
    global _disabled_until
    if not auth.auth_configured():
        return None
    if time.time() < _disabled_until:
        return None
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.post(
                f"{auth.SUPABASE_URL}/rest/v1/rpc/{name}",
                json=payload,
                headers={
                    "apikey": auth.SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {auth.SUPABASE_SERVICE_KEY}",
                },
            )
        if resp.status_code == 404:
            with _state_lock:
                _disabled_until = time.time() + 300
            logger.warning("credits RPC %s missing — credits disabled for 5min", name)
            return None
        if resp.status_code != 200:
            with _state_lock:
                _disabled_until = time.time() + 60
            logger.warning("credits RPC %s failed: %s %s — credits disabled for 60s",
                           name, resp.status_code, resp.text[:120])
            return None
        return int(resp.json())
    except Exception:
        # Any transport failure backs off too — otherwise a flaky (or
        # rate-limited) Supabase leaves spend() failing open on every call.
        with _state_lock:
            _disabled_until = time.time() + 60
        logger.warning("credits RPC %s unreachable — credits disabled for 60s", name, exc_info=True)
        return None


def enabled_for(user: Optional[dict]) -> bool:
    """Credits apply only to signed-in users with the RPCs installed."""
    return bool(user) and auth.auth_configured() and time.time() >= _disabled_until


def balance(user_id: str) -> Optional[int]:
    return _rpc("credit_balance", {"p_user": user_id})


def ensure_signup_grant(user_id: str) -> Optional[int]:
    """Self-heal: users created before the trigger existed still get a grant."""
    bal = balance(user_id)
    if bal is None:
        return None
    if bal == 0:
        granted = _rpc("grant_credits", {
            "p_user": user_id, "p_amount": SIGNUP_GRANT,
            "p_reason": "signup_grant", "p_ref": "signup",
        })
        return granted if granted is not None else bal
    return bal


def spend(user_id: str, amount: int, reason: str, ref: Optional[str] = None) -> Tuple[bool, Optional[int]]:
    """(allowed, new_balance). Fail-open: if credits are unreachable, allow."""
    result = _rpc("spend_credits", {
        "p_user": user_id, "p_amount": amount, "p_reason": reason, "p_ref": ref,
    })
    if result is None:
        return True, None  # credits offline — older per-day limits still apply
    if result < 0:
        return False, balance(user_id)
    return True, result


def refund(user_id: str, amount: int, reason: str, ref: Optional[str] = None) -> None:
    _rpc("grant_credits", {
        "p_user": user_id, "p_amount": amount,
        "p_reason": f"refund_{reason}", "p_ref": ref,
    })
