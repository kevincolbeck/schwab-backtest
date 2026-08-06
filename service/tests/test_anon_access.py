"""P0-3 anonymous-access pin: the signup-free first backtest.

The Phase E 401s were never covered by tests — reopening them for templates
would have gone silently green. This file IS the pin now:
- anon daily-timeframe template runs (and chat-edited variants inside a
  template universe) return 200, never touch credits, and count per-IP
- custom specs, intraday templates, and ALL_US stay account-only for anon
- anon chat gets ANON_CHAT_PER_DAY messages per IP, then a recognizable 429
- /explain meters anon per IP
- _client_ip trusts the proxy-asserted IP only under the shared secret
"""

import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from service import auth, credits, main

USER = {"id": "user-1", "email": "t@example.com", "plan": "free"}


def _template_spec(name: str) -> dict:
    doc = json.loads((main.TEMPLATES_DIR / f"{name}.json").read_text(encoding="utf-8"))
    return doc.get("spec", doc)


def _custom_spec(symbols):
    return {
        "name": "Anon Gate Test",
        "symbols": symbols,
        "indicators": [{"name": "sma_50", "type": "sma", "source": "close", "length": 50}],
        "entry_rule_long": "close > sma_50",
        "exit_rule": "close < sma_50",
        "entry_price_field": "close",
        "backtest_timeframe": "1d",
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
    monkeypatch.setattr(main.runs_store, "save_run", lambda *a, **k: "run-anon-test")


@pytest.fixture
def anon_client(monkeypatch):
    monkeypatch.setattr(auth, "auth_configured", lambda: True)
    monkeypatch.setattr(auth, "_run_counts", {})  # isolate the day counters
    main.app.dependency_overrides[main.current_user] = lambda: None
    try:
        yield TestClient(main.app)
    finally:
        main.app.dependency_overrides.pop(main.current_user, None)


def test_anon_daily_template_runs_free_and_counts_per_ip(anon_client, monkeypatch):
    _stub_engine(monkeypatch)
    spends = []
    monkeypatch.setattr(credits, "spend", lambda *a, **k: spends.append(a) or (True, 100))
    counted = []
    real_counter = auth.check_and_count_run

    def recorder(identity, limit):
        counted.append((identity, limit))
        return real_counter(identity, limit)

    monkeypatch.setattr(auth, "check_and_count_run", recorder)
    resp = anon_client.post("/backtest", json={"spec": _template_spec("golden-cross")})
    assert resp.status_code == 200
    assert spends == []  # credits are user-only, always
    assert counted == [("ip:testclient", auth.PLAN_LIMITS["anon"]["runs_per_day"])]


def test_anon_chat_edited_template_variant_runs(anon_client, monkeypatch):
    _stub_engine(monkeypatch)
    spec = _template_spec("golden-cross")
    spec["stop_loss_pct"] = 5  # hash no longer matches; universe still does
    resp = anon_client.post("/backtest", json={"spec": spec})
    assert resp.status_code == 200


def test_anon_custom_spec_requires_account(anon_client):
    symbols = [f"ZZZ{c}" for c in "ABC"]
    resp = anon_client.post("/backtest", json={"spec": _custom_spec(symbols)})
    assert resp.status_code == 401
    assert "free account" in str(resp.json()["detail"])


def test_anon_intraday_template_requires_account(anon_client):
    # The account gate must fire BEFORE the intraday span cap: an anon on a
    # 15m template gets the recruitment message, not a date-range 422.
    resp = anon_client.post("/backtest", json={"spec": _template_spec("range-breakout-15m")})
    assert resp.status_code == 401
    assert "free account" in str(resp.json()["detail"])


def test_anon_all_us_requires_account(anon_client):
    resp = anon_client.post("/backtest", json={"spec": _custom_spec(["ALL_US"])})
    assert resp.status_code == 401


def test_anon_run_limit_429_is_recognizable(anon_client, monkeypatch):
    _stub_engine(monkeypatch)
    monkeypatch.setattr(auth, "check_and_count_run", lambda *a, **k: False)
    resp = anon_client.post("/backtest", json={"spec": _template_spec("golden-cross")})
    assert resp.status_code == 429
    detail = resp.json()["detail"]
    assert detail["error"] == "anon_run_limit"
    assert "free account" in detail["message"]


def test_signed_in_template_run_counts_against_the_quiet_cap(monkeypatch):
    """§5: every allowed run is metered by the plan's quiet fair-use cap.

    The credits-era exemption (signed-in template runs skipped the counter
    because credits priced them instead) is gone — nothing is priced now, so
    the cap is the only meter and it must see every run. Free's cap is
    deliberately generous; Pro/Max pass None and stay uncapped.
    """
    monkeypatch.setattr(auth, "auth_configured", lambda: True)
    monkeypatch.setattr(credits, "enabled_for", lambda user: False)
    _stub_engine(monkeypatch)
    counted = []
    monkeypatch.setattr(
        auth, "check_and_count_run", lambda *a, **k: counted.append(a) or True
    )
    main.app.dependency_overrides[main.current_user] = lambda: dict(USER)
    try:
        client = TestClient(main.app)
        resp = client.post("/backtest", json={"spec": _template_spec("golden-cross")})
    finally:
        main.app.dependency_overrides.pop(main.current_user, None)
    assert resp.status_code == 200
    assert counted == [(USER["id"], auth.PLAN_LIMITS["free"]["runs_per_day"])]


def test_anon_chat_three_free_then_gated(anon_client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(
        main.chat_brain, "call_claude",
        lambda *a, **k: '{"reply": "hi", "updated_spec": null, "should_rerun": false}',
    )
    monkeypatch.setattr(main, "ANON_CHAT_PER_DAY", 3)
    body = {"messages": [{"role": "user", "content": "tighten the stop"}],
            "current_spec": _template_spec("golden-cross")}
    for _ in range(3):
        assert anon_client.post("/chat", json=body).status_code == 200
    resp = anon_client.post("/chat", json=body)
    assert resp.status_code == 429
    detail = resp.json()["detail"]
    assert detail["error"] == "anon_chat_limit"
    assert "free account" in detail["message"]


def test_anon_explain_is_metered_per_ip(anon_client, monkeypatch, tmp_path):
    monkeypatch.setenv("SERVICE_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(main.chat_brain, "call_claude", lambda *a, **k: "Plain English.")
    counted = []
    monkeypatch.setattr(
        auth, "check_and_count_run", lambda identity, limit: counted.append((identity, limit)) or True
    )
    resp = anon_client.post("/explain", json={"spec": _template_spec("golden-cross")})
    assert resp.status_code == 200
    assert counted and counted[0][0].startswith("explain:ip:")


def _request_with(headers: dict, client_host: str = "10.0.0.9") -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "query_string": b"",
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
        "client": (client_host, 1234),
    }
    return Request(scope)


def test_client_ip_trusts_proxy_only_with_secret(monkeypatch):
    monkeypatch.setattr(main, "PROXY_SHARED_SECRET", "s3cret")
    trusted = _request_with({"x-proxy-secret": "s3cret", "x-client-ip": "203.0.113.7"})
    assert main._client_ip(trusted) == "203.0.113.7"
    wrong = _request_with({"x-proxy-secret": "nope", "x-client-ip": "203.0.113.7",
                           "x-forwarded-for": "203.0.113.7"})
    assert main._client_ip(wrong) == "10.0.0.9"  # spoofed headers ignored


def test_client_ip_without_secret_uses_socket_peer(monkeypatch):
    monkeypatch.setattr(main, "PROXY_SHARED_SECRET", "")
    req = _request_with({"x-forwarded-for": "203.0.113.7", "x-client-ip": "203.0.113.7"})
    assert main._client_ip(req) == "10.0.0.9"  # raw XFF is never consulted


def test_client_ip_non_ascii_secret_header_does_not_crash(monkeypatch):
    # A crafted non-ASCII x-proxy-secret must be a clean mismatch, not a 500
    # (hmac.compare_digest raises on non-ASCII str args — we compare bytes).
    monkeypatch.setattr(main, "PROXY_SHARED_SECRET", "s3cret")
    req = _request_with({"x-proxy-secret": "caf\xe9", "x-client-ip": "203.0.113.7"})
    assert main._client_ip(req) == "10.0.0.9"
