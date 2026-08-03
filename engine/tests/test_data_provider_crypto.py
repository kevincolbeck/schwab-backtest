"""Crypto-specific data provider behavior: UTC day labels + one-time cache purge."""

import sqlite3

import pandas as pd

from backtest.data_provider import HistoricalDataProvider

# 2024-01-02 00:00 in the bucket timezone Polygon uses for each asset class.
MIDNIGHT_UTC_MS = int(pd.Timestamp("2024-01-02", tz="UTC").timestamp() * 1000)
MIDNIGHT_ET_MS = int(pd.Timestamp("2024-01-02", tz="America/New_York").timestamp() * 1000)


def _provider(tmp_path) -> HistoricalDataProvider:
    return HistoricalDataProvider(cache_db_path=str(tmp_path / "cache.db"))


def _payload(ts_ms: int) -> list:
    return [{"t": ts_ms, "o": 1.0, "h": 2.0, "l": 0.5, "c": 1.5, "v": 100.0}]


def test_crypto_daily_bars_keep_utc_day_labels(tmp_path):
    provider = _provider(tmp_path)
    out = provider._normalize_polygon_results(
        _payload(MIDNIGHT_UTC_MS), symbol="X:BTCUSD", timespan="day"
    )
    provider.close()
    # Pre-fix this came out as 2024-01-01 19:00 (previous day = look-ahead).
    assert out["datetime"].iloc[0] == pd.Timestamp("2024-01-02")


def test_stock_daily_bars_still_use_eastern_labels(tmp_path):
    provider = _provider(tmp_path)
    out = provider._normalize_polygon_results(
        _payload(MIDNIGHT_ET_MS), symbol="AAPL", timespan="day"
    )
    provider.close()
    assert out["datetime"].iloc[0] == pd.Timestamp("2024-01-02")


def test_crypto_minute_bars_still_use_eastern_labels(tmp_path):
    provider = _provider(tmp_path)
    out = provider._normalize_polygon_results(
        _payload(MIDNIGHT_UTC_MS), symbol="X:BTCUSD", timespan="minute"
    )
    provider.close()
    # 2024-01-02 00:00 UTC == 2024-01-01 19:00 Eastern; intraday keeps Eastern.
    assert out["datetime"].iloc[0] == pd.Timestamp("2024-01-01 19:00:00")


def test_purge_crypto_daily_runs_once(tmp_path):
    db_path = str(tmp_path / "cache.db")

    # Simulate a pre-fix cache: bar tables exist, cache_meta does not.
    conn = sqlite3.connect(db_path)
    conn.execute(
        "CREATE TABLE daily_bars (symbol TEXT NOT NULL, date TEXT NOT NULL, "
        "open REAL, high REAL, low REAL, close REAL, volume REAL, "
        "PRIMARY KEY (symbol, date))"
    )
    conn.execute(
        "CREATE TABLE fetch_log (symbol TEXT PRIMARY KEY, last_fetched TEXT, "
        "start_date TEXT, end_date TEXT, row_count INTEGER)"
    )
    conn.execute("INSERT INTO daily_bars VALUES ('X:BTCUSD', '2024-01-01', 1, 2, 0.5, 1.5, 100)")
    conn.execute("INSERT INTO daily_bars VALUES ('AAPL', '2024-01-02', 1, 2, 0.5, 1.5, 100)")
    conn.execute(
        "INSERT INTO fetch_log VALUES "
        "('X:BTCUSD', '2024-01-01T00:00:00', '2024-01-01', '2024-01-01', 1)"
    )
    conn.commit()
    conn.close()

    provider = _provider(tmp_path)
    rows = provider._get_conn().execute("SELECT symbol FROM daily_bars").fetchall()
    log_rows = provider._get_conn().execute("SELECT symbol FROM fetch_log").fetchall()
    assert rows == [("AAPL",)]
    assert log_rows == []

    # Marker prevents a second purge: crypto rows written post-fix survive.
    provider._get_conn().execute(
        "INSERT INTO daily_bars VALUES ('X:BTCUSD', '2024-01-02', 1, 2, 0.5, 1.5, 100)"
    )
    provider._get_conn().commit()
    provider.close()

    provider2 = _provider(tmp_path)
    rows = provider2._get_conn().execute(
        "SELECT symbol, date FROM daily_bars WHERE symbol = 'X:BTCUSD'"
    ).fetchall()
    provider2.close()
    assert rows == [("X:BTCUSD", "2024-01-02")]
