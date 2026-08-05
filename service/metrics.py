"""Weekly-cohort funnel metrics (P0-5 — Section 1 dashboard).

Computes activation and deployment rate by SIGNUP week from first-party data
the platform already owns — Supabase profiles (signups), the runs manifest
(who ran a backtest), and the forward ledger (who deployed). No PostHog
dependency: the dashboard works before the analytics key exists, and PostHog
funnels later refine it (e.g. true result_viewed, which only the browser
sees — here "activated" means the user ran ≥1 backtest, which in the lab
auto-opens the results tab).

Definitions (spec Section 1):
- activation: signup with ≥1 owned backtest run. Target >60%.
- deployment: ACTIVATED signup with ≥1 ledger deployment (house excluded).
  Target >20%. North star.
"""

import json
import logging
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

import httpx

from service import auth, forward, runs_store

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 600  # admin dashboard freshness; recompute is file-heavy

_cache: Optional[dict] = None
_cache_at = 0.0
_cache_lock = threading.Lock()


def _parse_iso(value: str) -> Optional[datetime]:
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


def _run_id_time(run_id: str) -> Optional[datetime]:
    """Run ids embed their creation moment: 20260805T222124Z_<hash>."""
    try:
        return datetime.strptime(run_id[:16], "%Y%m%dT%H%M%SZ").replace(
            tzinfo=timezone.utc
        )
    except (ValueError, TypeError):
        return None


def fetch_signups() -> Tuple[List[Tuple[str, datetime]], bool]:
    """((user_id, created_at) rows, complete) via the service key.

    `complete=False` means Supabase failed mid-fetch — the caller must flag
    the snapshot as partial and must NOT cache it: a silently-zeroed cohort
    table rendered as truth is worse than an error banner.
    """
    if not auth.auth_configured():
        return [], True  # nothing to fetch is not a failure
    out: List[Tuple[str, datetime]] = []
    headers = {
        "apikey": auth.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {auth.SUPABASE_SERVICE_KEY}",
    }
    offset, page = 0, 1000
    try:
        with httpx.Client(timeout=15) as client:
            while True:
                resp = client.get(
                    f"{auth.SUPABASE_URL}/rest/v1/profiles",
                    params={
                        "select": "id,created_at",
                        "order": "created_at.asc",
                        "limit": str(page),
                        "offset": str(offset),
                    },
                    headers=headers,
                )
                if resp.status_code != 200:
                    logger.warning("profiles fetch failed: %s", resp.status_code)
                    return out, False
                rows = resp.json()
                for row in rows:
                    created = _parse_iso(row.get("created_at"))
                    if row.get("id") and created:
                        out.append((str(row["id"]), created))
                if not rows:
                    break
                # Advance by what actually arrived: a Supabase Max Rows
                # setting below our page size would otherwise end the loop
                # after one short page and silently under-report signups.
                offset += len(rows)
    except Exception:
        logger.warning("profiles fetch unreachable", exc_info=True)
        return out, False
    return out, True


def first_runs_by_owner() -> Dict[str, datetime]:
    """Earliest owned run per user — one streaming pass over the manifest.

    Rows written post-P0-5 carry `owner` inline; legacy rows (the launch
    week's) lack the key and fall back to opening the run payload once.
    """
    manifest = runs_store.DATA_DIR / "backtest_runs.jsonl"
    if not manifest.exists():
        return {}
    firsts: Dict[str, datetime] = {}
    for line in manifest.read_text(encoding="utf-8").splitlines():
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        run_id = row.get("run_id", "")
        if "owner" in row:
            owner = row.get("owner")
        else:  # legacy row — the payload is the only owner record
            owner = (runs_store.get_run(run_id) or {}).get("owner")
        if not owner or owner == "house":
            continue
        at = _parse_iso(row.get("timestamp_utc")) or _run_id_time(run_id)
        if at and (owner not in firsts or at < firsts[owner]):
            firsts[owner] = at
    return firsts


def first_deploys_by_owner() -> Dict[str, datetime]:
    """Earliest ledger deployment per user, all statuses — an archived record
    still counts as having deployed."""
    firsts: Dict[str, datetime] = {}
    for status in ("active", "archived"):
        try:
            deployments = forward.list_deployments(status)
        except Exception:
            logger.warning("deployments fetch failed (%s)", status, exc_info=True)
            continue
        for dep in deployments:
            owner = dep.get("owner")
            if not owner or owner == "house":
                continue
            at = _parse_iso(dep.get("deployed_at"))
            if at and (owner not in firsts or at < firsts[owner]):
                firsts[owner] = at
    return firsts


def _week_start(dt: datetime) -> str:
    monday = (dt - timedelta(days=dt.weekday())).date()
    return monday.isoformat()


def weekly_cohorts(
    signups: List[Tuple[str, datetime]],
    run_firsts: Dict[str, datetime],
    deploy_firsts: Dict[str, datetime],
) -> dict:
    """Pure cohort math — signup week (ISO Monday) → funnel counts and rates.

    Deployment rate is over ACTIVATED users (the spec's definition), so the
    two rates multiply into the signup→deploy funnel.
    """
    cohorts: Dict[str, dict] = {}
    for user_id, created in signups:
        week = _week_start(created)
        row = cohorts.setdefault(
            week, {"week": week, "signups": 0, "activated": 0, "deployed": 0}
        )
        row["signups"] += 1
        if user_id in run_firsts:
            row["activated"] += 1
            # Spec funnel: deployment rate counts activated users only. A
            # deploy without an owned run can't happen (deploys freeze a run).
            if user_id in deploy_firsts:
                row["deployed"] += 1

    def rates(row: dict) -> dict:
        return {
            **row,
            "activation_rate": round(row["activated"] / row["signups"], 4)
            if row["signups"]
            else None,
            "deployment_rate": round(row["deployed"] / row["activated"], 4)
            if row["activated"]
            else None,
        }

    ordered = [rates(cohorts[w]) for w in sorted(cohorts, reverse=True)]
    totals = rates(
        {
            "week": "all",
            "signups": sum(r["signups"] for r in ordered),
            "activated": sum(r["activated"] for r in ordered),
            "deployed": sum(r["deployed"] for r in ordered),
        }
    )
    return {"cohorts": ordered, "totals": totals}


def dashboard(force: bool = False) -> dict:
    """Cached snapshot for /admin/metrics.

    The lock is held ACROSS the computation (single-flight): the scan reads
    the whole manifest, so concurrent cold requests — or a double-clicked
    force-refresh — must queue behind one computation, not each run their own.
    Partial snapshots (Supabase failed mid-fetch) are flagged and NEVER
    cached: stale-but-honest beats fresh-but-silently-wrong.
    """
    global _cache, _cache_at
    with _cache_lock:
        if not force and _cache and time.time() - _cache_at < CACHE_TTL_SECONDS:
            return _cache
        signups, complete = fetch_signups()
        result = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "auth_configured": auth.auth_configured(),
            "signups_partial": not complete,
            **weekly_cohorts(signups, first_runs_by_owner(), first_deploys_by_owner()),
        }
        if complete:
            _cache, _cache_at = result, time.time()
        return result
