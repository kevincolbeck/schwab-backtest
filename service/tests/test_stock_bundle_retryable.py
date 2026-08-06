"""A starved stock lookup must never look like a missing ticker.

/stocks/{sym} feeds a page that 404s on found:false, and the sitemap advertises
those URLs. Finnhub's free tier gives us ~50 calls/minute; a crawler walking
the sitemap's stock section spends that in seconds, after which uncached
symbols get NO profile lookup at all. Before this, that starve returned the
same `found: false` as a delisted ticker, so the page called notFound() and
Next froze a 404 into the 6h ISR cache — 80 of 155 submitted URLs were serving
404 to Google off a single crawl.

The distinction these tests pin: only a COMPLETED lookup that came back empty
is evidence a ticker doesn't exist. Everything else is retryable.
"""

import sqlite3
from datetime import date, timedelta

import pytest

from service import markets


@pytest.fixture(autouse=True)
def fresh_state(monkeypatch, tmp_path):
    monkeypatch.setenv("BACKTEST_CACHE_DB", str(tmp_path / "cache.db"))
    monkeypatch.setattr(markets, "_profile_cache", {})
    monkeypatch.setattr(markets, "_company_news_cache", {})
    monkeypatch.setenv("FINNHUB_API_KEY", "test-key")
    # No bars for anything unless a test seeds them.
    monkeypatch.setattr(markets, "_read_bundle_bars", lambda symbol: [])
    monkeypatch.setattr(markets, "_next_earnings_for", lambda symbol: None)
    monkeypatch.setattr(markets, "_company_news", lambda symbol: [])
    yield


def test_spent_rate_budget_is_retryable_not_a_404(monkeypatch):
    """The exact crawl scenario: budget gone, so we never ask Finnhub."""
    monkeypatch.setattr(markets, "_rate_capacity", lambda: 0)

    def _boom(*a, **k):  # proves no outbound call happened
        raise AssertionError("must not call Finnhub with no budget")

    monkeypatch.setattr(markets, "_finnhub_get", _boom)

    out = markets.company_bundle("MCD")
    assert out["found"] is False
    assert out["retryable"] is True, "a spent budget must degrade, never 404"


def test_upstream_error_is_retryable(monkeypatch):
    monkeypatch.setattr(markets, "_rate_capacity", lambda: 50)
    monkeypatch.setattr(
        markets, "_finnhub_get", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("503"))
    )
    out = markets.company_bundle("MCD")
    assert out["found"] is False
    assert out["retryable"] is True


def test_failed_lookup_is_not_cached_as_a_miss(monkeypatch):
    """A 503 must not be laundered into 'ticker unknown' for the next hour."""
    monkeypatch.setattr(markets, "_rate_capacity", lambda: 50)
    monkeypatch.setattr(
        markets, "_finnhub_get", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("503"))
    )
    markets.company_bundle("MCD")
    assert "MCD" not in markets._profile_cache

    # Finnhub recovers; the very next request must see the real profile.
    monkeypatch.setattr(
        markets, "_finnhub_get", lambda *a, **k: {"ticker": "MCD", "name": "McDonald's Corp"}
    )
    out = markets.company_bundle("MCD")
    assert out["found"] is True
    assert out["profile"]["name"] == "McDonald's Corp"


def test_unknown_ticker_stays_a_hard_404(monkeypatch):
    """The other half of the contract — don't turn every 404 into a soft page."""
    monkeypatch.setattr(markets, "_rate_capacity", lambda: 50)
    monkeypatch.setattr(markets, "_finnhub_get", lambda *a, **k: {})  # answered: nothing
    out = markets.company_bundle("ZZZZQQ")
    assert out["found"] is False
    assert out["retryable"] is False


def test_malformed_ticker_stays_a_hard_404():
    out = markets.company_bundle("../etc/passwd")
    assert out["found"] is False
    assert out["retryable"] is False


def test_cached_bars_render_without_any_finnhub_call(monkeypatch):
    """Why the sitemap keys off bundle_ready_symbols(): bars alone are enough."""
    monkeypatch.setattr(markets, "_rate_capacity", lambda: 0)
    monkeypatch.setattr(
        markets, "_read_bundle_bars",
        lambda symbol: [{"time": "2026-08-05", "open": 1.0, "high": 1.0,
                         "low": 1.0, "close": 1.0, "volume": 10}],
    )
    out = markets.company_bundle("T")
    assert out["found"] is True
    assert out["profile"] is None  # no budget, and it didn't matter


def test_bundle_ready_symbols_lists_only_what_has_bars(monkeypatch, tmp_path):
    path = tmp_path / "cache.db"
    conn = sqlite3.connect(path)
    conn.execute(
        "CREATE TABLE daily_bars ("
        " symbol TEXT NOT NULL, date TEXT NOT NULL,"
        " open REAL, high REAL, low REAL, close REAL, volume REAL,"
        " PRIMARY KEY (symbol, date))"
    )
    recent = date.today().isoformat()
    stale = (date.today() - timedelta(days=365 * 40)).isoformat()
    conn.executemany(
        "INSERT INTO daily_bars VALUES (?,?,?,?,?,?,?)",
        [
            ("AAPL", recent, 1.0, 1.0, 1.0, 1.0, 1),
            ("MSFT", recent, 1.0, 1.0, 1.0, 1.0, 1),
            ("T", stale, 1.0, 1.0, 1.0, 1.0, 1),      # outside the bundle window
            ("NOTREAL", recent, 1.0, 1.0, 1.0, 1.0, 1),  # outside SECTORS
        ],
    )
    conn.commit()
    conn.close()
    monkeypatch.setenv("BACKTEST_CACHE_DB", str(path))

    ready = markets.bundle_ready_symbols()
    assert "AAPL" in ready and "MSFT" in ready
    assert "T" not in ready, "bars older than the bundle window don't render a chart"
    assert "NOTREAL" not in ready, "sitemap only advertises the curated universe"
    # Curated sector order is preserved so the sitemap stays stable run to run.
    assert ready.index("AAPL") < ready.index("MSFT")


def test_missing_cache_db_yields_no_stock_urls(monkeypatch, tmp_path):
    """Never advertise stock URLs we can't prove render."""
    monkeypatch.setenv("BACKTEST_CACHE_DB", str(tmp_path / "absent.db"))
    assert markets.bundle_ready_symbols() == []


def test_curated_ticker_never_404s_on_an_empty_vendor_profile(monkeypatch):
    """T, MCD, PG et al are in SECTORS — they are real companies by
    construction. Finnhub answering {} for one says something about our plan's
    coverage, never that the ticker stopped existing, so the page must degrade
    rather than 404 a URL we link from the markets heatmap."""
    monkeypatch.setattr(markets, "_rate_capacity", lambda: 50)
    monkeypatch.setattr(markets, "_finnhub_get", lambda *a, **k: {})  # answered: nothing
    assert "T" in markets._SECTOR_SYMBOLS
    out = markets.company_bundle("T")
    assert out["found"] is False
    assert out["retryable"] is True


def test_uncurated_unknown_ticker_still_404s(monkeypatch):
    monkeypatch.setattr(markets, "_rate_capacity", lambda: 50)
    monkeypatch.setattr(markets, "_finnhub_get", lambda *a, **k: {})
    assert "ZZZZQQ" not in markets._SECTOR_SYMBOLS
    assert markets.company_bundle("ZZZZQQ")["retryable"] is False
