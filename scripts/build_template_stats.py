"""Pre-run every template and cache headline stats for the gallery.

Usage (repo root):  python scripts/build_template_stats.py [end_date]
Writes templates/_stats.json. Run after warming the OHLCV cache so the
gallery shows real numbers before a visitor clicks anything.
"""

import json
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

from service.backtest_runner import run_backtest, serialize_results  # noqa: E402

START_DATE = "2016-01-01"
INTRADAY_WINDOW_DAYS = 45  # intraday templates run a recent window, not 2016+
HEADLINE_KEYS = [
    "total_return_pct", "cagr", "sharpe", "max_drawdown",
    "total_trades", "win_rate", "profit_factor",
]

# Section 4's strategy pages render a real equity curve, so persist one here
# rather than re-running a 30s backtest per page view. Kept in its own file
# (_curves.json) so the /templates payload the gallery fetches stays lean.
CURVE_POINTS = 180  # plenty for a sparkline-scale chart; ~10y daily is ~2500


def _downsample(curve, target=CURVE_POINTS):
    """Even-stride downsample that ALWAYS keeps the first and last point, and
    keeps the deepest drawdown. Losing the trough would flatter the chart —
    the one distortion this codebase must never introduce."""
    if len(curve) <= target:
        keep = list(range(len(curve)))
    else:
        stride = (len(curve) - 1) / (target - 1)
        keep = sorted({int(round(i * stride)) for i in range(target)})
        keep = [min(i, len(curve) - 1) for i in keep]
        worst = max(range(len(curve)), key=lambda i: curve[i].get("drawdown_pct") or 0)
        keep = sorted(set(keep) | {0, len(curve) - 1, worst})
    return [
        {
            "d": curve[i]["date"],
            "e": curve[i]["equity"],
            "dd": curve[i].get("drawdown_pct"),
        }
        for i in keep
    ]


def main():
    end_date = sys.argv[1] if len(sys.argv) > 1 else datetime.now().strftime("%Y-%m-%d")
    templates_dir = REPO / "templates"
    out = {}
    curves = {}
    failures = []

    for path in sorted(templates_dir.glob("*.json")):
        if path.name.startswith("_"):
            continue
        doc = json.loads(path.read_text(encoding="utf-8"))
        spec = doc.get("spec", doc)
        timeframe = str(spec.get("backtest_timeframe") or "1d")
        start_date = (
            START_DATE
            if timeframe == "1d"
            else (
                datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=INTRADAY_WINDOW_DAYS)
            ).strftime("%Y-%m-%d")
        )
        t0 = time.time()
        results, _bt = run_backtest(spec, start_date, end_date)
        elapsed = time.time() - t0
        serialized = serialize_results(results)

        if serialized.get("error") or not serialized["stats"]:
            failures.append((path.stem, serialized.get("error", "no stats")))
            print(f"FAIL  {path.stem}: {serialized.get('error')}")
            continue

        stats = serialized["stats"]
        headline = {k: stats.get(k) for k in HEADLINE_KEYS}
        curve = serialized.get("equity_curve") or []
        if curve:
            curves[path.stem] = {
                "points": _downsample(curve),
                "start_date": start_date,
                "end_date": end_date,
                "timeframe": timeframe,
                "raw_points": len(curve),
            }
        out[path.stem] = {
            "stats": headline,
            "start_date": start_date,
            "end_date": end_date,
            "timeframe": timeframe,
            "elapsed_seconds": round(elapsed, 2),
            "computed_at": datetime.now().isoformat(timespec="seconds"),
        }
        print(
            f"ok    {path.stem:24} {elapsed:5.1f}s  trades={stats.get('total_trades'):>4}  "
            f"ret={stats.get('total_return_pct'):>8.1f}%  cagr={stats.get('cagr'):>6.2f}%  "
            f"sharpe={stats.get('sharpe'):>5.2f}  maxDD={stats.get('max_drawdown'):>5.1f}%"
        )

    (templates_dir / "_stats.json").write_text(
        json.dumps(out, indent=2, sort_keys=True), encoding="utf-8"
    )
    (templates_dir / "_curves.json").write_text(
        json.dumps(curves, sort_keys=True), encoding="utf-8"
    )
    print(f"\nwrote templates/_stats.json ({len(out)} templates)")
    print(f"wrote templates/_curves.json ({len(curves)} curves)")
    if failures:
        print("FAILURES:", failures)
        sys.exit(1)


if __name__ == "__main__":
    main()
