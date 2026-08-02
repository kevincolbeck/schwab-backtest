"""Forward-engine acceptance gate (master plan Phase 5, gate 7):

Deploy a template, run the worker across 5 simulated days of historical
"new" data, then verify: ledger appends in order, equity snapshots exist,
re-runs are idempotent, and the ledger + frozen spec are immutable.

Usage (repo root):  python scripts/verify_forward_acceptance.py
Uses an isolated SERVICE_DATA_DIR so it never touches real deployments.
"""

import json
import os
import sqlite3
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

os.environ.setdefault("BACKTEST_CACHE_DB", str(REPO / "engine" / "backtest_data.db"))
os.environ["SERVICE_DATA_DIR"] = tempfile.mkdtemp(prefix="forward_acceptance_")

from service import forward  # noqa: E402

# Simulated timeline: deploy before a stretch of cached history, then feed the
# worker one "new" EOD day at a time — exactly what the cron does in production.
DEPLOYED_AT = "2026-02-02"
SIM_DAYS = ["2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20"]

template = json.loads((REPO / "templates" / "rsi2-mean-reversion.json").read_text(encoding="utf-8"))
dep = forward.create_deployment(
    template["spec"], name="Acceptance Test", deployed_at=DEPLOYED_AT,
)
print(f"deployed '{dep['slug']}' at {DEPLOYED_AT} (spec_hash {dep['spec_hash'][:12]})")

signal_counts, equity_counts = [], []
for day in SIM_DAYS:
    out = forward.run_worker(as_of=day)
    n_sig = len(forward.get_signals(dep["id"]))
    n_eq = len(forward.get_equity_series(dep["id"]))
    signal_counts.append(n_sig)
    equity_counts.append(n_eq)
    print(f"worker as_of={day}: appended={out['signals_appended']:>3}  "
          f"ledger={n_sig:>3} signals, {n_eq:>3} equity snapshots, errors={out['errors']}")
    assert not out["errors"], f"worker errors on {day}"

# 1. Ledger grows monotonically and snapshots accrue day over day
assert signal_counts == sorted(signal_counts), "ledger must only grow"
assert equity_counts == sorted(equity_counts) and equity_counts[-1] > equity_counts[0]
assert signal_counts[-1] > 0, "expected out-of-sample signals (RSI-2 trades often)"
print("1. ledger appends + daily equity snapshots: OK")

# 2. Signals are ordered and all post-deployment
signals = forward.get_signals(dep["id"])
dates = [s["signal_date"] for s in signals]
assert dates == sorted(dates)
assert all(d >= DEPLOYED_AT for d in dates), "warm-up trades leaked into the ledger"
print(f"2. {len(signals)} signals, ordered, all >= deployment date: OK")

# 3. Idempotency: re-run the final day 3 times — nothing changes
before = json.dumps(signals, sort_keys=True)
for _ in range(3):
    out = forward.run_worker(as_of=SIM_DAYS[-1])
    assert out["signals_appended"] == 0, "re-run appended duplicate signals"
after = json.dumps(forward.get_signals(dep["id"]), sort_keys=True)
assert before == after, "re-run mutated the ledger"
print("3. idempotency (3 re-runs of the same day, zero appends, zero mutation): OK")

# 4. Immutability: UPDATE and DELETE on forward_signals must FAIL
conn = forward._connect()
for statement in (
    "UPDATE forward_signals SET price = 1 WHERE deployment_id = ?",
    "DELETE FROM forward_signals WHERE deployment_id = ?",
    "UPDATE deployments SET spec_frozen = '{}' WHERE id = ?",
):
    try:
        conn.execute(statement, (dep["id"],))
        raise SystemExit(f"IMMUTABILITY FAILURE: statement succeeded: {statement}")
    except sqlite3.DatabaseError as exc:
        print(f"4. blocked as required: {statement.split(' WHERE')[0]!r} -> {exc}")
conn.close()

# 5. Summary sanity
summary = forward.forward_summary(dep)
print(f"5. forward summary: {summary['days_live']} days live, "
      f"return {summary['forward_return_pct']}%, maxDD {summary['max_drawdown_pct']}%, "
      f"{len(summary['open_positions'])} open positions")

print("\nFORWARD ACCEPTANCE GATE PASSES")
