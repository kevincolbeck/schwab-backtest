"""Pre-run every template and cache headline stats for the gallery.

Usage (repo root):  python scripts/build_template_stats.py [end_date]
Writes templates/_stats.json. Run after warming the OHLCV cache so the
gallery shows real numbers before a visitor clicks anything.
"""

import json
import sys
import time
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

from service.backtest_runner import run_backtest, serialize_results  # noqa: E402

START_DATE = "2016-01-01"
HEADLINE_KEYS = [
    "total_return_pct", "cagr", "sharpe", "max_drawdown",
    "total_trades", "win_rate", "profit_factor",
]


def main():
    end_date = sys.argv[1] if len(sys.argv) > 1 else datetime.now().strftime("%Y-%m-%d")
    templates_dir = REPO / "templates"
    out = {}
    failures = []

    for path in sorted(templates_dir.glob("*.json")):
        if path.name.startswith("_"):
            continue
        doc = json.loads(path.read_text(encoding="utf-8"))
        spec = doc.get("spec", doc)
        t0 = time.time()
        results, _bt = run_backtest(spec, START_DATE, end_date)
        elapsed = time.time() - t0
        serialized = serialize_results(results)

        if serialized.get("error") or not serialized["stats"]:
            failures.append((path.stem, serialized.get("error", "no stats")))
            print(f"FAIL  {path.stem}: {serialized.get('error')}")
            continue

        stats = serialized["stats"]
        headline = {k: stats.get(k) for k in HEADLINE_KEYS}
        out[path.stem] = {
            "stats": headline,
            "start_date": START_DATE,
            "end_date": end_date,
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
    print(f"\nwrote templates/_stats.json ({len(out)} templates)")
    if failures:
        print("FAILURES:", failures)
        sys.exit(1)


if __name__ == "__main__":
    main()
