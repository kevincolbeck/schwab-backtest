"""Local run persistence for the API.

Full run payloads (stats + equity curve + trades + spec) go to
DATA_DIR/runs/<run_id>.json; the lightweight manifest + fingerprint snapshot
comes from service.run_snapshots. In production the service also mirrors runs
to Supabase — this local store keeps dev and self-hosting zero-dependency.
"""

import json
import logging
import os
from pathlib import Path
from typing import Optional

from service import run_snapshots

logger = logging.getLogger(__name__)

DATA_DIR = Path(os.getenv("SERVICE_DATA_DIR", "."))

DIFF_STAT_KEYS = [
    "total_return_pct", "cagr", "sharpe", "sortino", "max_drawdown",
    "total_trades", "win_rate", "profit_factor", "expectancy_r", "final_equity",
]


def save_run(
    serialized: dict,
    spec: dict,
    bt_config,
    run_type: str = "api",
    parent_run_id: Optional[str] = None,
    owner: Optional[str] = None,
) -> Optional[str]:
    """Persist a completed run. Returns run_id, or None for error results."""
    raw_stats = serialized.get("stats") or {}
    record = run_snapshots.record_backtest_run(
        results=raw_stats,
        spec=spec,
        bt_config=bt_config,
        run_type=run_type,
        base_dir=str(DATA_DIR),
        parent_run_id=parent_run_id,
    )
    if record is None:
        return None
    run_id = record["run_id"]

    runs_dir = DATA_DIR / "runs"
    runs_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "run_id": run_id,
        "parent_run_id": parent_run_id,
        "owner": owner,
        "spec": spec,
        "params": {
            "start_date": bt_config.start_date,
            "end_date": bt_config.end_date,
            "starting_capital": bt_config.starting_capital,
            "slippage_pct": bt_config.slippage_pct,
            "benchmark": bt_config.benchmark,
        },
        "stats": serialized.get("stats"),
        "equity_curve": serialized.get("equity_curve"),
        "trades": serialized.get("trades"),
    }
    (runs_dir / f"{run_id}.json").write_text(
        json.dumps(payload), encoding="utf-8"
    )
    return run_id


def get_run(run_id: str) -> Optional[dict]:
    if not _safe_run_id(run_id):
        return None
    path = DATA_DIR / "runs" / f"{run_id}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        logger.warning("Unreadable run payload: %s", path, exc_info=True)
        return None


def diff_runs(run_id: str, other_id: str) -> Optional[dict]:
    """Side-by-side stat blocks for two runs (frontend renders the comparison)."""
    a, b = get_run(run_id), get_run(other_id)
    if a is None or b is None:
        return None

    def block(run):
        stats = run.get("stats") or {}
        return {
            "run_id": run["run_id"],
            "params": run.get("params"),
            "spec_name": (run.get("spec") or {}).get("name"),
            "stats": {k: stats.get(k) for k in DIFF_STAT_KEYS},
        }

    return {"a": block(a), "b": block(b)}


def _safe_run_id(run_id: str) -> bool:
    return run_id.replace("_", "").replace("-", "").isalnum()


def list_runs_for_owner(owner: str, limit: int = 50) -> list:
    """Newest-first run summaries for a user's dashboard."""
    manifest = DATA_DIR / "backtest_runs.jsonl"
    if not manifest.exists() or not owner:
        return []
    out = []
    for line in manifest.read_text(encoding="utf-8").splitlines():
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        run = get_run(row.get("run_id", ""))
        if run and run.get("owner") == owner:
            out.append({
                "run_id": run["run_id"],
                "name": (run.get("spec") or {}).get("name"),
                "params": run.get("params"),
                "stats": {k: (run.get("stats") or {}).get(k)
                          for k in ("cagr", "total_return_pct", "max_drawdown", "total_trades")},
                "share_slug": run.get("share_slug"),
            })
    return list(reversed(out))[:limit]


# ── Share slugs — every result is a URL ───────────────────────────────────────

def _shares_path() -> Path:
    return DATA_DIR / "shares.json"


def _load_shares() -> dict:
    path = _shares_path()
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            logger.warning("unreadable shares index", exc_info=True)
    return {}


def create_share(run_id: str, watermarked: bool) -> Optional[str]:
    """Create (or return the existing) public share slug for a run."""
    run = get_run(run_id)
    if run is None:
        return None
    if run.get("share_slug"):
        return run["share_slug"]
    import hashlib
    slug = hashlib.sha256(f"share:{run_id}".encode()).hexdigest()[:10]
    shares = _load_shares()
    shares[slug] = {"run_id": run_id, "watermarked": watermarked}
    _shares_path().write_text(json.dumps(shares, indent=2), encoding="utf-8")
    run["share_slug"] = slug
    (DATA_DIR / "runs" / f"{run_id}.json").write_text(json.dumps(run), encoding="utf-8")
    return slug


def get_share(slug: str) -> Optional[dict]:
    """Public share payload: the run plus its watermark flag."""
    if not slug.isalnum():
        return None
    entry = _load_shares().get(slug)
    if not entry:
        return None
    run = get_run(entry["run_id"])
    if run is None:
        return None
    run.pop("owner", None)  # never leak the owner id on a public page
    run["watermarked"] = bool(entry.get("watermarked"))
    run["share_slug"] = slug
    return run
