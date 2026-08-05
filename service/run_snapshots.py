"""Immutable backtest run snapshots.

Ported from the desktop app's BacktestWindow._record_backtest_run. Every run
gets a content-addressed run_id (UTC timestamp + sha256 fingerprint prefix),
an append-only line in backtest_runs.jsonl, and a full replay snapshot in
backtest_runs/<run_id>.json. This is the local backbone of the saved-runs /
share-links / diff feature; the service layer mirrors these records to
Supabase in production.
"""

import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

SNAPSHOT_VERSION = 2  # v1 was the desktop app (carried live-bot runtime_config)

RESULT_SUMMARY_KEYS = [
    "total_trades", "cagr", "total_return_pct", "sharpe", "sortino",
    "max_drawdown", "win_rate", "profit_factor", "final_equity",
    "avg_r", "expectancy_r",
]


def snapshot_results(results: dict) -> dict:
    """Reduce a full results dict to the JSON-safe headline summary."""
    summary = {}
    for key in RESULT_SUMMARY_KEYS:
        value = results.get(key)
        if isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):
            value = None  # NaN/inf are not valid JSON
        summary[key] = value
    return summary


def snapshot_backtest_config(bt) -> dict:
    """Snapshot a BacktestConfig for replay (spec itself is stored separately)."""
    return {
        "start_date": bt.start_date,
        "end_date": bt.end_date,
        "starting_capital": bt.starting_capital,
        "symbols_count": len(bt.symbols or []),
        "symbols_preview": (bt.symbols or [])[:25],
        "strategy_type": bt.strategy_type,
        "auto_us_universe": bt.auto_us_universe,
        "auto_universe_max_symbols": bt.auto_universe_max_symbols,
        "benchmark": bt.benchmark,
        "slippage_pct": bt.slippage_pct,
        "commission_per_share": bt.commission_per_share,
        "min_daily_vol_ratio": bt.min_daily_vol_ratio,
        "breakeven_before_stop_on_same_bar": bt.breakeven_before_stop_on_same_bar,
        "skip_spread_check": bt.skip_spread_check,
    }


def is_profitable(results_summary: dict) -> bool:
    trades = int(results_summary.get("total_trades") or 0)
    total_return = float(results_summary.get("total_return_pct") or 0.0)
    cagr = float(results_summary.get("cagr") or 0.0)
    final_equity = results_summary.get("final_equity")
    if final_equity is not None and float(final_equity) <= 0:
        return False
    return trades > 0 and total_return > 0 and cagr > 0


def record_backtest_run(
    results: dict,
    spec: Optional[dict],
    bt_config,
    run_type: str,
    base_dir: str = ".",
    parent_run_id: Optional[str] = None,
    owner: Optional[str] = None,
) -> Optional[dict]:
    """Persist run summary plus immutable replay snapshot. Returns paths + run_id."""
    if not bt_config or "error" in results:
        return None

    base = Path(base_dir)
    bt_snapshot = snapshot_backtest_config(bt_config)
    results_summary = snapshot_results(results)

    fingerprint_payload = {
        "strategy_spec": spec,
        "backtest_config": bt_snapshot,
        "results_summary": results_summary,
    }
    fingerprint_sha256 = hashlib.sha256(
        json.dumps(fingerprint_payload, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
    ).hexdigest()
    timestamp = datetime.now(timezone.utc)
    run_id = f"{timestamp.strftime('%Y%m%dT%H%M%SZ')}_{fingerprint_sha256[:12]}"

    spec_hash = (
        hashlib.sha256(
            json.dumps(spec, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        if isinstance(spec, dict)
        else None
    )

    snapshot_payload = {
        "version": SNAPSHOT_VERSION,
        "run_id": run_id,
        "timestamp_utc": timestamp.isoformat(),
        "run_type": run_type,
        "parent_run_id": parent_run_id,
        "fingerprint_sha256": fingerprint_sha256,
        "backtest_config": bt_snapshot,
        "strategy": {
            "name": spec.get("name") if isinstance(spec, dict) else None,
            "spec_hash_sha256": spec_hash,
            "full_spec": spec if isinstance(spec, dict) else None,
        },
        "results": results_summary,
        "profitable": is_profitable(results_summary),
    }

    jsonl_line = {
        "timestamp_utc": timestamp.isoformat(),
        "run_id": run_id,
        "run_type": run_type,
        # Owner in the manifest lets cohort metrics stream ONE file instead of
        # opening every multi-hundred-KB run payload (P0-5 review). Legacy
        # rows lack the key — metrics falls back to the payload for those.
        "owner": owner,
        "parent_run_id": parent_run_id,
        "start_date": bt_config.start_date,
        "end_date": bt_config.end_date,
        "starting_capital": bt_config.starting_capital,
        "benchmark": bt_config.benchmark,
        "slippage_pct": bt_config.slippage_pct,
        "fingerprint_sha256": fingerprint_sha256,
        "strategy_name": snapshot_payload["strategy"]["name"],
        "spec_hash_sha256": spec_hash,
        "results": results_summary,
    }

    try:
        base.mkdir(parents=True, exist_ok=True)
        manifest = base / "backtest_runs.jsonl"
        with manifest.open("a", encoding="utf-8") as fp:
            fp.write(json.dumps(jsonl_line) + "\n")

        snapshot_dir = base / "backtest_runs"
        snapshot_dir.mkdir(parents=True, exist_ok=True)
        snapshot_path = snapshot_dir / f"{run_id}.json"
        snapshot_path.write_text(
            json.dumps(snapshot_payload, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        logger.info(
            "Backtest run recorded: id=%s type=%s trades=%s",
            run_id, run_type, results_summary.get("total_trades"),
        )
        return {
            "run_id": run_id,
            "summary_path": str(manifest).replace("\\", "/"),
            "snapshot_path": str(snapshot_path).replace("\\", "/"),
        }
    except Exception:
        logger.warning("Failed to write backtest run record", exc_info=True)
        return None


def load_run_snapshot(run_id: str, base_dir: str = ".") -> Optional[dict]:
    """Load an immutable run snapshot by id (replay/diff support)."""
    path = Path(base_dir) / "backtest_runs" / f"{run_id}.json"
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except Exception:
        logger.warning("Unreadable run snapshot: %s", path, exc_info=True)
        return None
