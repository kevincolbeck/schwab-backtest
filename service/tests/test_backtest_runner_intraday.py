"""Intraday wiring: a minute-timeframe spec must reach the engine with intraday bars."""

import pandas as pd

from service import backtest_runner


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
    """Serves synthetic 15m bars; fails loudly if the daily path is used."""

    intraday_calls: list = []

    def __init__(self, *args, **kwargs):
        pass

    def fetch_universe(self, *args, **kwargs):
        raise AssertionError("daily universe fetch must not run for intraday specs")

    def fetch_intraday_symbol(self, symbol, start_date=None, end_date=None, interval="5m", **kwargs):
        StubProvider.intraday_calls.append((symbol, interval))
        return _intraday_bars(["2024-01-02", "2024-01-03"])

    def close(self):
        pass


def test_15m_spec_runs_engine_on_intraday_data(monkeypatch):
    StubProvider.intraday_calls = []
    monkeypatch.setattr(backtest_runner, "HistoricalDataProvider", StubProvider)

    spec = {
        "name": "Intraday Wiring Test",
        "symbols": ["AAPL"],
        "indicators": [],
        "entry_rule_long": "close > 0",
        "exit_rule": "close < 0",
        "backtest_timeframe": "15m",
        "position_size_mode": "notional_pct",
        "position_size_pct": 10,
        "max_positions": 1,
    }
    results, bt_config = backtest_runner.run_backtest(spec, "2024-01-02", "2024-01-03")

    assert ("AAPL", "15m") in StubProvider.intraday_calls
    assert ("SPY", "15m") in StubProvider.intraday_calls  # benchmark rides along
    # Pre-fix the engine only saw an empty intraday cache and bailed with
    # "No data available for strategy symbols".
    assert "error" not in results
    assert results.get("total_trades") is not None
