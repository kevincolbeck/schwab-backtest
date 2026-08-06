"""§5 flat capability tiers — the pricing contract, pinned.

Replaces the credits-era suites (test_credits_gating / test_quiet_daily_metering
/ test_intraday_deploy_gating), which pinned a model that no longer exists.

What must stay true:
- Plans sell CAPABILITIES. Intraday is Pro+, ALL_US and crypto are Max,
  symbol caps and deployment slots are per plan. Each refusal is a 403 that
  names the plan, never a balance.
- NOTHING is priced per action. A normal run/message never touches credits.
- Every allowed action is metered by a quiet per-day fair-use cap.
- Credits survive only as invisible OVERFLOW past that cap.
- No user-facing copy mentions credits or "out of credits".
"""

from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from service import auth, credits, main

FREE = {"id": "u-free", "email": "f@example.com", "plan": "free"}
PRO = {"id": "u-pro", "email": "p@example.com", "plan": "pro"}
MAX = {"id": "u-max", "email": "m@example.com", "plan": "max"}


def spec_with(symbols, timeframe="1d"):
    return {
        "name": "Flat Tier Test",
        "symbols": symbols,
        "indicators": [{"name": "sma_50", "type": "sma", "source": "close", "length": 50}],
        "entry_rule_long": "close > sma_50",
        "exit_rule": "close < sma_50",
        "entry_price_field": "close",
        "backtest_timeframe": timeframe,
        "position_size_mode": "notional_pct",
        "position_size_pct": 25,
        "max_positions": 4,
        "stop_loss_pct": 8,
    }


def recent():
    return {"start_date": (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")}


def _stub_engine(monkeypatch):
    monkeypatch.setattr(
        main.backtest_runner, "run_backtest",
        lambda **kwargs: ({"equity_curve": [], "trades": [], "total_trades": 0},
                          SimpleNamespace(benchmark="SPY")),
    )
    monkeypatch.setattr(main.runs_store, "save_run", lambda *a, **k: "run-flat")


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setattr(auth, "auth_configured", lambda: True)
    monkeypatch.setattr(credits, "enabled_for", lambda user: True)
    spends = []
    monkeypatch.setattr(
        credits, "spend",
        lambda uid, amount, reason, ref=None: spends.append((amount, reason)) or (True, 500),
    )

    def as_user(user):
        main.app.dependency_overrides[main.current_user] = lambda: dict(user)
        return TestClient(main.app)

    try:
        yield {"as_user": as_user, "spends": spends, "monkeypatch": monkeypatch}
    finally:
        main.app.dependency_overrides.pop(main.current_user, None)


# ── capability gates ─────────────────────────────────────────────────────────

def test_free_intraday_is_a_pro_capability(env):
    resp = env["as_user"](FREE).post(
        "/backtest", json={"spec": spec_with(["ZZZA"], "15m"), **recent()}
    )
    assert resp.status_code == 403
    detail = resp.json()["detail"]
    assert detail["plan_required"] == "pro"
    assert "credit" not in detail["message"].lower()
    assert env["spends"] == []  # capability refusals never touch the ledger


def test_pro_intraday_runs_and_is_never_charged(env, monkeypatch):
    _stub_engine(monkeypatch)
    monkeypatch.setattr(auth, "check_and_count_run", lambda identity, limit: True)
    resp = env["as_user"](PRO).post(
        "/backtest", json={"spec": spec_with(["ZZZA"], "15m"), **recent()}
    )
    assert resp.status_code == 200
    assert env["spends"] == []
    assert resp.json()["credits_charged"] == 0


def test_all_us_is_a_max_capability(env):
    resp = env["as_user"](PRO).post("/backtest", json={"spec": spec_with(["ALL_US"])})
    assert resp.status_code == 403
    assert resp.json()["detail"]["plan_required"] == "max"


def test_crypto_is_a_max_capability(env):
    # New gate in §5: the pricing page advertised crypto as Max-only but
    # nothing enforced it before.
    resp = env["as_user"](PRO).post("/backtest", json={"spec": spec_with(["X:BTCUSD"])})
    assert resp.status_code == 403
    assert resp.json()["detail"]["plan_required"] == "max"


def test_max_may_run_crypto(env, monkeypatch):
    _stub_engine(monkeypatch)
    monkeypatch.setattr(auth, "check_and_count_run", lambda identity, limit: True)
    resp = env["as_user"](MAX).post("/backtest", json={"spec": spec_with(["X:BTCUSD"])})
    assert resp.status_code == 200
    assert env["spends"] == []


def test_free_symbol_cap_still_422s(env):
    symbols = [f"ZZZ{c}" for c in "ABCDEFGHIJK"]  # 11 > free cap of 10
    resp = env["as_user"](FREE).post("/backtest", json={"spec": spec_with(symbols)})
    assert resp.status_code == 422
    assert "too many symbols" in str(resp.json()["detail"])


# ── nothing is priced per action ─────────────────────────────────────────────

def test_normal_daily_run_never_touches_credits(env, monkeypatch):
    _stub_engine(monkeypatch)
    counted = []
    monkeypatch.setattr(
        auth, "check_and_count_run",
        lambda identity, limit: counted.append((identity, limit)) or True,
    )
    resp = env["as_user"](FREE).post("/backtest", json={"spec": spec_with(["ZZZA"])})
    assert resp.status_code == 200
    assert env["spends"] == []
    assert counted == [(FREE["id"], auth.PLAN_LIMITS["free"]["runs_per_day"])]


def test_paid_plans_are_uncapped_on_runs(env, monkeypatch):
    _stub_engine(monkeypatch)
    counted = []
    monkeypatch.setattr(
        auth, "check_and_count_run",
        lambda identity, limit: counted.append((identity, limit)) or True,
    )
    env["as_user"](PRO).post("/backtest", json={"spec": spec_with(["ZZZA"])})
    assert counted == [(PRO["id"], None)]  # None = uncapped


def test_chat_uses_per_plan_cap_not_a_price(env, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    monkeypatch.setattr(
        main.chat_brain, "call_claude",
        lambda *a, **k: '{"reply": "hi", "updated_spec": null, "should_rerun": false}',
    )
    counted = []
    monkeypatch.setattr(
        auth, "check_and_count_run",
        lambda identity, limit: counted.append((identity, limit)) or True,
    )
    resp = env["as_user"](PRO).post("/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert resp.status_code == 200
    assert env["spends"] == []
    assert counted == [(f"chat:{PRO['id']}", auth.PLAN_LIMITS["pro"]["chat_per_day"])]
    assert resp.json()["credits_charged"] == 0


# ── overflow past the cap ────────────────────────────────────────────────────

def test_run_past_cap_uses_overflow_when_a_balance_exists(env, monkeypatch):
    _stub_engine(monkeypatch)
    monkeypatch.setattr(auth, "check_and_count_run", lambda identity, limit: False)
    resp = env["as_user"](FREE).post("/backtest", json={"spec": spec_with(["ZZZA"])})
    assert resp.status_code == 200
    assert env["spends"] == [(credits.backtest_cost("1d", 1), "backtest_overflow")]


def test_run_past_cap_429s_with_fair_use_copy_when_no_balance(env, monkeypatch):
    monkeypatch.setattr(auth, "check_and_count_run", lambda identity, limit: False)
    monkeypatch.setattr(credits, "spend", lambda *a, **k: (False, 0))
    resp = env["as_user"](FREE).post("/backtest", json={"spec": spec_with(["ZZZA"])})
    assert resp.status_code == 429
    detail = resp.json()["detail"]
    assert detail["error"] == "fair_use_limit"
    assert "credit" not in detail["message"].lower()
    assert "Pro lifts it" in detail["message"]


def test_run_past_cap_429s_when_overflow_is_unavailable(env, monkeypatch):
    # Credits dormant/unreachable: the cap stands on its own, no crash.
    monkeypatch.setattr(auth, "check_and_count_run", lambda identity, limit: False)
    monkeypatch.setattr(credits, "enabled_for", lambda user: False)
    resp = env["as_user"](FREE).post("/backtest", json={"spec": spec_with(["ZZZA"])})
    assert resp.status_code == 429
    assert resp.json()["detail"]["error"] == "fair_use_limit"


# ── deploys are slots, never fees ────────────────────────────────────────────

def test_intraday_deploy_charges_no_fee(env, monkeypatch, tmp_path):
    monkeypatch.setenv("SERVICE_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(
        main.runs_store, "get_run",
        lambda run_id: {"spec": spec_with(["ZZZA"], "15m"), "stats": {}},
    )
    resp = env["as_user"](PRO).post("/deploy", json={"run_id": "r1"})
    assert resp.status_code == 200
    assert env["spends"] == []  # the 100/250-credit fee is retired
    assert resp.json()["credits_charged"] == 0


def test_free_intraday_deploy_is_a_pro_capability(env, monkeypatch, tmp_path):
    monkeypatch.setenv("SERVICE_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(
        main.runs_store, "get_run",
        lambda run_id: {"spec": spec_with(["ZZZA"], "15m"), "stats": {}},
    )
    resp = env["as_user"](FREE).post("/deploy", json={"run_id": "r1"})
    assert resp.status_code == 403
    assert env["spends"] == []


def test_max_has_unlimited_deployment_slots(env, monkeypatch, tmp_path):
    # deployments=None must not TypeError against len(active).
    monkeypatch.setenv("SERVICE_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(
        main.runs_store, "get_run",
        lambda run_id: {"spec": spec_with(["ZZZA"]), "stats": {}},
    )
    listed = []
    monkeypatch.setattr(
        main.forward, "list_deployments",
        lambda status="active": listed.append(status) or [],
    )
    assert auth.PLAN_LIMITS["max"]["deployments"] is None
    resp = env["as_user"](MAX).post("/deploy", json={"run_id": "r1"})
    assert resp.status_code == 200
    assert listed == []  # unlimited slots skip the count entirely


# ── copy contract ────────────────────────────────────────────────────────────

def test_no_user_facing_message_mentions_credits():
    for user in (None, FREE, PRO, MAX):
        for action in ("backtest", "chat"):
            assert "credit" not in main._fair_use_message(user, action).lower()
    for feature, plan in (("Intraday timeframes", "pro"), ("Crypto markets", "max")):
        message = main._capability_403(feature, plan).detail["message"]
        assert "credit" not in message.lower()
        assert plan.capitalize() in message


def test_dev_open_when_auth_is_unconfigured(monkeypatch):
    """No auth configured = no accounts = nothing to gate by.

    Without this, a local/dev instance (or any deploy without Supabase) would
    403 its own operator out of intraday and ALL_US, since limits_for(None)
    would hand back the anonymous capability set.
    """
    monkeypatch.setattr(auth, "auth_configured", lambda: False)
    limits = auth.limits_for(None)
    assert limits["intraday"] and limits["crypto"] and limits["all_us"]
    monkeypatch.setattr(auth, "auth_configured", lambda: True)
    assert auth.limits_for(None) is auth.PLAN_LIMITS["anon"]


def test_plan_limits_match_the_published_pricing_table():
    """The /docs/credits table and /pricing cards are written from these."""
    free, pro, mx = (auth.PLAN_LIMITS[p] for p in ("free", "pro", "max"))
    assert (free["intraday"], free["crypto"], free["all_us"]) == (False, False, False)
    assert (free["max_symbols"], free["deployments"], free["private"]) == (10, 1, False)
    assert (pro["intraday"], pro["crypto"], pro["all_us"]) == (True, False, False)
    assert (pro["max_symbols"], pro["deployments"], pro["private"]) == (100, 10, True)
    assert (mx["intraday"], mx["crypto"], mx["all_us"]) == (True, True, True)
    assert (mx["max_symbols"], mx["deployments"], mx["private"]) == (200, None, True)
    # AI caps rise with the tier and stay within the §5 margin math
    # (docs/pricing-model.md §5). BOTH model-call surfaces count: chat at
    # $0.0611 worst case and explain cache-misses at $0.0135 — the review
    # caught explain being uncapped-by-plan, which made Pro adversarially
    # loss-making. Keep this inequality true when tuning any cap.
    assert free["chat_per_day"] < pro["chat_per_day"] < mx["chat_per_day"]
    assert free["explain_per_day"] <= pro["explain_per_day"] <= mx["explain_per_day"]

    def worst_case_month(limits):
        return 30 * (limits["chat_per_day"] * 0.0611 + limits["explain_per_day"] * 0.0135)

    assert worst_case_month(pro) <= 39, "Pro is adversarially loss-making"
    assert worst_case_month(mx) <= 99, "Max is adversarially loss-making"


def test_explain_is_capped_per_plan_not_flat():
    """Regression: /explain briefly lost its charge with only a flat 50/day
    left, which is a paid model call in the same COGS class as chat."""
    for plan in ("free", "pro", "max"):
        cap = auth.PLAN_LIMITS[plan]["explain_per_day"]
        assert isinstance(cap, int) and cap > 0
        # Never looser than the chat cap — same COGS class, cheaper per call.
        assert cap <= auth.PLAN_LIMITS[plan]["chat_per_day"] * 2


def test_explain_payload_cap_applies_to_signed_in_callers(monkeypatch):
    """The size ceiling used to be anon-only; a signed-in account could post
    a six-figure-character spec on every call."""
    monkeypatch.setattr(auth, "auth_configured", lambda: True)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    main.app.dependency_overrides[main.current_user] = lambda: dict(PRO)
    try:
        huge = spec_with([f"ZZ{i:04d}" for i in range(4000)])
        resp = TestClient(main.app).post("/explain", json={"spec": huge})
    finally:
        main.app.dependency_overrides.pop(main.current_user, None)
    assert resp.status_code in (413, 422)  # 422 if validation rejects first
