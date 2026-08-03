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

Both payloads are cached in-memory (30 min / 6 h). This is an EOD research
surface, not a live data product — intraday flicker is a non-goal on purpose.
"""

import logging
import os
import sqlite3
import threading
import time
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
_lock = threading.Lock()


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


def _trim_earnings(payload: dict) -> List[dict]:
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
    return out[:EARNINGS_CAP]


def _trim_ipos(payload: dict) -> List[dict]:
    rows = payload.get("ipoCalendar") or []
    out = []
    for row in rows:
        if not isinstance(row, dict) or not row.get("date"):
            continue
        if not row.get("symbol") and not row.get("name"):
            continue
        out.append({
            "symbol": row.get("symbol"),
            "name": row.get("name"),
            "date": row["date"],
            "exchange": row.get("exchange"),
            "price": row.get("price"),
            "status": row.get("status"),
        })
    out.sort(key=lambda r: r["date"])
    return out[:IPO_CAP]


def _fetch_week(key: str, start: str, end: str) -> Tuple[List[dict], List[dict]]:
    """The only outbound call in this module (tests stub it out)."""
    with httpx.Client(timeout=10) as client:
        earnings = _trim_earnings(_finnhub_json(client, "calendar/earnings", key, start, end))
        ipos = _trim_ipos(_finnhub_json(client, "calendar/ipo", key, start, end))
    return earnings, ipos


def _finnhub_json(client: httpx.Client, path: str, key: str, start: str, end: str) -> dict:
    resp = client.get(
        f"https://finnhub.io/api/v1/{path}",
        params={"from": start, "to": end, "token": key},
    )
    resp.raise_for_status()
    data = resp.json()
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
