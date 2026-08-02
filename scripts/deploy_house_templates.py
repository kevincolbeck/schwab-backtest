"""Deploy the 8 templates as house deployments so the leaderboard is alive
before the first user arrives (master plan Phase 7, step 5).

Usage (repo root):  python scripts/deploy_house_templates.py [deployed_at] [as_of]
Defaults: deployed_at 2026-06-01, as_of today. Skips templates already deployed
(same spec hash + owner house). Then runs one worker pass to catch up the ledger.
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))
os.environ.setdefault("BACKTEST_CACHE_DB", str(REPO / "engine" / "backtest_data.db"))
os.environ.setdefault("SERVICE_DATA_DIR", str(REPO / "service_data"))

from service import forward  # noqa: E402

deployed_at = sys.argv[1] if len(sys.argv) > 1 else "2026-06-01"
as_of = sys.argv[2] if len(sys.argv) > 2 else datetime.now().strftime("%Y-%m-%d")

stats_path = REPO / "templates" / "_stats.json"
cached_stats = json.loads(stats_path.read_text(encoding="utf-8")) if stats_path.exists() else {}

existing_hashes = {d["spec_hash"] for d in forward.list_deployments("active") if d["owner"] == "house"}

for path in sorted((REPO / "templates").glob("*.json")):
    if path.name.startswith("_"):
        continue
    doc = json.loads(path.read_text(encoding="utf-8"))
    spec = doc.get("spec", doc)
    digest = forward.spec_hash_of(spec)
    if digest in existing_hashes:
        print(f"skip {path.stem} (already deployed)")
        continue
    dep = forward.create_deployment(
        spec,
        name=doc.get("meta", {}).get("display_name", spec.get("name")),
        owner="house",
        deployed_at=deployed_at,
        backtest_stats=(cached_stats.get(path.stem) or {}).get("stats"),
    )
    print(f"deployed {dep['slug']} (deployed_at {deployed_at})")

print(f"\nrunning worker catch-up to {as_of}...")
out = forward.run_worker(as_of=as_of)
print(f"processed={out['processed']} appended={out['signals_appended']} errors={out['errors']}")

print("\nleaderboard:")
for e in forward.leaderboard():
    print(f"  {e['forward_return_pct']:>7.2f}%  maxDD {e['max_drawdown_pct']:>5.2f}%  "
          f"{e['days_live']:>3}d  {e['signal_count']:>3} signals  {e['name']}")
