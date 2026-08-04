"""Adapter growth: month calendars, profile enrichment, company bundle, news.

Everything outbound is stubbed at the module seam (_fetch_month/_finnhub_get/
_read_bundle_bars) — no network, no real cache DB. Mirrors test_markets.py's
graceful-degradation philosophy: a missing key or a Finnhub failure must never
error a page.
"""

from collections import deque
from datetime import date, timedelta
import time

import pytest
from fastapi.testclient import TestClient

from service import main, markets

TODAY = date.today()


@pytest.fixture(autouse=True)
def fresh_state(monkeypatch, tmp_path):
    """Isolated caches + a fake key (per-test delenv covers the no-key paths)."""
    monkeypatch.setenv("BACKTEST_CACHE_DB", str(tmp_path / "cache.db"))
    monkeypatch.setenv("FINNHUB_API_KEY", "test-key")
    monkeypatch.setattr(markets, "_month_cache", {})
    monkeypatch.setattr(markets, "_profile_cache", {})
    monkeypatch.setattr(markets, "_company_news_cache", {})
    monkeypatch.setattr(markets, "_news_cache", {"expires": 0.0, "payload": None})
    monkeypatch.setattr(markets, "_finnhub_calls", deque())
    yield


client = TestClient(main.app)


# ── calendar_month ───────────────────────────────────────────────────────────

def test_calendar_month_no_key_is_graceful(monkeypatch):
    monkeypatch.delenv("FINNHUB_API_KEY", raising=False)
    out = markets.calendar_month("earnings", 2026, 2)
    assert out == {
        "kind": "earnings", "year": 2026, "month": 2,
        "from": "2026-02-01", "to": "2026-02-28",
        "configured": False, "rows": [],
    }


def test_calendar_month_december_window(monkeypatch):
    monkeypatch.delenv("FINNHUB_API_KEY", raising=False)
    out = markets.calendar_month("ipo", 2026, 12)
    assert out["from"] == "2026-12-01" and out["to"] == "2026-12-31"


def test_calendar_month_cached_per_kind_and_month(monkeypatch):
    calls = []

    def fake_fetch(kind, key, start, end):
        calls.append((kind, start, end))
        return [{"symbol": "AAPL", "date": start, "epsEstimate": None,
                 "epsActual": None, "revenueEstimate": None, "hour": "amc"}]

    monkeypatch.setattr(markets, "_fetch_month", fake_fetch)
    first = markets.calendar_month("earnings", 2026, 8)
    assert first["configured"] is True
    assert first["rows"][0]["symbol"] == "AAPL"

    assert markets.calendar_month("earnings", 2026, 8) is first  # 6h cache hit
    assert len(calls) == 1
    markets.calendar_month("earnings", 2026, 9)   # different month -> fetch
    markets.calendar_month("ipo", 2026, 8)        # different kind -> fetch
    assert len(calls) == 3


def test_calendar_month_fetch_failure_never_errors(monkeypatch):
    def broken(kind, key, start, end):
        raise RuntimeError("finnhub down")

    monkeypatch.setattr(markets, "_fetch_month", broken)
    out = markets.calendar_month("earnings", 2026, 8)
    assert out["configured"] is True and out["rows"] == []


def test_trim_ipos_month_variant_includes_shares():
    payload = {"ipoCalendar": [
        {"symbol": "NEW", "name": "NewCo", "date": "2026-08-07",
         "exchange": "NASDAQ", "price": "10-12", "status": "expected",
         "numberOfShares": 5_000_000},
    ]}
    weekly = markets._trim_ipos(payload)
    monthly = markets._trim_ipos(payload, cap=markets.MONTH_IPO_CAP, with_shares=True)
    assert "numberOfShares" not in weekly[0]           # weekly payload stays stable
    assert monthly[0]["numberOfShares"] == 5_000_000


# ── day_enrichment (profiles) ────────────────────────────────────────────────

def _profile_stub(mcaps):
    calls = []

    def fake_get(client, path, key, params):
        assert path == "stock/profile2"
        sym = params["symbol"]
        calls.append(sym)
        if sym not in mcaps:
            return {}  # Finnhub's unknown-symbol shape
        return {"name": f"{sym} Inc", "ticker": sym, "logo": "",
                "marketCapitalization": mcaps[sym]}

    return fake_get, calls


def test_day_enrichment_fetches_once_then_serves_cache(monkeypatch):
    fake_get, calls = _profile_stub({"AAA": 10.0, "BBB": 300.0})
    monkeypatch.setattr(markets, "_finnhub_get", fake_get)

    out = markets.day_enrichment(["AAA", "BBB", "ZZZ"])
    assert out["AAA"] == {"name": "AAA Inc", "logo": None, "marketCapitalization": 10.0}
    assert out["BBB"]["marketCapitalization"] == 300.0
    assert out["ZZZ"] is None                       # missing -> graceful None
    assert sorted(calls) == ["AAA", "BBB", "ZZZ"]

    again = markets.day_enrichment(["AAA", "BBB", "ZZZ"])
    assert len(calls) == 3                          # 24h cache: zero new fetches
    assert again["AAA"] == out["AAA"]


def test_day_enrichment_respects_rate_budget(monkeypatch):
    fake_get, calls = _profile_stub({"AAA": 10.0})
    monkeypatch.setattr(markets, "_finnhub_get", fake_get)
    now = time.time()
    markets._finnhub_calls.extend([now] * markets.RATE_LIMIT_PER_MIN)

    out = markets.day_enrichment(["AAA"])
    assert out["AAA"] is None and calls == []       # budget spent -> no fetch

    markets._finnhub_calls.clear()                  # minute rolls over
    assert markets.day_enrichment(["AAA"])["AAA"]["name"] == "AAA Inc"


def test_day_enrichment_no_key_all_none(monkeypatch):
    monkeypatch.delenv("FINNHUB_API_KEY", raising=False)
    assert markets.day_enrichment(["AAA"]) == {"AAA": None}


# ── /markets/day endpoint ────────────────────────────────────────────────────

def test_markets_day_filters_enriches_and_sorts_by_mcap(monkeypatch):
    day = "2026-08-05"

    def fake_fetch(kind, key, start, end):
        return [
            {"symbol": "AAA", "date": day, "epsEstimate": 1.0, "epsActual": None,
             "revenueEstimate": None, "hour": "bmo"},
            {"symbol": "BBB", "date": day, "epsEstimate": 2.0, "epsActual": None,
             "revenueEstimate": None, "hour": "amc"},
            {"symbol": "CCC", "date": day, "epsEstimate": None, "epsActual": None,
             "revenueEstimate": None, "hour": "dmh"},
            {"symbol": "DDD", "date": "2026-08-06", "epsEstimate": None,
             "epsActual": None, "revenueEstimate": None, "hour": "bmo"},
        ]

    monkeypatch.setattr(markets, "_fetch_month", fake_fetch)
    monkeypatch.setattr(markets, "day_enrichment", lambda syms: {
        "AAA": {"name": "A", "logo": None, "marketCapitalization": 10.0},
        "BBB": {"name": "B", "logo": None, "marketCapitalization": 300.0},
        "CCC": None,
    })

    resp = client.get("/markets/day", params={"date": day, "kind": "earnings"})
    assert resp.status_code == 200
    out = resp.json()
    assert out["configured"] is True
    assert [r["symbol"] for r in out["rows"]] == ["BBB", "AAA", "CCC"]  # mcap desc
    assert out["rows"][0]["profile"]["name"] == "B"
    assert out["rows"][2]["profile"] is None
    assert "disclaimer" in out


def test_markets_day_validates_inputs():
    assert client.get("/markets/day", params={"date": "not-a-date"}).status_code == 422
    assert client.get(
        "/markets/day", params={"date": "2026-08-05", "kind": "bogus"}
    ).status_code == 422


def test_markets_calendar_month_endpoint_validates_kind():
    assert client.get("/markets/calendar-month", params={"kind": "bogus"}).status_code == 422


def test_markets_calendar_month_endpoint_no_key(monkeypatch):
    monkeypatch.delenv("FINNHUB_API_KEY", raising=False)
    resp = client.get(
        "/markets/calendar-month",
        params={"kind": "earnings", "year": 2026, "month": 8},
    )
    assert resp.status_code == 200
    out = resp.json()
    assert out["configured"] is False and out["rows"] == []
    assert "disclaimer" in out


# ── /stocks/{ticker} (company bundle) ────────────────────────────────────────

def test_stocks_unknown_ticker_found_false(monkeypatch):
    monkeypatch.delenv("FINNHUB_API_KEY", raising=False)
    monkeypatch.setattr(markets, "_read_bundle_bars", lambda symbol: [])
    resp = client.get("/stocks/ZZZQ")
    assert resp.status_code == 200
    out = resp.json()
    assert out["found"] is False and out["symbol"] == "ZZZQ"
    assert "disclaimer" in out


def test_stocks_invalid_ticker_found_false_without_lookups(monkeypatch):
    def boom(*a, **k):
        raise AssertionError("invalid tickers must not reach any lookup")

    monkeypatch.setattr(markets, "_get_profiles", boom)
    monkeypatch.setattr(markets, "_read_bundle_bars", boom)
    assert markets.company_bundle("not a ticker!")["found"] is False


def test_stocks_found_from_bars_only_computes_stats(monkeypatch):
    monkeypatch.delenv("FINNHUB_API_KEY", raising=False)  # no profile, no news
    d0 = (TODAY - timedelta(days=3)).isoformat()
    d1 = (TODAY - timedelta(days=2)).isoformat()
    bars = [
        {"time": d0, "open": 99.0, "high": 111.0, "low": 95.0, "close": 100.0,
         "volume": 1000.0},
        {"time": d1, "open": 100.0, "high": 105.0, "low": 90.0, "close": 104.0,
         "volume": 3000.0},
    ]
    monkeypatch.setattr(markets, "_read_bundle_bars", lambda symbol: list(bars))

    out = markets.company_bundle("aapl")
    assert out["found"] is True and out["symbol"] == "AAPL"
    assert out["profile"] is None and out["news"] == []
    assert out["stats"] == {
        "last_close": 104.0, "as_of": d1,
        "high_52w": 111.0, "low_52w": 90.0, "avg_volume": 2000.0,
    }


def test_stocks_full_bundle_profile_news_next_earnings(monkeypatch):
    def fake_get(client_, path, key, params):
        if path == "stock/profile2":
            return {"name": "Apple Inc", "ticker": "AAPL", "logo": "http://x/l.png",
                    "marketCapitalization": 3.4e6, "finnhubIndustry": "Technology",
                    "weburl": "https://apple.com"}
        if path == "company-news":
            return [{"headline": f"h{i}", "url": f"u{i}", "source": "s",
                     "datetime": i, "image": "", "related": "AAPL"}
                    for i in range(20)]
        raise AssertionError(f"unexpected finnhub path {path}")

    def fake_fetch(kind, key, start, end):
        return [{"symbol": "AAPL", "date": TODAY.isoformat(), "epsEstimate": None,
                 "epsActual": None, "revenueEstimate": None, "hour": "amc"}]

    monkeypatch.setattr(markets, "_finnhub_get", fake_get)
    monkeypatch.setattr(markets, "_fetch_month", fake_fetch)
    monkeypatch.setattr(markets, "_read_bundle_bars", lambda symbol: [])

    out = markets.company_bundle("AAPL")
    assert out["found"] is True
    assert out["profile"]["industry"] == "Technology"
    assert out["profile"]["website"] == "https://apple.com"
    assert out["next_earnings"] == {"date": TODAY.isoformat(), "hour": "amc"}
    assert len(out["news"]) == markets.COMPANY_NEWS_CAP  # capped at 12
    assert set(out["news"][0]) == {"headline", "image", "source", "datetime",
                                   "url", "related"}


# ── market_news ──────────────────────────────────────────────────────────────

def test_market_news_caps_trims_and_caches(monkeypatch):
    calls = []

    def fake_get(client_, path, key, params):
        assert path == "news" and params == {"category": "general"}
        calls.append(path)
        return [{"headline": f"h{i}", "url": f"u{i}", "source": "s",
                 "datetime": i, "image": "", "related": ""} for i in range(25)] + [
                {"headline": "", "url": "drop-me"}, "junk"]

    monkeypatch.setattr(markets, "_finnhub_get", fake_get)
    out = markets.market_news()
    assert out["configured"] is True
    assert len(out["articles"]) == markets.MARKET_NEWS_CAP  # capped at 18
    assert set(out["articles"][0]) == {"headline", "image", "source", "datetime",
                                       "url", "related"}
    assert markets.market_news() is out  # 10 min cache
    assert len(calls) == 1


def test_market_news_no_key_and_failure_graceful(monkeypatch):
    monkeypatch.delenv("FINNHUB_API_KEY", raising=False)
    assert markets.market_news() == {"configured": False, "articles": []}

    monkeypatch.setenv("FINNHUB_API_KEY", "test-key")

    def broken(*a, **k):
        raise RuntimeError("finnhub down")

    monkeypatch.setattr(markets, "_finnhub_get", broken)
    out = markets.market_news()
    assert out == {"configured": True, "articles": []}

    resp = client.get("/markets/news")
    assert resp.status_code == 200 and "disclaimer" in resp.json()
