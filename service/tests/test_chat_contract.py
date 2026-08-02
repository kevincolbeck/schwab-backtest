"""Tests for the strict {reply, updated_spec, should_rerun} chat contract parsing."""

import json

from service.chat import build_system_prompt, parse_chat_response

SPEC = {
    "name": "Golden Cross",
    "symbols": ["SPY"],
    "entry_rule_long": "sma_50 > sma_200",
    "exit_rule": "sma_50 < sma_200",
    "stop_loss_pct": 8,
}


def test_strict_json_response_parses():
    raw = json.dumps({
        "reply": "Done — stop tightened to 5%.",
        "updated_spec": {**SPEC, "stop_loss_pct": 5},
        "should_rerun": True,
    })
    out = parse_chat_response(raw)
    assert out["reply"].startswith("Done")
    assert out["updated_spec"]["stop_loss_pct"] == 5
    assert out["should_rerun"] is True


def test_fenced_json_response_parses():
    raw = "Here you go:\n```json\n" + json.dumps({
        "reply": "ok", "updated_spec": None, "should_rerun": False,
    }) + "\n```"
    out = parse_chat_response(raw)
    assert out["reply"] == "ok"
    assert out["updated_spec"] is None
    assert out["should_rerun"] is False


def test_should_rerun_forced_false_without_spec():
    raw = json.dumps({"reply": "no changes", "updated_spec": None, "should_rerun": True})
    out = parse_chat_response(raw)
    assert out["should_rerun"] is False


def test_plain_prose_degrades_to_reply():
    raw = "The Sharpe ratio measures risk-adjusted return."
    out = parse_chat_response(raw)
    assert out["reply"] == raw
    assert out["updated_spec"] is None
    assert out["should_rerun"] is False


def test_legacy_strategy_spec_shape_still_recognized():
    raw = (
        "Proposal:\n```json\n"
        + json.dumps({"proposed_changes": {}, "strategy_spec": SPEC})
        + "\n```\nLet me know."
    )
    out = parse_chat_response(raw)
    assert out["updated_spec"] is not None
    assert out["updated_spec"]["name"] == "Golden Cross"
    assert out["should_rerun"] is True


def test_system_prompt_contains_hard_rules_and_context():
    prompt = build_system_prompt(SPEC, {"cagr": 12.0, "sharpe": 1.1, "total_trades": 20}, "Date range: x")
    assert "may NOT predict future prices" in prompt
    assert "Golden Cross" in prompt          # spec is embedded
    assert "Most Recent Backtest Results" in prompt
    assert '"should_rerun"' in prompt        # strict contract documented
