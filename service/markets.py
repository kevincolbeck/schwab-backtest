"""Public markets snapshot for the marketing site — settled closes, no flicker.

overview():   sector heatmap tiles + top-10 movers computed from the LAST TWO
              settled closes per symbol in the local daily-bars cache. One bulk
              SQL read over a fixed ~100-name liquid universe (the cache holds
              5k+ symbols — never scan it all). Cache-only by design: this
              module NEVER fetches outbound market data; a cold or missing
              cache degrades to an empty payload, never an error.
calendars():  this week's earnings + IPO calendars from Finnhub (free tier),
              trimmed to exactly the fields the page shows. A missing
              FINNHUB_API_KEY degrades to {configured: false} — the page must
              render regardless.
calendar_month(kind, year, month): a full month of the earnings or IPO
              calendar, cached per (kind, month) for 6 h.
day_enrichment(symbols): on-demand company profiles (name/logo/mcap) with a
              24 h in-memory cache and a per-minute rate budget — fetched only
              when a day panel opens, never speculatively.
company_bundle(ticker): everything the informational stock page needs —
              profile, OUR OWN cached daily bars (up to 5 y), 52w stats, next
              earnings date, recent company news. Unknown ticker → found:false.
market_news(): general market headlines, 10 min cache.

All payloads are cached in-memory. Every Finnhub path degrades gracefully:
missing key → configured:false, upstream failure → empty rows briefly cached.
This is an EOD research surface, not a live data product — intraday flicker
is a non-goal on purpose.
"""

import logging
import math
import os
import re
import sqlite3
import threading
import time
from collections import deque
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import httpx

from service import env  # noqa: F401  (loads .env)

logger = logging.getLogger(__name__)

OVERVIEW_TTL = 30 * 60.0
CALENDAR_TTL = 6 * 60 * 60.0
FAILURE_TTL = 60.0  # empty/failed payloads cache briefly so retries stay cheap
EARNINGS_CAP = 60
IPO_CAP = 30
LOOKBACK_DAYS = 30  # bound the bulk read; two closes is all the math needs

MONTH_TTL = CALENDAR_TTL  # per-(kind, month) calendar cache
MONTH_CACHE_MAX = 24      # bound the month cache (kinds × ~a year of browsing)
MONTH_EARNINGS_CAP = 500
MONTH_IPO_CAP = 100
PROFILE_TTL = 24 * 60 * 60.0   # profiles barely change — long cache on purpose
PROFILE_MISS_TTL = 60 * 60.0   # unknown symbols retry hourly, not per request
PROFILE_CACHE_MAX = 4000
PROFILE_BATCH_MAX = 40         # per-call fetch bound inside the rate budget
NEWS_TTL = 10 * 60.0
COMPANY_NEWS_TTL = 30 * 60.0
COMPANY_NEWS_DAYS = 14
MARKET_NEWS_CAP = 18
COMPANY_NEWS_CAP = 12
COMPANY_NEWS_CACHE_MAX = 200
BUNDLE_BARS_YEARS = 5
RATE_LIMIT_PER_MIN = 50  # headroom under Finnhub's ~60 req/min free tier

# Stocks/ETFs only (AAPL, BRK.B) — the stock page is a US-equity surface.
_TICKER_RE = re.compile(r"^[A-Z][A-Z0-9.\-]{0,9}$")

# Fixed liquid universe (S&P-100-ish + majors) with sector labels. Static on
# purpose: the heatmap is a marketing surface, not a screener — a hand-picked
# set of household names keeps the read bounded and the page recognizable.
SECTORS: Dict[str, List[str]] = {
    "Tech": [
        "AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "CRM", "AMD", "ADBE", "CSCO",
        "ACN", "INTC", "IBM", "QCOM", "TXN", "NOW", "INTU", "PLTR", "PANW",
    ],
    "Comms": ["GOOGL", "META", "NFLX", "DIS", "TMUS", "VZ", "T", "CMCSA"],
    "Consumer": [
        "AMZN", "TSLA", "HD", "MCD", "NKE", "SBUX", "LOW", "BKNG", "TJX",
        "F", "ABNB",
    ],
    "Financials": [
        "JPM", "V", "MA", "BAC", "WFC", "GS", "MS", "SCHW", "AXP", "C",
        "BLK", "SPGI", "BX", "KKR",
    ],
    "Health": [
        "LLY", "UNH", "JNJ", "ABBV", "MRK", "TMO", "ABT", "AMGN", "PFE",
        "ISRG", "DHR", "VRTX", "BMY", "GILD", "MDT",
    ],
    "Energy": ["XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "OXY"],
    "Industrial": [
        "CAT", "GE", "HON", "UNP", "BA", "DE", "LMT", "RTX", "UPS", "ETN",
        "ADP", "EMR",
    ],
    "Staples": [
        "PG", "KO", "PEP", "COST", "WMT", "PM", "MO", "CL", "KMB", "MDLZ",
        "TGT",
    ],
    "Materials": ["LIN", "SHW", "APD", "FCX", "NEM"],
    "Utilities": ["NEE", "DUK", "SO", "CEG", "AEP"],
    "RE": ["PLD", "AMT", "EQIX", "SPG", "O"],
}

_overview_cache: dict = {"expires": 0.0, "payload": None}
_calendar_cache: dict = {"expires": 0.0, "payload": None}
_month_cache: Dict[Tuple[str, int, int], dict] = {}
_profile_cache: Dict[str, dict] = {}
_company_news_cache: Dict[str, dict] = {}
_news_cache: dict = {"expires": 0.0, "payload": None}
_finnhub_calls: deque = deque()  # timestamps of outbound calls (rate budget)
_lock = threading.Lock()


def _finnhub_key() -> str:
    return os.getenv("FINNHUB_API_KEY", "").strip()


def _rate_capacity() -> int:
    """How many Finnhub calls the free-tier budget still allows this minute."""
    now = time.time()
    with _lock:
        while _finnhub_calls and now - _finnhub_calls[0] > 60.0:
            _finnhub_calls.popleft()
        return RATE_LIMIT_PER_MIN - len(_finnhub_calls)


def _note_finnhub_call() -> None:
    with _lock:
        _finnhub_calls.append(time.time())


# ── Overview (cache-only heatmap + movers) ───────────────────────────────────

def _cache_db_path() -> str:
    return os.getenv("BACKTEST_CACHE_DB", "backtest_data.db")


def _read_last_closes(symbols: List[str]) -> Dict[str, Tuple[str, float, float]]:
    """symbol -> (last_date, prior_close, last_close) via ONE bulk query.

    Reads straight from the engine's daily_bars cache (PK symbol+date, so the
    IN + date-floor scan stays on the index). Symbols with fewer than two
    cached closes in the window are simply absent from the result.
    """
    path = _cache_db_path()
    if not symbols or not Path(path).exists():
        return {}
    floor = (datetime.now() - timedelta(days=LOOKBACK_DAYS)).strftime("%Y-%m-%d")
    placeholders = ",".join("?" for _ in symbols)
    conn = sqlite3.connect(path, timeout=30)
    try:
        rows = conn.execute(
            f"SELECT symbol, date, close FROM daily_bars "
            f"WHERE symbol IN ({placeholders}) AND date >= ? AND close IS NOT NULL "
            f"ORDER BY symbol, date",
            (*symbols, floor),
        ).fetchall()
    finally:
        conn.close()

    bars: Dict[str, List[Tuple[str, float]]] = {}
    for symbol, bar_date, close in rows:
        bars.setdefault(str(symbol), []).append((str(bar_date), float(close)))
    out: Dict[str, Tuple[str, float, float]] = {}
    for symbol, series in bars.items():
        if len(series) < 2:
            continue
        (_, prior), (last_date, last) = series[-2], series[-1]
        if prior <= 0:
            continue
        out[symbol] = (last_date, prior, last)
    return out


def _build_overview(closes: Dict[str, Tuple[str, float, float]]) -> dict:
    """Pure math: closes -> sector tile groups + top-10 gainers/losers."""
    sectors: List[dict] = []
    movers: List[dict] = []
    as_of: Optional[str] = None
    for sector, symbols in SECTORS.items():
        tiles: List[dict] = []
        for symbol in symbols:
            got = closes.get(symbol)
            if got is None:
                continue
            last_date, prior, last = got
            pct = round((last - prior) / prior * 100.0, 2)
            tiles.append({"symbol": symbol, "close": round(last, 2), "pct_change": pct})
            movers.append({"symbol": symbol, "sector": sector,
                           "close": round(last, 2), "pct_change": pct})
            if as_of is None or last_date > as_of:
                as_of = last_date
        if tiles:  # sectors with no cached names drop out instead of rendering bare
            sectors.append({"sector": sector, "tiles": tiles})
    ranked = sorted(movers, key=lambda t: t["pct_change"], reverse=True)
    return {
        "as_of": as_of,
        "sectors": sectors,
        "gainers": ranked[:10],
        "losers": list(reversed(ranked))[:10],
    }


def overview() -> dict:
    """Heatmap + movers payload, served from a 30-minute in-memory cache."""
    now = time.time()
    with _lock:
        if _overview_cache["payload"] is not None and _overview_cache["expires"] > now:
            return _overview_cache["payload"]
    try:
        universe = [s for symbols in SECTORS.values() for s in symbols]
        payload = _build_overview(_read_last_closes(universe))
    except Exception:
        logger.warning("markets overview unavailable", exc_info=True)
        payload = {"as_of": None, "sectors": [], "gainers": [], "losers": []}
    # Empty payloads (cold cache, bad path) cache briefly so the page recovers
    # right after the data cache warms instead of staying blank for 30 minutes.
    ttl = OVERVIEW_TTL if payload["sectors"] else FAILURE_TTL
    with _lock:
        _overview_cache["payload"] = payload
        _overview_cache["expires"] = time.time() + ttl
    return payload


# ── Calendars (Finnhub, this week's window) ──────────────────────────────────

def _week_window(today: Optional[date] = None) -> Tuple[str, str]:
    """Monday..Sunday of the current week, ISO dates."""
    today = today or date.today()
    monday = today - timedelta(days=today.weekday())
    return monday.isoformat(), (monday + timedelta(days=6)).isoformat()


def _trim_earnings(payload: dict, cap: int = EARNINGS_CAP) -> List[dict]:
    """Keep exactly the fields the page shows; sort by date; cap the rows."""
    rows = payload.get("earningsCalendar") or []
    out = []
    for row in rows:
        if not isinstance(row, dict) or not row.get("symbol") or not row.get("date"):
            continue
        out.append({
            "symbol": row["symbol"],
            "date": row["date"],
            "epsEstimate": row.get("epsEstimate"),
            "epsActual": row.get("epsActual"),
            "revenueEstimate": row.get("revenueEstimate"),
            "hour": row.get("hour"),
        })
    out.sort(key=lambda r: (r["date"], r["symbol"]))
    return out[:cap]


def _trim_ipos(payload: dict, cap: int = IPO_CAP, with_shares: bool = False) -> List[dict]:
    rows = payload.get("ipoCalendar") or []
    out = []
    for row in rows:
        if not isinstance(row, dict) or not row.get("date"):
            continue
        if not row.get("symbol") and not row.get("name"):
            continue
        trimmed = {
            "symbol": row.get("symbol"),
            "name": row.get("name"),
            "date": row["date"],
            "exchange": row.get("exchange"),
            "price": row.get("price"),
            "status": row.get("status"),
        }
        if with_shares:  # month calendar only — the weekly payload stays stable
            trimmed["numberOfShares"] = row.get("numberOfShares")
        out.append(trimmed)
    out.sort(key=lambda r: r["date"])
    return out[:cap]


def _fetch_week(key: str, start: str, end: str) -> Tuple[List[dict], List[dict]]:
    """The only outbound call in this module (tests stub it out)."""
    with httpx.Client(timeout=10) as client:
        earnings = _trim_earnings(_finnhub_json(client, "calendar/earnings", key, start, end))
        ipos = _trim_ipos(_finnhub_json(client, "calendar/ipo", key, start, end))
    return earnings, ipos


def _finnhub_get(client: httpx.Client, path: str, key: str, params: dict):
    """Single Finnhub GET; every outbound call is counted for the rate budget."""
    _note_finnhub_call()
    resp = client.get(
        f"https://finnhub.io/api/v1/{path}", params={**params, "token": key}
    )
    resp.raise_for_status()
    return resp.json()


def _finnhub_json(client: httpx.Client, path: str, key: str, start: str, end: str) -> dict:
    data = _finnhub_get(client, path, key, {"from": start, "to": end})
    return data if isinstance(data, dict) else {}


def calendars() -> dict:
    """This week's earnings + IPOs, 6-hour cache. NEVER errors the page:
    missing key -> configured=false; Finnhub down -> empty lists, brief cache."""
    key = os.getenv("FINNHUB_API_KEY", "").strip()
    if not key:
        return {"earnings": [], "ipos": [], "configured": False}
    now = time.time()
    with _lock:
        if _calendar_cache["payload"] is not None and _calendar_cache["expires"] > now:
            return _calendar_cache["payload"]
    start, end = _week_window()
    try:
        earnings, ipos = _fetch_week(key, start, end)
        ttl = CALENDAR_TTL
    except Exception:
        logger.warning("finnhub calendars unavailable", exc_info=True)
        earnings, ipos, ttl = [], [], FAILURE_TTL
    payload = {
        "earnings": earnings,
        "ipos": ipos,
        "configured": True,
        "week_start": start,
        "week_end": end,
    }
    with _lock:
        _calendar_cache["payload"] = payload
        _calendar_cache["expires"] = time.time() + ttl
    return payload


# ── Month calendars (Finnhub, cached per (kind, month)) ──────────────────────

def _month_window(year: int, month: int) -> Tuple[str, str]:
    first = date(year, month, 1)
    if month == 12:
        last = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        last = date(year, month + 1, 1) - timedelta(days=1)
    return first.isoformat(), last.isoformat()


def _fetch_month(kind: str, key: str, start: str, end: str) -> List[dict]:
    """The month calendars' only outbound call (tests stub it out)."""
    path = "calendar/ipo" if kind == "ipo" else "calendar/earnings"
    with httpx.Client(timeout=10) as client:
        payload = _finnhub_json(client, path, key, start, end)
    if kind == "ipo":
        return _trim_ipos(payload, cap=MONTH_IPO_CAP, with_shares=True)
    return _trim_earnings(payload, cap=MONTH_EARNINGS_CAP)


def calendar_month(kind: str, year: int, month: int) -> dict:
    """One full month of the earnings or IPO calendar, 6h cache per (kind, month).
    NEVER errors: missing key -> configured=false; Finnhub down -> empty rows."""
    kind = "ipo" if str(kind).strip().lower() == "ipo" else "earnings"
    start, end = _month_window(year, month)
    base = {"kind": kind, "year": year, "month": month, "from": start, "to": end}
    key = _finnhub_key()
    if not key:
        return {**base, "configured": False, "rows": []}
    cache_key = (kind, year, month)
    now = time.time()
    with _lock:
        entry = _month_cache.get(cache_key)
        if entry is not None and entry["expires"] > now:
            return entry["payload"]
    try:
        rows = _fetch_month(kind, key, start, end)
        ttl = MONTH_TTL
    except Exception:
        logger.warning("finnhub %s month calendar unavailable", kind, exc_info=True)
        rows, ttl = [], FAILURE_TTL
    payload = {**base, "configured": True, "rows": rows}
    with _lock:
        _month_cache.pop(cache_key, None)
        _month_cache[cache_key] = {"expires": time.time() + ttl, "payload": payload}
        while len(_month_cache) > MONTH_CACHE_MAX:  # insertion-ordered: oldest out
            _month_cache.pop(next(iter(_month_cache)))
    return payload


# ── Company profiles (on-demand, long cache, rate-budgeted) ──────────────────

def _get_profiles(
    symbols: List[str], status_out: Optional[Dict[str, str]] = None
) -> Dict[str, Optional[dict]]:
    """symbol -> full profile dict (or None). Cache-first; fetches are bounded
    by the per-minute rate budget — over budget, uncached symbols stay None
    (and stay uncached, so a later panel open retries).

    `status_out`, when supplied, records WHY each symbol is None:

      "ok"          we have a profile
      "unknown"     Finnhub answered and does not know this ticker
      "unavailable" the call failed
      "starved"     we never asked — no API key, or the rate budget was spent

    Callers that turn "no data" into an HTTP status MUST read this. A None
    profile alone cannot tell a delisted ticker from a rate-limited minute, and
    a crawler walking 100+ stock pages spends the whole budget in seconds —
    which is how a transient starve became a hard 404 cached for six hours on
    URLs the sitemap advertises."""
    unique = list(dict.fromkeys(
        str(s).strip().upper() for s in symbols if str(s).strip()
    ))
    out: Dict[str, Optional[dict]] = {s: None for s in unique}
    status: Dict[str, str] = status_out if status_out is not None else {}
    key = _finnhub_key()
    now = time.time()
    to_fetch: List[str] = []
    with _lock:
        for sym in unique:
            entry = _profile_cache.get(sym)
            if entry is not None and entry["expires"] > now:
                out[sym] = entry["profile"]
                # A cached None is a cached MISS — Finnhub answered "unknown"
                # and we're honouring PROFILE_MISS_TTL rather than re-asking.
                status[sym] = "ok" if entry["profile"] is not None else "unknown"
            else:
                to_fetch.append(sym)
                status[sym] = "starved"
    if not key or not to_fetch:
        return out
    budget = min(len(to_fetch), PROFILE_BATCH_MAX, max(0, _rate_capacity()))
    if budget <= 0:
        return out
    try:
        with httpx.Client(timeout=10) as client:
            for sym in to_fetch[:budget]:
                profile = None
                try:
                    data = _finnhub_get(client, "stock/profile2", key, {"symbol": sym})
                    if isinstance(data, dict) and (data.get("name") or data.get("ticker")):
                        profile = {
                            "name": data.get("name"),
                            "logo": data.get("logo") or None,
                            "marketCapitalization": data.get("marketCapitalization"),
                            "industry": data.get("finnhubIndustry"),
                            "website": data.get("weburl"),
                            "description": data.get("description"),
                        }
                    status[sym] = "ok" if profile is not None else "unknown"
                except Exception:
                    logger.warning("finnhub profile unavailable for %s", sym, exc_info=True)
                    status[sym] = "unavailable"
                if status[sym] != "unavailable":
                    # Only cache an ANSWER. Caching a failed call as a miss
                    # would launder "Finnhub was down" into "ticker unknown"
                    # for the next hour, and callers key HTTP status off that.
                    ttl = PROFILE_TTL if profile is not None else PROFILE_MISS_TTL
                    with _lock:
                        _profile_cache.pop(sym, None)
                        _profile_cache[sym] = {"expires": time.time() + ttl, "profile": profile}
                        while len(_profile_cache) > PROFILE_CACHE_MAX:
                            _profile_cache.pop(next(iter(_profile_cache)))
                out[sym] = profile
    except Exception:
        logger.warning("finnhub profile batch failed", exc_info=True)
    return out


def day_enrichment(symbols: List[str]) -> Dict[str, Optional[dict]]:
    """symbol -> {name, logo, marketCapitalization} or None. Fetched ONLY on
    demand (a day panel opening), long-cached, rate-budgeted."""
    projected: Dict[str, Optional[dict]] = {}
    for sym, profile in _get_profiles(symbols).items():
        if profile is None:
            projected[sym] = None
        else:
            projected[sym] = {
                "name": profile.get("name"),
                "logo": profile.get("logo"),
                "marketCapitalization": profile.get("marketCapitalization"),
            }
    return projected


# ── Company bundle (stock page: profile + our bars + earnings + news) ────────

def _num(value, digits: Optional[int] = None):
    """JSON-safe number: None/NaN/inf -> None; optional rounding."""
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(f):
        return None
    return round(f, digits) if digits is not None else f


def _read_bundle_bars(symbol: str) -> List[dict]:
    """Up to 5y of OUR OWN cached daily OHLCV (read-only, never outbound)."""
    from service import backtest_runner  # lazy: engine deps load only on demand

    end = date.today().isoformat()
    start = (date.today() - timedelta(days=365 * BUNDLE_BARS_YEARS)).isoformat()
    provider = backtest_runner.HistoricalDataProvider()
    try:
        frame = provider.read_cached_daily(symbol, start, end)
    finally:
        provider.close()
    if frame is None or getattr(frame, "empty", True):
        return []
    out = []
    for row in frame.itertuples():
        close = _num(row.close, 4)
        if close is None:
            continue
        out.append({
            "time": str(row.datetime)[:10],
            "open": _num(row.open, 4),
            "high": _num(row.high, 4),
            "low": _num(row.low, 4),
            "close": close,
            "volume": _num(row.volume),
        })
    return out


def bundle_ready_symbols() -> List[str]:
    """The SECTORS symbols whose stock page is guaranteed to render — i.e. we
    hold cached daily bars for them inside the bundle window.

    This is what the sitemap must advertise. Cached bars alone make
    company_bundle() return found:true with no Finnhub call in the path, so
    these pages survive an exhausted rate budget, an expired key, and a Finnhub
    outage. Symbols we only ever had a *profile* for render fine when the
    budget allows and go noindex-degraded when it doesn't — real pages, but not
    ones to put in front of a crawler as permanent URLs.

    One indexed query against the engine cache; no network."""
    universe = list(dict.fromkeys(s for syms in SECTORS.values() for s in syms))
    path = _cache_db_path()
    if not universe or not Path(path).exists():
        return []
    floor = (date.today() - timedelta(days=365 * BUNDLE_BARS_YEARS)).isoformat()
    placeholders = ",".join("?" for _ in universe)
    conn = sqlite3.connect(path, timeout=30)
    try:
        rows = conn.execute(
            f"SELECT DISTINCT symbol FROM daily_bars "
            f"WHERE symbol IN ({placeholders}) AND date >= ? AND close IS NOT NULL",
            (*universe, floor),
        ).fetchall()
    except Exception:
        logger.warning("bundle-ready symbol scan failed", exc_info=True)
        return []
    finally:
        conn.close()
    ready = {str(r[0]).upper() for r in rows}
    return [s for s in universe if s in ready]  # keep the curated sector order


def _bundle_stats(bars: List[dict]) -> Optional[dict]:
    """52w high/low + average volume, computed from our own bars."""
    if not bars:
        return None
    year_floor = (date.today() - timedelta(days=365)).isoformat()
    window = [b for b in bars if b["time"] >= year_floor] or bars[-252:]
    highs = [b["high"] if b["high"] is not None else b["close"] for b in window]
    lows = [b["low"] if b["low"] is not None else b["close"] for b in window]
    volumes = [b["volume"] for b in window if b["volume"]]
    last = bars[-1]
    return {
        "last_close": last["close"],
        "as_of": last["time"],
        "high_52w": _num(max(highs), 4) if highs else None,
        "low_52w": _num(min(lows), 4) if lows else None,
        "avg_volume": _num(round(sum(volumes) / len(volumes))) if volumes else None,
    }


def _next_earnings_for(symbol: str) -> Optional[dict]:
    """Scan the cached current+next month earnings calendars for the symbol."""
    today = date.today()
    year, month = today.year, today.month
    nxt = (year + 1, 1) if month == 12 else (year, month + 1)
    best: Optional[dict] = None
    for y, m in ((year, month), nxt):
        try:
            payload = calendar_month("earnings", y, m)
        except Exception:  # calendar_month never raises, but belt-and-braces
            continue
        for row in payload.get("rows", []):
            row_date = row.get("date") or ""
            if row.get("symbol") != symbol or row_date < today.isoformat():
                continue
            if best is None or row_date < best["date"]:
                best = {"date": row_date, "hour": row.get("hour")}
    return best


def _trim_news(data, cap: int) -> List[dict]:
    rows = data if isinstance(data, list) else []
    out = []
    for row in rows:
        if not isinstance(row, dict) or not row.get("headline") or not row.get("url"):
            continue
        out.append({
            "headline": row["headline"],
            "image": row.get("image") or None,
            "source": row.get("source"),
            "datetime": row.get("datetime"),
            "url": row["url"],
            "related": row.get("related"),
        })
        if len(out) >= cap:
            break
    return out


def _company_news(symbol: str) -> List[dict]:
    """Last 14 days of company news, cap 12, 30 min cache. Failure -> []."""
    key = _finnhub_key()
    if not key:
        return []
    now = time.time()
    with _lock:
        entry = _company_news_cache.get(symbol)
        if entry is not None and entry["expires"] > now:
            return entry["articles"]
    articles: List[dict] = []
    ttl = FAILURE_TTL
    try:
        end = date.today().isoformat()
        start = (date.today() - timedelta(days=COMPANY_NEWS_DAYS)).isoformat()
        with httpx.Client(timeout=10) as client:
            data = _finnhub_get(
                client, "company-news", key,
                {"symbol": symbol, "from": start, "to": end},
            )
        articles = _trim_news(data, COMPANY_NEWS_CAP)
        ttl = COMPANY_NEWS_TTL
    except Exception:
        logger.warning("finnhub company news unavailable for %s", symbol, exc_info=True)
    with _lock:
        _company_news_cache.pop(symbol, None)
        _company_news_cache[symbol] = {"expires": time.time() + ttl, "articles": articles}
        while len(_company_news_cache) > COMPANY_NEWS_CACHE_MAX:
            _company_news_cache.pop(next(iter(_company_news_cache)))
    return articles


def company_bundle(ticker: str) -> dict:
    """Everything the informational stock page needs. Unknown ticker returns
    {found: false} — this function NEVER raises (page must render regardless)."""
    symbol = str(ticker or "").strip().upper()
    configured = bool(_finnhub_key())
    if not symbol or not _TICKER_RE.match(symbol):
        # Malformed ticker — nothing transient about it.
        return {"found": False, "retryable": False, "symbol": symbol,
                "configured": configured}
    status: Dict[str, str] = {}
    bars_failed = False
    try:
        profile = _get_profiles([symbol], status_out=status).get(symbol)
    except Exception:
        logger.warning("profile lookup failed for %s", symbol, exc_info=True)
        profile = None
        status[symbol] = "unavailable"
    try:
        bars = _read_bundle_bars(symbol)
    except Exception:
        logger.warning("cached bars unavailable for %s", symbol, exc_info=True)
        bars = []
        bars_failed = True
    if profile is None and not bars:
        # We have nothing to show — but WHY decides the caller's HTTP status.
        # Only a completed lookup that came back empty is evidence the ticker
        # doesn't exist; a starved rate budget or a failed call is a "come back
        # later", and answering 404 to that gets a real URL deindexed.
        retryable = bars_failed or status.get(symbol) in ("starved", "unavailable")
        return {"found": False, "retryable": retryable, "symbol": symbol,
                "configured": configured}
    try:
        next_earnings = _next_earnings_for(symbol)
    except Exception:
        logger.warning("next-earnings scan failed for %s", symbol, exc_info=True)
        next_earnings = None
    try:
        news = _company_news(symbol)
    except Exception:
        logger.warning("company news failed for %s", symbol, exc_info=True)
        news = []
    return {
        "found": True,
        "symbol": symbol,
        "configured": configured,
        "profile": profile,
        "bars": bars,
        "stats": _bundle_stats(bars),
        "next_earnings": next_earnings,
        "news": news,
    }


# ── Market news (general headlines, 10 min cache) ────────────────────────────

def market_news() -> dict:
    """General market headlines, cap 18. NEVER errors the page."""
    key = _finnhub_key()
    if not key:
        return {"configured": False, "articles": []}
    now = time.time()
    with _lock:
        if _news_cache["payload"] is not None and _news_cache["expires"] > now:
            return _news_cache["payload"]
    articles: List[dict] = []
    ttl = FAILURE_TTL
    try:
        with httpx.Client(timeout=10) as client:
            data = _finnhub_get(client, "news", key, {"category": "general"})
        articles = _trim_news(data, MARKET_NEWS_CAP)
        ttl = NEWS_TTL
    except Exception:
        logger.warning("finnhub market news unavailable", exc_info=True)
    payload = {"configured": True, "articles": articles}
    with _lock:
        _news_cache["payload"] = payload
        _news_cache["expires"] = time.time() + ttl
    return payload
