"""Margin-safe pricing: chat token scaling, backtest symbol scaling, context cap.

Owner directive: every credit-priced action must carry a large gross margin
over worst-case marginal cost. These tests pin the tunable formulas in
service/credits.py (docs/pricing-model.md is the tunable source of truth) and
the chat context cap in service/chat.py that bounds worst-case model cost.
"""

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from service import auth, chat, credits, main

USER = {"id": "user-1", "email": "t@example.com", "plan": "pro"}


# ── chat_cost formula boundaries ─────────────────────────────────────────────

def test_chat_cost_floor():
    assert credits.chat_cost(0) == credits.CHAT_COST_MIN == 12
    assert credits.chat_cost(1) == 12
    assert credits.chat_cost(800) == 12          # 1 credit worth, floor wins
    assert credits.chat_cost(9600) == 12         # exactly at the floor boundary


def test_chat_cost_scales_past_floor():
    assert credits.chat_cost(9601) == 13         # first token past the floor
    assert credits.chat_cost(16000) == 20
    assert credits.chat_cost(16001) == 21


def test_estimate_chat_tokens():
    # chars / CHAT_CHARS_PER_TOKEN (2.5 — conservative vs English's ~4 so the
    # margin floor holds for dense-token inputs) + 1500 output allowance.
    assert credits.estimate_chat_tokens(0) == 1500       # output allowance only
    assert credits.estimate_chat_tokens(5) == 1502       # ceil(5 / 2.5)
    assert credits.estimate_chat_tokens(4000) == 3100    # 1600 + 1500


# ── backtest symbol-multiplier boundaries ────────────────────────────────────

def test_symbol_multiplier_boundaries():
    assert credits.backtest_cost("1d") == 10             # legacy single-arg call
    assert credits.backtest_cost("1d", 1) == 10
    assert credits.backtest_cost("1d", 10) == 10         # 10 symbols ×1
    assert credits.backtest_cost("1d", 11) == 20         # 11 symbols ×2
    assert credits.backtest_cost("1d", 20) == 20
    assert credits.backtest_cost("1d", 21) == 30
    assert credits.backtest_cost("1d", 200) == 200       # ALL_US resolved size
    assert credits.backtest_cost("1d", 5000) == 200      # hard cap ×20


def test_symbol_multiplier_applies_to_intraday_bases():
    assert credits.backtest_cost("60m", 10) == 25
    assert credits.backtest_cost("15m", 11) == 50
    assert credits.backtest_cost("1m", 1) == 50


def test_grants_and_packs_unchanged():
    assert credits.SIGNUP_GRANT == 250
    assert credits.MONTHLY_GRANTS == {"pro": 2500, "max": 10000}
    assert credits.PACKS == {
        "small": {"credits": 500, "usd": 10},
        "large": {"credits": 1500, "usd": 25},
    }


# ── chat context cap ─────────────────────────────────────────────────────────

def test_cap_history_truncates_and_keeps_most_recent():
    msgs = [
        {"role": "user", "content": f"m{i:02d}" + "x" * 3000} for i in range(15)
    ]
    capped = chat.cap_history(msgs)
    assert len(capped) == chat.MAX_HISTORY_MESSAGES == 12
    assert all(len(m["content"]) == chat.MAX_MESSAGE_CHARS == 2000 for m in capped)
    assert capped[0]["content"].startswith("m03")   # oldest three dropped
    assert capped[-1]["content"].startswith("m14")  # most recent kept
    assert len(msgs[0]["content"]) == 3003          # originals untouched


def test_cap_history_leaves_short_history_alone():
    msgs = [{"role": "user", "content": "hi"}]
    assert chat.cap_history(msgs) == msgs


# ── route-level wiring: charged amount matches the formulas ──────────────────

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(auth, "auth_configured", lambda: True)
    monkeypatch.setattr(credits, "enabled_for", lambda user: True)
    monkeypatch.setattr(credits, "balance", lambda user_id: 480)
    main.app.dependency_overrides[main.current_user] = lambda: dict(USER)
    try:
        yield TestClient(main.app)
    finally:
        main.app.dependency_overrides.pop(main.current_user, None)


def spec_with(symbols, timeframe="1d"):
    return {
        "name": "Scaling Test",
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


def _stub_engine(monkeypatch):
    monkeypatch.setattr(
        main.backtest_runner, "run_backtest",
        lambda **kwargs: ({"equity_curve": [], "trades": [], "total_trades": 0},
                          SimpleNamespace(benchmark="SPY")),
    )
    monkeypatch.setattr(
        main.runs_store, "save_run", lambda *a, **k: "run-scaling-test"
    )


# ── §5: these prices only apply PAST a fair-use cap (overflow). Each test
# exhausts the cap first, then asserts the overflow spend uses the same
# scaling the pure functions above define.

def _cap_exhausted(monkeypatch):
    monkeypatch.setattr(auth, "check_and_count_run", lambda identity, limit: False)


def test_overflow_backtest_charges_symbol_scaled_cost(client, monkeypatch):
    _stub_engine(monkeypatch)
    _cap_exhausted(monkeypatch)
    spends = []
    monkeypatch.setattr(
        credits, "spend",
        lambda uid, amount, reason, ref=None: spends.append((amount, reason)) or (True, 460),
    )
    # 11 fake tickers (pro cap is 100): resolved count 11 -> x2 -> 20 credits.
    symbols = [f"ZZZ{c}" for c in "ABCDEFGHIJK"]
    resp = client.post("/backtest", json={"spec": spec_with(symbols)})
    assert resp.status_code == 200
    assert spends == [(20, "backtest_overflow")]
    assert resp.json()["credits_charged"] == 20
    assert resp.json()["credits_remaining"] == 480


def test_overflow_backtest_all_us_prices_at_cap(client, monkeypatch):
    _stub_engine(monkeypatch)
    _cap_exhausted(monkeypatch)
    main.app.dependency_overrides[main.current_user] = lambda: {**USER, "plan": "max"}
    # ALL_US resolves to the full capped universe (no network in tests).
    monkeypatch.setattr(
        main.backtest_runner, "resolve_symbols",
        lambda spec, max_symbols=0: ([f"S{i}" for i in range(200)] + ["SPY"], True),
    )
    spends = []
    monkeypatch.setattr(
        credits, "spend",
        lambda uid, amount, reason, ref=None: spends.append(amount) or (True, 50),
    )
    resp = client.post("/backtest", json={"spec": spec_with(["ALL_US"])})
    assert resp.status_code == 200
    assert spends == [200]  # 1d base 10 x capped multiplier 20
    assert resp.json()["credits_charged"] == 200


def test_overflow_chat_charges_token_scaled_cost(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    _cap_exhausted(monkeypatch)
    monkeypatch.setattr(
        main.chat_brain, "call_claude",
        lambda *a, **k: '{"reply": "hi", "updated_spec": null, "should_rerun": false}',
    )
    spends = []
    monkeypatch.setattr(
        credits, "spend",
        lambda uid, amount, reason, ref=None: spends.append((amount, reason)) or (True, 470),
    )
    # Long history: the charge must be computed over the CAPPED context.
    messages = [{"role": "user", "content": "m" * 5000} for _ in range(15)]
    resp = client.post("/chat", json={"messages": messages})
    assert resp.status_code == 200

    capped = chat.cap_history(messages)
    system_prompt = chat.build_system_prompt(None, None, "No backtest configured yet.")
    expected_chars = len(system_prompt) + sum(len(m["content"]) for m in capped)
    expected = credits.chat_cost(credits.estimate_chat_tokens(expected_chars))
    assert expected > credits.CHAT_COST_MIN  # this payload is big enough to scale
    assert spends == [(expected, "chat_overflow")]
    body = resp.json()
    assert body["credits_charged"] == expected
    assert body["credits_remaining"] == 480


def test_chat_empty_messages_rejected_before_spend(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    spends = []
    monkeypatch.setattr(
        credits, "spend", lambda *a, **k: spends.append(a) or (True, 470)
    )
    resp = client.post("/chat", json={"messages": [{"role": "system", "content": "x"}]})
    assert resp.status_code == 422
    assert spends == []
