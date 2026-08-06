"""§8 referral mechanic — the abuse surface is the design, so test that.

This grants FREE CAPACITY that costs real money to serve. Every assertion here
corresponds to a specific way it gets farmed.
"""

import importlib

import pytest

from service import auth, referrals


@pytest.fixture
def on(monkeypatch):
    monkeypatch.setenv("REFERRAL_SECRET", "s" * 32)
    monkeypatch.setattr(referrals, "_SECRET", "s" * 32)
    monkeypatch.setattr(referrals, "auth_configured", lambda: True)
    return referrals


def test_disabled_without_a_secret(monkeypatch):
    """A missing secret must switch the feature OFF, never fall back to
    something guessable — the code IS the authorisation."""
    monkeypatch.setattr(referrals, "_SECRET", "")
    assert referrals.enabled() is False
    assert referrals.code_for("u1") is None
    assert referrals.bonus_deployments("u1") == 0


def test_codes_are_stable_and_distinct(on):
    assert on.code_for("a") == on.code_for("a")
    assert on.code_for("a") != on.code_for("b")


def test_self_referral_is_refused(on, monkeypatch):
    monkeypatch.setattr(on, "resolve_code", lambda code: "same-user")
    assert on.redeem("ANY", "same-user")["ok"] is False


def test_bonus_is_capped(on, monkeypatch):
    """The cap is the only defence that bites against throwaway-account
    farming — there is no email-confirmation gate on the deploy path."""
    monkeypatch.setattr(on, "REFERRAL_MAX_BONUS", 3)
    monkeypatch.setattr(
        on, "_rest",
        lambda path, params: [{"redeemer_id": str(i)} for i in range(50)]
        if "referrer_id" in params else [],
    )
    assert on.bonus_deployments("u1") == 3


def test_lookup_failure_never_widens_limits(on, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("supabase down")

    monkeypatch.setattr(on, "_rest", boom)
    # Zero is the safe direction: it must not hand out slots on an outage, and
    # it must not block a deploy either.
    assert on.bonus_deployments("u1") == 0


def test_referral_only_widens_deployments(on, monkeypatch):
    monkeypatch.setattr(referrals, "bonus_deployments", lambda uid: 2)
    free = auth.limits_for({"id": "u1", "plan": "free"})
    base = auth.PLAN_LIMITS["free"]
    assert free["deployments"] == base["deployments"] + 2
    # A referral must never sell a capability. §5's flat tiers stay the product.
    for key in ("intraday", "crypto", "all_us", "private", "max_symbols"):
        assert free[key] == base[key]


def test_referral_does_not_corrupt_the_shared_plan_table(on, monkeypatch):
    """PLAN_LIMITS entries are module-level dicts shared by every request —
    mutating one would leak a bonus to every other user on the instance."""
    monkeypatch.setattr(referrals, "bonus_deployments", lambda uid: 2)
    auth.limits_for({"id": "u1", "plan": "free"})
    assert auth.PLAN_LIMITS["free"]["deployments"] == 1


def test_max_plan_stays_unlimited(on, monkeypatch):
    monkeypatch.setattr(referrals, "bonus_deployments", lambda uid: 3)
    assert auth.limits_for({"id": "u1", "plan": "max"})["deployments"] is None


def test_anonymous_gets_no_bonus(on):
    assert auth.limits_for(None)["deployments"] in (0, None)
