"""§8 referral mechanic — "give a friend 1 extra deployment slot, get 1".

Denominated in deployment slots because the spec wants the reward to reinforce
the core behaviour (putting a frozen strategy on a public record) rather than
handing out a generic currency.

DESIGN NOTES WORTH KEEPING:

*Codes are derived, not stored.* A referral code is a short HMAC of the user
id under a server secret. There is no code table to keep in sync, nothing to
leak, and codes cannot be guessed or enumerated without the secret. Redemption
is the only state that exists.

*The cap is the real defence.* Self-referral is blocked by a CHECK and
redeeming twice by a primary key, but neither stops the actual attack: making
throwaway accounts to farm slots. There is no email-confirmation gate on the
deploy path, so the honest defence is a low ceiling on how much a single
referrer can earn. REFERRAL_MAX_BONUS is that ceiling.

*Failures never widen limits.* Every lookup here degrades to zero bonus on
error. A Supabase blip must not accidentally hand out slots, and it must not
block a deploy either — zero bonus is the safe direction in both cases.
"""

import hashlib
import hmac
import logging
import os
from typing import Optional

import httpx

from service import env  # noqa: F401  (loads .env)
from service.auth import SUPABASE_SERVICE_KEY, SUPABASE_URL, auth_configured

logger = logging.getLogger(__name__)

# The most bonus slots one referrer can accumulate. Deliberately low: this
# grants free capacity that costs real money to serve, and a referral program
# on a product with a handful of users is a growth experiment, not a channel.
REFERRAL_MAX_BONUS = int(os.getenv("REFERRAL_MAX_BONUS", "3"))

# Codes are HMACs, so a missing secret must not fall back to something
# guessable — with no secret configured the feature is simply off.
_SECRET = os.getenv("REFERRAL_SECRET", "")

_CODE_LEN = 8


def enabled() -> bool:
    return bool(_SECRET) and auth_configured()


def code_for(user_id: str) -> Optional[str]:
    """Derive this user's referral code. None when the feature is off."""
    if not enabled() or not user_id:
        return None
    digest = hmac.new(
        _SECRET.encode("utf-8"), str(user_id).encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return digest[:_CODE_LEN].upper()


def _rest(path: str, params: dict) -> list:
    res = httpx.get(
        f"{SUPABASE_URL}/rest/v1/{path}",
        params=params,
        headers={
            "apikey": SUPABASE_SERVICE_KEY,
            "authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        },
        timeout=10,
    )
    res.raise_for_status()
    return res.json()


def resolve_code(code: str) -> Optional[str]:
    """Map a code back to its owner's user id.

    HMAC is one-way, so this scans candidate referrers and compares. That is
    fine at this scale and is bounded by the referrer index; if the user table
    ever grows past a few thousand, store the code on the profile row instead
    of scanning.
    """
    if not enabled() or not code:
        return None
    wanted = str(code).strip().upper()
    try:
        rows = _rest("profiles", {"select": "id", "limit": "5000"})
    except Exception:
        logger.warning("referral code resolution failed", exc_info=True)
        return None
    for row in rows:
        uid = row.get("id")
        if uid and hmac.compare_digest(code_for(uid) or "", wanted):
            return uid
    return None


def bonus_deployments(user_id: Optional[str]) -> int:
    """Extra deployment slots this user has earned, capped.

    Counts BOTH sides of the spec's promise: slots earned by referring people,
    plus the one slot you get for having been referred.
    """
    if not enabled() or not user_id:
        return 0
    try:
        referred = _rest(
            "referral_redemptions",
            {"select": "redeemer_id", "referrer_id": f"eq.{user_id}"},
        )
        was_referred = _rest(
            "referral_redemptions",
            {"select": "referrer_id", "redeemer_id": f"eq.{user_id}"},
        )
    except Exception:
        # Never widen limits on failure, and never block a deploy either.
        logger.warning("referral bonus lookup failed", exc_info=True)
        return 0
    earned = min(len(referred), REFERRAL_MAX_BONUS)
    return earned + (1 if was_referred else 0)


def redeem(code: str, redeemer_id: str) -> dict:
    """Record that `redeemer_id` was referred by the owner of `code`.

    Returns {"ok": bool, "reason": str}. Never raises — a failed redemption
    must not break a signup.
    """
    if not enabled():
        return {"ok": False, "reason": "referrals are not enabled"}
    referrer_id = resolve_code(code)
    if not referrer_id:
        return {"ok": False, "reason": "that referral code isn't valid"}
    if referrer_id == redeemer_id:
        return {"ok": False, "reason": "you can't refer yourself"}
    try:
        res = httpx.post(
            f"{SUPABASE_URL}/rest/v1/referral_redemptions",
            json={"redeemer_id": redeemer_id, "referrer_id": referrer_id},
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "content-type": "application/json",
                # Redeeming twice is a primary-key conflict, not an error the
                # user needs to see — it just means it already happened.
                "prefer": "resolution=ignore-duplicates,return=minimal",
            },
            timeout=10,
        )
        res.raise_for_status()
    except Exception:
        logger.warning("referral redemption failed", exc_info=True)
        return {"ok": False, "reason": "couldn't record that right now"}
    return {"ok": True, "reason": "referral applied"}
