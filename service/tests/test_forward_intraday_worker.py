"""Forward worker on intraday deployments: stubbed data, no network.

Granularity parity: a 15m deployment forward-tests on 15m closed candles via
the same engine replay as backtests (no drift by construction). The worker
processes mixed EOD + intraday deployments in one pass, shares intraday
fetches per (symbol, timeframe), and isolates per-deployment failures.
"""

import pandas as pd
import pytest

from service import backtest_runner, forward


@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    monkeypatch.setenv("SERVICE_DATA_DIR", str(tmp_path))
    yield


def _intraday_bars(dates, bars_per_day=26) -> pd.DataFrame:
    frames = []
    for day in dates:
        idx = pd.date_range(f"{day} 09:30", periods=bars_per_day, freq="15min")
        close = pd.Series(range(bars_per_day), index=idx) * 0.1 + 100.0
        frames.append(
            pd.DataFrame(
                {
                    "datetime": idx,
                    "open": close.values,
                    "high": close.values + 0.5,
                    "low": close.values - 0.5,
                    "close": close.values,
                    "volume": 10_000.0,
                }
            )
        )
    return pd.concat(frames, ignore_index=True)


class StubProvider:
    """Serves synthetic 15m bars; the daily path gets no data (so a 1d
    deployment in the same pass fails, proving error isolation)."""

    intraday_calls: list = []

    def __init__(self, *args, **kwargs):
        pass

    def fetch_universe(self, *args, **kwargs):
        return {}  # daily deployment -> "No historical data available"

    def fetch_intraday_symbol(self, symbol, start_date=None, end_date=None, interval="5m", **kwargs):
        StubProvider.intraday_calls.append((symbol, interval))
        return _intraday_bars(["2024-01-02", "2024-01-03"])

    def close(self):
        pass


INTRADAY_SPEC = {
    "name": "Intraday Forward",
    "symbols": ["AAPL"],
    "indicators": [],
    "entry_rule_long": "close > 0",
    "exit_rule": "close < 0",
    "backtest_timeframe": "15m",
    "position_size_mode": "notional_pct",
    "position_size_pct": 10,
    "max_positions": 1,
}


def test_worker_mixed_pass_shares_fetches_and_isolates_failures(monkeypatch):
    StubProvider.intraday_calls = []
    monkeypatch.setattr(backtest_runner, "HistoricalDataProvider", StubProvider)

    a = forward.create_deployment(INTRADAY_SPEC, name="A", deployed_at="2024-01-02")
    b = forward.create_deployment(
        {**INTRADAY_SPEC, "name": "B"}, name="B", deployed_at="2024-01-03"
    )
    broken = forward.create_deployment(
        {**INTRADAY_SPEC, "name": "Broken", "backtest_timeframe": "1d"},
        name="Broken", deployed_at="2024-01-02",
    )

    out = forward.run_worker(as_of="2024-01-03")

    # Mixed pass: all three processed; the failing EOD one doesn't break the rest.
    assert out["processed"] == 3
    assert any(broken["slug"] in err for err in out["errors"])
    assert not any(a["slug"] in err for err in out["errors"])
    assert not any(b["slug"] in err for err in out["errors"])

    # Shared prefetch: ONE intraday fetch per (symbol, timeframe) for the whole
    # pass — two deployments on the same universe cost 2 fetches (AAPL + SPY
    # benchmark), not 4.
    assert sorted(set(StubProvider.intraday_calls)) == [("AAPL", "15m"), ("SPY", "15m")]
    assert len(StubProvider.intraday_calls) == 2

    # Out-of-sample intraday signals reached the ledger, keyed by bar timestamp
    # (same-day trades stay distinct under the append-only unique constraint).
    signals_a = forward.get_signals(a["id"])
    assert signals_a
    assert all(len(s["signal_date"]) > 10 for s in signals_a)
    assert all(s["signal_date"][:10] >= "2024-01-02" for s in signals_a)

    # Equity snapshots stay one-per-day (last bar of the day), so leaderboard
    # days-live semantics are unchanged.
    equity_a = forward.get_equity_series(a["id"])
    assert [p["date"] for p in equity_a] == ["2024-01-02", "2024-01-03"]
    equity_b = forward.get_equity_series(b["id"])
    assert [p["date"] for p in equity_b] == ["2024-01-03"]  # deployed later

    # Leaderboard payload badges the timeframe (derived from the frozen spec).
    board = forward.leaderboard(min_days=0)
    by_slug = {e["slug"]: e for e in board}
    assert by_slug[a["slug"]]["timeframe"] == "15m"
    assert by_slug[broken["slug"]]["timeframe"] == "1d"


def test_worker_rerun_is_idempotent_for_intraday(monkeypatch):
    StubProvider.intraday_calls = []
    monkeypatch.setattr(backtest_runner, "HistoricalDataProvider", StubProvider)

    forward.create_deployment(INTRADAY_SPEC, name="A", deployed_at="2024-01-02")
    first = forward.run_worker(as_of="2024-01-03")
    assert first["signals_appended"] > 0
    second = forward.run_worker(as_of="2024-01-03")
    assert second["signals_appended"] == 0  # unique constraints absorb the replay
    assert second["errors"] == []
