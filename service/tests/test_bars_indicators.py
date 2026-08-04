"""WS5: /runs/{id}/bars indicator display plan.

Spec-driven classification (overlay vs pane per indicator type), series built
with the engine's own indicator math, auto-registered rule references included.
Run store and bar cache are stubbed — no network, no real DB.
"""

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from service import backtest_runner, main, runs_store

N_BARS = 60


def _frame(n=N_BARS):
    dates = pd.bdate_range("2024-01-02", periods=n)
    closes = [100.0 + i for i in range(n)]
    return pd.DataFrame({
        "datetime": dates,
        "open": [c - 0.5 for c in closes],
        "high": [c + 1.0 for c in closes],
        "low": [c - 1.0 for c in closes],
        "close": closes,
        "volume": [1_000_000.0] * n,
    })


class _StubProvider:
    def __init__(self, *args, **kwargs):
        pass

    def read_cached_daily(self, symbol, start, end):
        return _frame()

    def close(self):
        pass


SPEC = {
    "name": "Display Plan Test",
    "symbols": ["AAPL"],
    "indicators": [
        {"type": "sma", "length": 5, "source": "close", "name": "sma_5"},
        {"type": "rsi", "length": 14, "source": "close", "name": "rsi_14"},
        {"type": "atr", "length": 14, "name": "atr_14"},
        {"type": "stddev", "length": 10, "source": "close", "name": "sd_10"},
        {"type": "rolling_max", "length": 10, "source": "high", "name": "hh_10"},
        {"type": "lag", "length": 3, "source": "close", "name": "lag_close"},
        {"type": "vwap_proxy", "name": "vwap_p"},
        {"type": "custom", "name": "spread", "formula": "close - open"},
        {"type": "external", "symbol": "SPY", "name": "spy_close"},
    ],
    # ema_10 is NOT declared — it must be auto-registered from the rule (the
    # strategist's auto-indicator regex).
    "entry_rule_long": "close > sma_5 and ema_10 > 0",
    "exit_rule": "close < sma_5",
}

RUNS = {
    "r1": {
        "run_id": "r1", "spec": SPEC,
        "params": {"start_date": "2024-01-02", "end_date": "2024-03-29"},
        "trades": [],
    },
    "r2": {
        "run_id": "r2",
        "spec": {"symbols": ["AAPL"], "entry_rule_long": "close > open"},
        "params": {"start_date": "2024-01-02", "end_date": "2024-03-29"},
        "trades": [],
    },
}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(runs_store, "get_run", lambda rid: RUNS.get(rid))
    monkeypatch.setattr(backtest_runner, "HistoricalDataProvider", _StubProvider)
    return TestClient(main.app)


def _plan(client, run_id="r1"):
    resp = client.get(f"/runs/{run_id}/bars", params={"symbol": "AAPL"})
    assert resp.status_code == 200
    return resp.json()


def test_display_plan_classification_per_type(client):
    out = _plan(client)
    plans = {p["name"]: p for p in out["indicators"]}

    assert plans["sma_5"]["kind"] == "overlay"
    assert plans["hh_10"]["kind"] == "overlay"      # rolling_max on price
    assert plans["vwap_p"]["kind"] == "overlay"
    assert plans["lag_close"]["kind"] == "overlay"  # lag OF PRICE -> overlay

    assert plans["rsi_14"]["kind"] == "pane"
    assert plans["atr_14"]["kind"] == "pane"
    assert plans["sd_10"]["kind"] == "pane"         # stddev -> pane
    assert plans["spread"]["kind"] == "pane"        # custom -> own pane

    # external needs merged reference frames this endpoint doesn't serve
    assert "spy_close" not in plans


def test_display_plan_labels(client):
    plans = {p["name"]: p for p in _plan(client)["indicators"]}
    assert plans["sma_5"]["label"] == "SMA 5"
    assert plans["rsi_14"]["label"] == "RSI 14"
    assert plans["vwap_p"]["label"] == "VWAP"
    assert plans["lag_close"]["label"] == "LAG 3"
    assert plans["spread"]["label"] == "spread"


def test_display_plan_includes_auto_registered_rule_indicators(client):
    plans = {p["name"]: p for p in _plan(client)["indicators"]}
    assert plans["ema_10"]["kind"] == "overlay"
    assert plans["ema_10"]["label"] == "EMA 10"


def test_display_plan_series_engine_math_and_warmup_nulls(client):
    out = _plan(client)
    plans = {p["name"]: p for p in out["indicators"]}
    bars = out["bars"]
    sma = plans["sma_5"]["series"]

    # capped to the bars window, aligned on time
    assert len(sma) == len(bars) == N_BARS
    assert sma[0]["time"] == bars[0]["time"]
    assert sma[-1]["time"] == bars[-1]["time"]

    # warm-up rows are nulls (engine uses min_periods=length)
    assert [p["value"] for p in sma[:4]] == [None] * 4
    # engine math: SMA(5) over closes 100..104
    assert sma[4]["value"] == pytest.approx(102.0)
    # lag: close shifted 3 bars
    lag = plans["lag_close"]["series"]
    assert lag[3]["value"] == pytest.approx(100.0)
    # custom formula: close - open = 0.5 everywhere
    spread = plans["spread"]["series"]
    assert spread[0]["value"] == pytest.approx(0.5)


def test_display_plan_empty_without_indicators_or_refs(client):
    out = _plan(client, "r2")
    assert out["indicators"] == []
    assert len(out["bars"]) == N_BARS   # candles unaffected


def test_bars_unknown_run_still_404(client):
    assert client.get("/runs/nope/bars", params={"symbol": "AAPL"}).status_code == 404
