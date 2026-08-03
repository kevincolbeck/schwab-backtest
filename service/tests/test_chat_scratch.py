"""Scratch-mode /chat (Phase D): current_spec null engages the guided intake
and the endpoint still returns the strict {reply, updated_spec, should_rerun}
contract with the model call mocked."""

import json

import pytest
from fastapi.testclient import TestClient

from service import auth, credits, main

USER = {"id": "user-1", "email": "t@example.com", "plan": "free"}

# The kind of partial-but-valid draft the intake produces after one answer:
# user picked crypto; everything else is a sensible provisional default.
DRAFT_SPEC = {
    "name": "Untitled Crypto Strategy",
    "symbols": ["X:BTCUSD"],
    "indicators": [{"name": "sma_50", "type": "sma", "source": "close", "length": 50}],
    "entry_rule_long": "close > sma_50",
    "exit_rule": "close < sma_50",
    "entry_price_field": "close",
    "backtest_timeframe": "1d",
    "position_size_mode": "notional_pct",
    "position_size_pct": 10,
    "max_positions": 5,
    "stop_loss_pct": 8,
}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(auth, "auth_configured", lambda: True)
    monkeypatch.setattr(credits, "enabled_for", lambda user: False)
    monkeypatch.setattr(auth, "check_and_count_run", lambda identity, limit: True)
    main.app.dependency_overrides[main.current_user] = lambda: dict(USER)
    try:
        yield TestClient(main.app)
    finally:
        main.app.dependency_overrides.pop(main.current_user, None)


def test_chat_with_null_spec_returns_live_draft(client, monkeypatch):
    prompts = []

    def fake_call(messages, system_prompt, **kwargs):
        prompts.append(system_prompt)
        return json.dumps({
            "reply": "Crypto it is — daily bars, or intraday?",
            "updated_spec": DRAFT_SPEC,
            "should_rerun": False,
        })

    monkeypatch.setattr(main.chat_brain, "call_claude", fake_call)
    resp = client.post("/chat", json={
        "messages": [{"role": "user", "content": "I want to build a crypto strategy"}],
        "current_spec": None,
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["updated_spec"]["symbols"] == ["X:BTCUSD"]  # draft survives validation
    assert body["validation_errors"] == []
    assert body["should_rerun"] is False
    assert body["reply"].startswith("Crypto")
    assert "Guided Intake" in prompts[0]      # scratch mode engaged the intake
    assert "Known Failure Patterns" in prompts[0]


def test_chat_omitting_current_spec_entirely_still_200(client, monkeypatch):
    monkeypatch.setattr(
        main.chat_brain, "call_claude",
        lambda messages, system_prompt, **kw: json.dumps(
            {"reply": "Which market?", "updated_spec": None, "should_rerun": False}
        ),
    )
    resp = client.post("/chat", json={
        "messages": [{"role": "user", "content": "help me start a strategy"}],
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["updated_spec"] is None
    assert body["should_rerun"] is False
