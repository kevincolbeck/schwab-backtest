"""Markets surface: overview math from a stubbed cache DB + graceful calendars."""

import sqlite3
from datetime import date, timedelta

import pytest

from service import markets

D_PRIOR = (date.today() - timedelta(days=2)).isoformat()
D_LAST = (date.today() - timedelta(days=1)).isoformat()


@pytest.fixture(autouse=True)
def fresh_state(monkeypatch, tmp_path):
    """Isolated cache DB path + cleared in-memory caches for every test."""
    monkeypatch.setenv("BACKTEST_CACHE_DB", str(tmp_path / "cache.db"))
    monkeypatch.setattr(markets, "_overview_cache", {"expires": 0.0, "payload": None})
    monkeypatch.setattr(markets, "_calendar_cache", {"expires": 0.0, "payload": None})
    yield


def _seed_cache_db(path, rows):
    """rows: (symbol, date, close) tuples in the engine's daily_bars schema."""
    conn = sqlite3.connect(path)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS daily_bars ("
        " symbol TEXT NOT NULL, date TEXT NOT NULL,"
        " open REAL, high REAL, low REAL, close REAL, volume REAL,"
        " PRIMARY KEY (symbol, date))"
    )
    conn.executemany(
        "INSERT INTO daily_bars (symbol, date, close) VALUES (?, ?, ?)", rows
    )
    conn.commit()
    conn.close()


# ── overview() ───────────────────────────────────────────────────────────────

def test_overview_pct_change_and_sector_grouping(monkeypatch, tmp_path):
    monkeypatch.setattr(
        markets, "SECTORS", {"Tech": ["AAA", "BBB"], "Energy": ["CCC"]}
    )
    _seed_cache_db(tmp_path / "cache.db", [
        ("AAA", D_PRIOR, 100.0), ("AAA", D_LAST, 110.0),   # +10.00%
        ("BBB", D_PRIOR, 200.0), ("BBB", D_LAST, 190.0),   # -5.00%
        ("CCC", D_LAST, 50.0),                             # one close -> skipped
    ])
    out = markets.overview()

    assert out["as_of"] == D_LAST
    # CCC lacks a prior close, so Energy has no tiles and drops out entirely.
    assert [s["sector"] for s in out["sectors"]] == ["Tech"]
    tiles = {t["symbol"]: t for t in out["sectors"][0]["tiles"]}
    assert tiles["AAA"]["pct_change"] == 10.0
    assert tiles["AAA"]["close"] == 110.0
    assert tiles["BBB"]["pct_change"] == -5.0
    assert out["gainers"][0]["symbol"] == "AAA"
    assert out["gainers"][0]["sector"] == "Tech"
    assert out["losers"][0]["symbol"] == "BBB"


def test_overview_movers_ordering_and_cap(monkeypatch, tmp_path):
    symbols = [f"S{i:02d}" for i in range(12)]
    monkeypatch.setattr(markets, "SECTORS", {"Tech": symbols})
    rows = []
    for i, symbol in enumerate(symbols):  # pct_change = +0%, +1%, ... +11%
        rows += [(symbol, D_PRIOR, 100.0), (symbol, D_LAST, 100.0 + i)]
    _seed_cache_db(tmp_path / "cache.db", rows)
    out = markets.overview()

    gainer_pcts = [m["pct_change"] for m in out["gainers"]]
    loser_pcts = [m["pct_change"] for m in out["losers"]]
    assert len(out["gainers"]) == 10 and len(out["losers"]) == 10
    assert gainer_pcts == sorted(gainer_pcts, reverse=True)
    assert gainer_pcts[0] == 11.0
    assert loser_pcts == sorted(loser_pcts)
    assert loser_pcts[0] == 0.0


def test_overview_missing_cache_db_is_empty_graceful():
    out = markets.overview()  # env points at a path that was never created
    assert out == {"as_of": None, "sectors": [], "gainers": [], "losers": []}


def test_overview_served_from_memory_cache(monkeypatch, tmp_path):
    monkeypatch.setattr(markets, "SECTORS", {"Tech": ["AAA"]})
    _seed_cache_db(tmp_path / "cache.db", [
        ("AAA", D_PRIOR, 100.0), ("AAA", D_LAST, 110.0),
    ])
    first = markets.overview()

    def boom(_symbols):
        raise AssertionError("second call within TTL must not touch the DB")

    monkeypatch.setattr(markets, "_read_last_closes", boom)
    assert markets.overview() is first


# ── calendars() ──────────────────────────────────────────────────────────────

def test_calendars_unconfigured_is_graceful(monkeypatch):
    monkeypatch.delenv("FINNHUB_API_KEY", raising=False)
    assert markets.calendars() == {"earnings": [], "ipos": [], "configured": False}


def test_calendars_stubbed_fetch_and_memory_cache(monkeypatch):
    monkeypatch.setenv("FINNHUB_API_KEY", "test-key")
    calls = []

    def fake_fetch(key, start, end):
        calls.append((key, start, end))
        return ([{"symbol": "AAPL", "date": start, "epsEstimate": 1.5,
                  "epsActual": None, "revenueEstimate": 2e9, "hour": "amc"}],
                [{"symbol": "NEWCO", "name": "NewCo", "date": end,
                  "exchange": "NASDAQ", "price": "10-12", "status": "expected"}])

    monkeypatch.setattr(markets, "_fetch_week", fake_fetch)
    out = markets.calendars()
    assert out["configured"] is True
    assert out["earnings"][0]["symbol"] == "AAPL"
    assert out["ipos"][0]["symbol"] == "NEWCO"
    assert out["week_start"] <= out["week_end"]

    assert markets.calendars() is out  # 6h cache: no second fetch
    assert len(calls) == 1


def test_calendars_fetch_failure_never_errors(monkeypatch):
    monkeypatch.setenv("FINNHUB_API_KEY", "test-key")

    def broken(key, start, end):
        raise RuntimeError("finnhub down")

    monkeypatch.setattr(markets, "_fetch_week", broken)
    out = markets.calendars()
    assert out["configured"] is True
    assert out["earnings"] == [] and out["ipos"] == []


def test_trim_earnings_fields_sort_and_cap():
    rows = [
        {"symbol": f"S{i:03d}", "date": f"2026-08-{(i % 7) + 3:02d}",
         "epsEstimate": 1.0, "epsActual": 1.1, "revenueEstimate": 5e8,
         "hour": "bmo", "quarter": 2, "year": 2026}  # extra fields must drop
        for i in range(70)
    ] + [{"symbol": "", "date": "2026-08-04"}, {"date": "2026-08-04"}, "junk"]
    out = markets._trim_earnings({"earningsCalendar": rows})

    assert len(out) == markets.EARNINGS_CAP
    dates = [r["date"] for r in out]
    assert dates == sorted(dates)
    assert set(out[0]) == {"symbol", "date", "epsEstimate", "epsActual",
                           "revenueEstimate", "hour"}


def test_trim_ipos_requires_date_and_name_or_symbol():
    out = markets._trim_ipos({"ipoCalendar": [
        {"symbol": "BBB", "name": "Bee", "date": "2026-08-07", "exchange": "NYSE",
         "price": "15", "status": "priced", "numberOfShares": 1000},
        {"name": "NoTicker Co", "date": "2026-08-05"},
        {"symbol": "XXX"},          # no date -> dropped
        {"date": "2026-08-06"},     # no symbol/name -> dropped
    ]})
    assert [r["date"] for r in out] == ["2026-08-05", "2026-08-07"]
    assert set(out[0]) == {"symbol", "name", "date", "exchange", "price", "status"}
