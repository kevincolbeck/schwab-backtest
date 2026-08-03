"""Guardrail tests: server-side spec validation + clamping (Phase 2)."""

from ai.strategist import clamp_spec, validate_spec


def good_spec():
    return {
        "name": "Test",
        "symbols": ["SPY", "QQQ"],
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


def test_valid_spec_passes():
    assert validate_spec(good_spec()) == []


def test_single_symbol_and_all_us_allowed():
    spec = good_spec()
    spec["symbols"] = ["SPY"]
    assert validate_spec(spec) == []
    spec["symbols"] = ["ALL_US"]
    assert validate_spec(spec) == []


def test_empty_symbols_rejected():
    spec = good_spec()
    spec["symbols"] = []
    errors = validate_spec(spec)
    assert any("symbols" in e for e in errors)


def test_garbage_ticker_rejected():
    spec = good_spec()
    spec["symbols"] = ["SPY", "not a ticker!!"]
    errors = validate_spec(spec)
    assert any("ticker" in e for e in errors)


def test_missing_entry_rule_rejected():
    spec = good_spec()
    del spec["entry_rule_long"]
    errors = validate_spec(spec)
    assert any("entry_rule" in e for e in errors)


def test_dangerous_rule_tokens_rejected():
    spec = good_spec()
    spec["exit_rule"] = "__import__('os').system('rm -rf /')"
    errors = validate_spec(spec)
    assert any("disallowed token" in e for e in errors)


def test_out_of_bounds_numbers_reported():
    spec = good_spec()
    spec["position_size_pct"] = 500
    spec["max_positions"] = 99
    errors = validate_spec(spec)
    assert any("position_size_pct" in e for e in errors)
    assert any("max_positions" in e for e in errors)


def test_zero_means_disabled_is_valid():
    spec = good_spec()
    spec["stop_loss_pct"] = 0
    spec["take_profit_pct"] = 0
    spec["max_holding_days"] = 0
    assert validate_spec(spec) == []


def test_bad_timeframe_and_price_field_rejected():
    spec = good_spec()
    spec["backtest_timeframe"] = "3m"
    spec["entry_price_field"] = "vwap"
    errors = validate_spec(spec)
    assert any("backtest_timeframe" in e for e in errors)
    assert any("entry_price_field" in e for e in errors)


def test_unknown_indicator_type_rejected():
    spec = good_spec()
    spec["indicators"].append({"name": "magic", "type": "hocus_pocus", "length": 5})
    errors = validate_spec(spec)
    assert any("hocus_pocus" in e for e in errors)


def test_clamp_spec_clamps_numbers():
    spec = good_spec()
    spec["position_size_pct"] = 500
    spec["stop_loss_pct"] = -3
    clamped = clamp_spec(spec)
    assert clamped["position_size_pct"] == 100
    assert clamped["stop_loss_pct"] == 0
    # original untouched
    assert spec["position_size_pct"] == 500


def test_clamp_is_identity_for_in_bounds_specs():
    # Regression: max(0.0, 0) returns 0.0, which changed spec hashes and broke
    # template-run exemption in production. In-range values must be untouched.
    spec = good_spec()
    spec["take_profit_pct"] = 0
    spec["stop_loss_pct"] = 0
    clamped = clamp_spec(spec)
    assert clamped == spec
    assert type(clamped["take_profit_pct"]) is int
    assert type(clamped["stop_loss_pct"]) is int


def test_all_templates_hash_stable_through_clamp():
    import json
    from pathlib import Path

    from service.forward import spec_hash_of

    templates_dir = Path(__file__).resolve().parents[2] / "templates"
    checked = 0
    for path in templates_dir.glob("*.json"):
        if path.name.startswith("_"):
            continue
        spec = json.loads(path.read_text(encoding="utf-8"))["spec"]
        assert spec_hash_of(clamp_spec(spec)) == spec_hash_of(spec), path.name
        checked += 1
    assert checked >= 8  # every shipped template, however many exist


def test_template_universe_subset_logic():
    # Chat edits of a template must stay runnable logged-out (DoD core loop):
    # a subset of a template universe passes; foreign symbols do not.
    from service.main import _within_template_universe

    minervini_symbols = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA",
                         "AMD", "AVGO", "NFLX", "ADBE", "CRM", "COST", "LLY", "V"]
    assert _within_template_universe(minervini_symbols) is True
    assert _within_template_universe(minervini_symbols[:5]) is True
    assert _within_template_universe(["ZZZZ", "YYYY"]) is False
    assert _within_template_universe([]) is False
