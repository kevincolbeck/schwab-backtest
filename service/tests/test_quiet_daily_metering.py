"""P0-4 — remove credit anxiety: the quiet-metering contract for /backtest.

Pins the interim capability model (docs/CHATBACKTEST-BUILD.md §P0-4, heading
toward §5's flat tiers):
- a 1d run inside one symbol block never spends credits, on ANY plan —
  free users are metered by a quiet per-day fair-use cap, Pro/Max uncapped
- intraday, multi-block, and ALL_US runs still bill (the genuinely
  expensive class)
- limit-reached copy never says "out of credits" — free limits read as
  daily caps (true: the cap resets daily), paid ones as monthly usage
"""

from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from service import auth, credits, main

FREE_USER = {"id": "user-free", "email": "f@example.com", "plan": "free"}
PRO_USER = {"id": "user-pro", "email": "p@example.com", "plan": "pro"}


def spec_with(symbols, timeframe="1d"):
    return {
        "name": "Quiet Metering Test",
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
    return {"start_date": (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")}


def _stub_engine(monkeypatch):
    monkeypatch.setattr(
        main.backtest_runner, "run_backtest",
        lambda **kwargs: ({"equity_curve": [], "trades": [], "total_trades": 0},
                          SimpleNamespace(benchmark="SPY")),
    )
    monkeypatch.setattr(main.runs_store, "save_run", lambda *a, **k: "run-quiet-test")


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(auth, "auth_configured", lambda: True)
    monkeypatch.setattr(credits, "enabled_for", lambda user: True)
    main.app.dependency_overrides[main.current_user] = lambda: dict(FREE_USER)
    try:
        yield TestClient(main.app)
    finally:
        main.app.dependency_overrides.pop(main.current_user, None)


def test_free_1d_run_never_spends_credits(client, monkeypatch):
    _stub_engine(monkeypatch)
    spends, counted = [], []
    monkeypatch.setattr(credits, "spend", lambda *a, **k: spends.append(a) or (True, 100))
    monkeypatch.setattr(
        auth, "check_and_count_run",
        lambda identity, limit: counted.append((identity, limit)) or True,
    )
    resp = client.post("/backtest", json={"spec": spec_with(["ZZZA", "ZZZB"])})
    assert resp.status_code == 200
    assert spends == []  # the capability run must not touch the ledger
    assert resp.json()["credits_charged"] == 0
    # ...but it IS quietly metered against the free plan's daily fair-use cap.
    assert counted == [(FREE_USER["id"], auth.PLAN_LIMITS["free"]["runs_per_day"])]


def test_free_daily_cap_is_generous(client):
    # The quiet cap must stay generous enough that "unlimited backtests on
    # daily data" reads as fair-use, not a bait — floor it well above what a
    # human clicking around produces in a day.
    assert auth.PLAN_LIMITS["free"]["runs_per_day"] >= 50


def test_free_run_limit_copy_is_daily_framed(client, monkeypatch):
    monkeypatch.setattr(credits, "spend", lambda *a, **k: (True, 100))
    monkeypatch.setattr(auth, "check_and_count_run", lambda identity, limit: False)
    resp = client.post("/backtest", json={"spec": spec_with(["ZZZA", "ZZZB"])})
    assert resp.status_code == 429
    detail = resp.json()["detail"]
    assert detail["error"] == "free_run_limit"
    assert detail["message"] == "You've hit today's free run limit — Pro removes it."
    assert "credit" not in detail["message"].lower()


def test_pro_1d_run_unbilled_and_uncapped(client, monkeypatch):
    _stub_engine(monkeypatch)
    main.app.dependency_overrides[main.current_user] = lambda: dict(PRO_USER)
    spends, counted = [], []
    monkeypatch.setattr(credits, "spend", lambda *a, **k: spends.append(a) or (True, 100))
    monkeypatch.setattr(
        auth, "check_and_count_run",
        lambda identity, limit: counted.append((identity, limit)) or True,
    )
    resp = client.post("/backtest", json={"spec": spec_with(["ZZZA", "ZZZB"])})
    assert resp.status_code == 200
    assert spends == []  # no pricing inversion: paid plans get the freebie too
    assert counted == [(PRO_USER["id"], None)]  # None = uncapped for pro/max


def test_free_intraday_still_bills_with_capability_copy(client, monkeypatch):
    spends = []
    monkeypatch.setattr(
        credits, "spend",
        lambda uid, amount, reason, ref=None: spends.append(amount) or (False, 3),
    )
    resp = client.post(
        "/backtest",
        json={"spec": spec_with(["ZZZA", "ZZZB"], timeframe="15m"), **recent_window()},
    )
    assert resp.status_code == 402
    assert spends == [credits.backtest_cost("15m")]  # intraday still prices
    detail = resp.json()["detail"]
    assert detail["error"] == "out_of_credits"  # machine code stays API-stable
    assert detail["balance"] == 3  # the meter still gets the true balance
    assert "credit" not in detail["message"].lower()  # never "out of credits"
    assert "Daily-data backtests stay free" in detail["message"]


def test_paid_402_copy_is_monthly_framed(client, monkeypatch):
    main.app.dependency_overrides[main.current_user] = lambda: dict(PRO_USER)
    monkeypatch.setattr(credits, "spend", lambda *a, **k: (False, 0))
    resp = client.post(
        "/backtest",
        json={"spec": spec_with(["ZZZA", "ZZZB"], timeframe="15m"), **recent_window()},
    )
    assert resp.status_code == 402
    message = resp.json()["detail"]["message"]
    assert "credit" not in message.lower()
    assert "this month's included usage" in message


def test_limit_messages_never_mention_credits():
    for user in (None, FREE_USER, PRO_USER, {**FREE_USER, "plan": "max"}):
        for action in ("backtest", "chat", "explain", "deploy"):
            for tf in (None, "1d", "15m", "1m"):
                message = main._usage_limit_message(user, action, timeframe=tf)
                assert "credit" not in message.lower()


def test_free_daily_402_copy_never_blames_intraday():
    # Defense in depth: if a billed daily class ever becomes reachable again,
    # the free 402 must not claim the run was intraday (P0-4 review finding).
    message = main._usage_limit_message(FREE_USER, "backtest", timeframe="1d")
    assert "intraday" not in message.lower()
    assert "Universes past 10 symbols" in message


def test_free_template_universe_daily_run_is_quiet(client, monkeypatch):
    # Three shipped daily templates hold 11-19 symbols; a chat-edited variant
    # (hash no longer matches) must stay as free signed-in as anonymously.
    _stub_engine(monkeypatch)
    main._load_template_meta()
    big = max(main._template_symbols_cache or [], key=len)
    if len(big) <= credits.SYMBOL_BLOCK:
        pytest.skip("no shipped template exceeds one symbol block")
    symbols = sorted(big)[: credits.SYMBOL_BLOCK + 2]  # 12-symbol template subset
    spends = []
    monkeypatch.setattr(credits, "spend", lambda *a, **k: spends.append(a) or (True, 100))
    monkeypatch.setattr(auth, "check_and_count_run", lambda identity, limit: True)
    resp = client.post("/backtest", json={"spec": spec_with(symbols)})
    assert resp.status_code == 200
    assert spends == []
    assert resp.json()["credits_charged"] == 0


def test_duplicate_symbols_do_not_flip_billing(client, monkeypatch):
    # Billing counts UNIQUE resolved symbols (the engine dedupes before
    # simulating): 11 entries / 10 unique must stay a quiet single-block run.
    _stub_engine(monkeypatch)
    main.app.dependency_overrides[main.current_user] = lambda: dict(PRO_USER)
    spends = []
    monkeypatch.setattr(credits, "spend", lambda *a, **k: spends.append(a) or (True, 100))
    monkeypatch.setattr(auth, "check_and_count_run", lambda identity, limit: True)
    symbols = [f"ZZZ{c}" for c in "ABCDEFGHIJ"] + ["ZZZA"]  # 11 entries, 10 unique
    resp = client.post("/backtest", json={"spec": spec_with(symbols)})
    assert resp.status_code == 200
    assert spends == []
    assert resp.json()["credits_charged"] == 0


def test_indicator_count_is_capped():
    from ai.strategist import MAX_INDICATORS, validate_spec

    spec = spec_with(["ZZZA"])
    spec["indicators"] = [
        {"name": f"sma_{i + 1}", "type": "sma", "source": "close", "length": i + 1}
        for i in range(MAX_INDICATORS + 1)
    ]
    errors = validate_spec(spec)
    assert any("too many indicators" in e for e in errors)
