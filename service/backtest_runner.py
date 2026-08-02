"""Engine invocation + JSON serialization for the API layer.

Mirrors engine/run_backtest_cli.py (the reference invocation pattern):
spec -> BacktestConfig -> HistoricalDataProvider -> BacktestDataCache ->
RuleBasedBacktestEngine -> stats. Adds what HTTP needs: JSON-safe results
(EquityPoint dataclasses and datetimes serialized, inf/nan scrubbed) and a
fetch lock so concurrent requests don't fight over the SQLite cache writer.
"""

import logging
import math
import sys
import threading
from datetime import date, datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Make the engine importable when the service runs from the repo root or its
# own directory (Docker sets PYTHONPATH instead; this is the dev fallback).
ENGINE_DIR = Path(__file__).resolve().parent.parent / "engine"
if str(ENGINE_DIR) not in sys.path:
    sys.path.insert(0, str(ENGINE_DIR))

from backtest.config_overrides import BacktestConfig  # noqa: E402
from backtest.data_adapter import BacktestDataCache  # noqa: E402
from backtest.data_provider import HistoricalDataProvider  # noqa: E402
from backtest.rule_based_engine import (  # noqa: E402
    RuleBasedBacktestEngine,
    load_strategy_spec,
)
from core.config import Config  # noqa: E402
from data.us_universe import USMarketUniverseProvider  # noqa: E402

ALL_US_TOKENS = {"ALL_US", "*", "ALL", "ALL_US_SYMBOLS"}
BENCHMARK = "SPY"

# The OHLCV cache has a single writer; serialize data loading across requests.
_fetch_lock = threading.Lock()


def resolve_symbols(spec: dict, max_symbols: int = 0) -> tuple[list, bool]:
    """Resolve the spec's symbol list; expands ALL_US via the universe provider."""
    symbols_raw = spec.get("symbols", [])
    is_all_us = any(
        isinstance(s, str) and s.strip().upper() in ALL_US_TOKENS for s in symbols_raw
    )
    if is_all_us:
        symbols = USMarketUniverseProvider().get_symbols()
        if max_symbols > 0:
            symbols = symbols[:max_symbols]
    else:
        symbols = [s.strip().upper() for s in symbols_raw if isinstance(s, str) and s.strip()]
    if BENCHMARK not in symbols:
        symbols.append(BENCHMARK)
    return symbols, is_all_us


def run_backtest(
    spec: dict,
    start_date: str,
    end_date: str,
    starting_capital: float = 100_000.0,
    slippage_pct: float = 0.05,
    max_symbols: int = 0,
    data_source: str = "auto",
) -> tuple[dict, BacktestConfig]:
    """Run one backtest. Returns (raw results dict, bt_config). May contain 'error'."""
    symbols, is_all_us = resolve_symbols(spec, max_symbols=max_symbols)

    bt_config = BacktestConfig(
        start_date=start_date,
        end_date=end_date,
        starting_capital=starting_capital,
        symbols=symbols,
        strategy_type="rule_based",
        strategy_spec=spec,
        auto_us_universe=is_all_us,
        auto_universe_max_symbols=max_symbols,
        use_computed_scanners=False,
        benchmark=BENCHMARK,
        slippage_pct=slippage_pct,
    )

    with _fetch_lock:
        provider = HistoricalDataProvider(data_source=data_source)
        try:
            data = provider.fetch_universe(symbols, start_date, end_date)
        finally:
            provider.close()

    if not data:
        return {"error": "No historical data available for the requested symbols"}, bt_config

    data_cache = BacktestDataCache(data)
    spec_obj = load_strategy_spec(bt_config)
    engine = RuleBasedBacktestEngine(Config(), bt_config, data_cache, spec_obj)
    results = engine.run()
    return results, bt_config


def _json_safe_number(value):
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


def _iso(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def serialize_results(results: dict) -> dict:
    """Split raw engine results into JSON-safe {stats, equity_curve, trades}."""
    if "error" in results:
        return {"error": results["error"], "stats": None, "equity_curve": [], "trades": []}

    equity_curve = [
        {
            "date": _iso(point.date),
            "equity": _json_safe_number(round(point.equity, 2)),
            "drawdown_pct": _json_safe_number(round(point.drawdown_pct, 4)),
        }
        for point in results.get("equity_curve", [])
    ]
    trades = [
        {key: _json_safe_number(_iso(value)) for key, value in trade.items()}
        for trade in results.get("trades", [])
    ]
    stats = {
        key: _json_safe_number(value)
        for key, value in results.items()
        if key not in ("equity_curve", "trades", "regime_stats")
    }
    return {"stats": stats, "equity_curve": equity_curve, "trades": trades}
