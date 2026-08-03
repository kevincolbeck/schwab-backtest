"""Credit system client (Claude-style usage billing).

Balances live in Supabase (credits_ledger + atomic RPCs from
APPLY_ME_PART3.sql); this module is a thin, fail-open client: when the RPCs
aren't installed yet (or auth is off), credits are DISABLED and the older
per-day limits still protect the endpoints — the system deploys dormant and
switches itself on when the SQL lands.
"""

import logging
import math
import os
import threading
import time
from typing import Optional, Tuple

import httpx

from service import env  # noqa: F401
from service import auth

logger = logging.getLogger(__name__)

SIGNUP_GRANT = 250

# ── Pricing constants (docs/pricing-model.md is the tunable source of truth) ──
# Margin rule (owner directive): every credit-priced action must carry a large
# gross margin over its worst-case marginal cost. Chat scales with tokens,
# backtests scale with universe size, intraday deployments pay a one-time fee.

# Chat: tokens are estimated deterministically BEFORE the model call
# (request chars / CHAT_CHARS_PER_TOKEN + a fixed output allowance) and priced
# at CHAT_TOKENS_PER_CREDIT tokens per credit with a CHAT_COST_MIN floor.
# CHAT_CHARS_PER_TOKEN=2.5 is deliberately below English's ~4: dense-token text
# (CJK, minified code) can hit ~2 chars/token, and the margin floor must hold
# for adversarial inputs too, not just typical prose.
CHAT_COST_MIN = 12
CHAT_TOKENS_PER_CREDIT = 800
CHAT_CHARS_PER_TOKEN = 2.5
CHAT_OUTPUT_TOKEN_ALLOWANCE = 1500

# Backtests: one base cost (by timeframe) per SYMBOL_BLOCK resolved symbols,
# capped at SYMBOL_MULTIPLIER_CAP blocks — so an ALL_US 1d run prices at the
# cap (10 × 20 = 200 credits) no matter how large the universe grows.
SYMBOL_BLOCK = 10
SYMBOL_MULTIPLIER_CAP = 20

# Intraday forward deployments: one-time fee at deploy time, pro/max plans
# only. 1m/5m carry a premium — their data volume compounds fastest in the
# daily worker (every pass replays the growing window).
INTRADAY_DEPLOY_CREDITS = 100
INTRADAY_DEPLOY_CREDITS_FAST = 250  # 1m / 5m
INTRADAY_DEPLOY_TIMEFRAMES = ("15m", "30m", "60m", "1m", "5m")

COSTS = {
    "chat": CHAT_COST_MIN,         # minimum; actual price is chat_cost(tokens)
    "explain": 5,
    "backtest_1d": 10,             # per symbol block (see symbol_multiplier)
    "backtest_intraday": 25,       # 15m / 30m / 60m
    "backtest_intraday_fast": 50,  # 1m / 5m
    "deploy_intraday": INTRADAY_DEPLOY_CREDITS,
    "deploy_intraday_fast": INTRADAY_DEPLOY_CREDITS_FAST,
}


def intraday_deploy_cost(timeframe: str) -> int:
    """One-time deploy fee by timeframe tier (1m/5m are the premium class)."""
    return (
        INTRADAY_DEPLOY_CREDITS_FAST
        if (timeframe or "").strip() in ("1m", "5m")
        else INTRADAY_DEPLOY_CREDITS
    )

MONTHLY_GRANTS = {"pro": 2500, "max": 10000}
PACKS = {"small": {"credits": 500, "usd": 10}, "large": {"credits": 1500, "usd": 25}}


def chat_cost(estimated_tokens: int) -> int:
    """Token-scaled chat price: max(floor, ceil(tokens / tokens-per-credit))."""
    tokens = max(0, int(estimated_tokens))
    return max(CHAT_COST_MIN, math.ceil(tokens / CHAT_TOKENS_PER_CREDIT))


def estimate_chat_tokens(request_chars: int) -> int:
    """Deterministic pre-call token estimate: chars/4 + output allowance."""
    chars = max(0, int(request_chars))
    return math.ceil(chars / CHAT_CHARS_PER_TOKEN) + CHAT_OUTPUT_TOKEN_ALLOWANCE


def symbol_multiplier(n_symbols: int) -> int:
    """×1 per SYMBOL_BLOCK symbols, capped (10 symbols ×1, 11 ×2, ALL_US ×20)."""
    blocks = math.ceil(max(1, int(n_symbols)) / SYMBOL_BLOCK)
    return min(SYMBOL_MULTIPLIER_CAP, max(1, blocks))


def backtest_cost(timeframe: str, n_symbols: int = 1) -> int:
    """Run price = timeframe base cost × symbol multiplier (resolved count)."""
    tf = (timeframe or "1d").strip()
    if tf in ("1m", "5m"):
        base = COSTS["backtest_intraday_fast"]
    elif tf in ("15m", "30m", "60m"):
        base = COSTS["backtest_intraday"]
    else:
        base = COSTS["backtest_1d"]
    return base * symbol_multiplier(n_symbols)


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
