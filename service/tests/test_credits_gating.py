"""Credit-gating regression tests for /backtest and /chat (fail-open hardening).

Confirmed review findings covered here:
- plan gates (symbol cap / all-US) reject BEFORE any credits are spent
- engine exceptions refund the charge instead of a silent unrefunded 500
- a fail-open spend (credits unreachable) falls through to the per-day limiter
- any credits RPC failure sets a short backoff (not just the 404 missing-RPC case)

P0-4 note: single-block 1d runs are credit-exempt on every plan, so the
charge/refund/fail-open paths are exercised with intraday specs here; the
quiet 1d path has its own suite in test_quiet_daily_metering.py.
"""

import time
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from service import auth, credits, main

USER = {"id": "user-1", "email": "t@example.com", "plan": "free"}


def spec_with(symbols, timeframe="1d"):
    return {
        "name": "Gating Test",
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


def recent_window():
    """Intraday runs are capped at 60 days of history — use a live window."""
    return {"start_date": (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(auth, "auth_configured", lambda: True)
    monkeypatch.setattr(credits, "enabled_for", lambda user: True)
    main.app.dependency_overrides[main.current_user] = lambda: dict(USER)
    try:
        yield TestClient(main.app)
    finally:
        main.app.dependency_overrides.pop(main.current_user, None)


def test_symbol_cap_rejects_before_spend(client, monkeypatch):
    spends = []
    monkeypatch.setattr(credits, "spend", lambda *a, **k: spends.append(a) or (True, 100))
    # 11 fake tickers: over the free-plan cap of 10, not a template universe.
    symbols = [f"ZZZ{c}" for c in "ABCDEFGHIJK"]
    resp = client.post("/backtest", json={"spec": spec_with(symbols)})
    assert resp.status_code == 422
    assert "too many symbols" in str(resp.json()["detail"])
    assert spends == []  # the plan gate must fire before any credits move


def test_all_us_gate_rejects_before_spend(client, monkeypatch):
    spends = []
    monkeypatch.setattr(credits, "spend", lambda *a, **k: spends.append(a) or (True, 100))
    resp = client.post("/backtest", json={"spec": spec_with(["ALL_US"])})
    assert resp.status_code == 403
    assert spends == []


def test_engine_exception_refunds_charge(client, monkeypatch):
    # Intraday: still a real charge post-P0-4, so the refund path must hold.
    refunds = []
    monkeypatch.setattr(credits, "spend", lambda *a, **k: (True, 240))
    monkeypatch.setattr(
        credits, "refund",
        lambda user_id, amount, reason, ref=None: refunds.append((user_id, amount, reason)),
    )

    def boom(**kwargs):
        raise ValueError("Unknown variable in strategy rule: sma_50")

    monkeypatch.setattr(main.backtest_runner, "run_backtest", boom)
    resp = client.post(
        "/backtest",
        json={"spec": spec_with(["ZZZA", "ZZZB"], timeframe="15m"), **recent_window()},
    )
    assert resp.status_code == 500
    assert "credits refunded" in resp.json()["detail"]
    assert refunds == [(USER["id"], credits.backtest_cost("15m"), "backtest_error")]


def test_fail_open_spend_falls_through_to_daily_limit(client, monkeypatch):
    # Intraday billing that fails open (credits unreachable) must still land
    # on the per-day limiter — model/data spend stays bounded either way.
    counted = []
    monkeypatch.setattr(credits, "spend", lambda *a, **k: (True, None))  # fail-open
    monkeypatch.setattr(
        auth, "check_and_count_run",
        lambda identity, limit: counted.append((identity, limit)) or False,
    )
    resp = client.post(
        "/backtest",
        json={"spec": spec_with(["ZZZA", "ZZZB"], timeframe="15m"), **recent_window()},
    )
    assert resp.status_code == 429
    # Billed classes falling through must use the TIGHT backstop, not the
    # free plan's generous quiet-run cap — a credits outage must not widen
    # intraday exposure 5× (P0-4 review finding).
    assert counted == [(USER["id"], main.BILLED_FALLBACK_RUNS_PER_DAY)]
    assert main.BILLED_FALLBACK_RUNS_PER_DAY <= 10


def test_chat_fail_open_falls_through_to_daily_limit(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    counted = []
    monkeypatch.setattr(credits, "spend", lambda *a, **k: (True, None))  # fail-open
    monkeypatch.setattr(
        auth, "check_and_count_run",
        lambda identity, limit: counted.append((identity, limit)) or False,
    )
    resp = client.post("/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert resp.status_code == 429
    assert counted == [(f"chat:{USER['id']}", main.CHAT_PER_DAY)]


def test_rpc_failure_sets_short_backoff(monkeypatch):
    class Down:
        def __init__(self, *a, **k):
            raise RuntimeError("connection refused")

    monkeypatch.setattr(auth, "auth_configured", lambda: True)
    monkeypatch.setattr(credits.httpx, "Client", Down)
    monkeypatch.setattr(credits, "_disabled_until", 0.0)
    assert credits._rpc("spend_credits", {"p_user": "u"}) is None
    assert credits._disabled_until > time.time()  # backoff engaged
    assert credits.enabled_for({"id": "u"}) is False
