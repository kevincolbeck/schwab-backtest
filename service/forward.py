"""Forward-testing engine: deployments, the append-only ledger, and the worker.

THE design guarantee ("no drift between test and live signals"): forward
signals are produced by REPLAYING the frozen spec through the exact same
RuleBasedBacktestEngine used for backtests. There is no second signal
implementation to diverge. Each worker run replays [deployed_at - warmup,
as_of] and appends whatever the ledger doesn't have yet; unique constraints
make the append idempotent, and nothing in this module can mutate an
existing signal row (the Supabase mirror additionally revokes UPDATE/DELETE).

Execution model (stated on every strategy page): signals come from EOD bars;
fills use the spec's entry_price_field and the same slippage assumption as
backtests. Warm-up trades entered before the deployment date are discarded —
only out-of-sample signals reach the ledger. Paper equity is the replay's
equity curve from the deployment date, rebased to the paper starting capital.

Storage: SQLite at SERVICE_DATA_DIR/forward.db, schema mirroring
supabase/migrations/0002_forward_ledger.sql (production mirrors rows there).
"""

import hashlib
import json
import logging
import os
import re
import sqlite3
import threading
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

WARMUP_DAYS = 730  # calendar days of pre-deployment history for indicator warm-up
DEFAULT_STARTING_CAPITAL = 100_000.0
MIN_LEADERBOARD_DAYS = int(os.getenv("MIN_LEADERBOARD_DAYS", "20"))

_db_lock = threading.Lock()


def _db_path() -> Path:
    return Path(os.getenv("SERVICE_DATA_DIR", ".")) / "forward.db"


def _connect() -> sqlite3.Connection:
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS deployments (
            id TEXT PRIMARY KEY,
            slug TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            owner TEXT NOT NULL DEFAULT 'house',
            spec_frozen TEXT NOT NULL,
            spec_hash TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            visibility TEXT NOT NULL DEFAULT 'public',
            starting_capital REAL NOT NULL,
            deployed_at TEXT NOT NULL,
            source_run_id TEXT,
            backtest_stats TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS forward_signals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deployment_id TEXT NOT NULL,
            signal_date TEXT NOT NULL,
            action TEXT NOT NULL,
            symbol TEXT NOT NULL,
            price REAL NOT NULL,
            shares REAL NOT NULL,
            reason TEXT,
            created_at TEXT NOT NULL,
            UNIQUE (deployment_id, signal_date, action, symbol)
        );
        CREATE TABLE IF NOT EXISTS forward_equity (
            deployment_id TEXT NOT NULL,
            date TEXT NOT NULL,
            equity REAL NOT NULL,
            open_positions TEXT NOT NULL DEFAULT '[]',
            PRIMARY KEY (deployment_id, date)
        );
        CREATE TABLE IF NOT EXISTS worker_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ran_at TEXT NOT NULL,
            as_of TEXT NOT NULL,
            deployments_processed INTEGER NOT NULL,
            signals_appended INTEGER NOT NULL,
            errors TEXT
        );
        -- Append-only enforced at the storage layer, mirroring the Postgres
        -- REVOKE + trigger in supabase/migrations/0002_forward_ledger.sql.
        CREATE TRIGGER IF NOT EXISTS forward_signals_no_update
            BEFORE UPDATE ON forward_signals
            BEGIN SELECT RAISE(ABORT, 'forward_signals is append-only'); END;
        CREATE TRIGGER IF NOT EXISTS forward_signals_no_delete
            BEFORE DELETE ON forward_signals
            BEGIN SELECT RAISE(ABORT, 'forward_signals is append-only'); END;
        CREATE TRIGGER IF NOT EXISTS deployments_spec_immutable
            BEFORE UPDATE OF spec_frozen, spec_hash, deployed_at ON deployments
            BEGIN SELECT RAISE(ABORT, 'deployed specs are immutable'); END;
        """
    )
    return conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify(name: str, spec_hash: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40] or "strategy"
    return f"{base}-{spec_hash[:6]}"


def spec_hash_of(spec: dict) -> str:
    return hashlib.sha256(
        json.dumps(spec, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


# ── Deploy ────────────────────────────────────────────────────────────────────

def create_deployment(
    spec: dict,
    name: Optional[str] = None,
    owner: str = "house",
    visibility: str = "public",
    starting_capital: float = DEFAULT_STARTING_CAPITAL,
    deployed_at: Optional[str] = None,
    source_run_id: Optional[str] = None,
    backtest_stats: Optional[dict] = None,
) -> dict:
    """Freeze a spec into a new deployment. Frozen specs are immutable —
    changing a deployed strategy means a NEW deployment with a fresh record."""
    frozen = json.dumps(spec, sort_keys=True, separators=(",", ":"))
    digest = spec_hash_of(spec)
    dep_id = hashlib.sha256(f"{digest}{_now()}".encode()).hexdigest()[:16]
    slug = _slugify(name or spec.get("name", "strategy"), digest)
    deployed = deployed_at or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    with _db_lock:
        conn = _connect()
        try:
            existing = conn.execute(
                "SELECT slug FROM deployments WHERE slug = ?", (slug,)
            ).fetchone()
            if existing:
                slug = f"{slug}-{dep_id[:4]}"
            conn.execute(
                "INSERT INTO deployments (id, slug, name, owner, spec_frozen, spec_hash,"
                " status, visibility, starting_capital, deployed_at, source_run_id,"
                " backtest_stats, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)",
                (
                    dep_id, slug, name or spec.get("name", "Strategy"), owner,
                    frozen, digest, visibility, starting_capital, deployed,
                    source_run_id,
                    json.dumps(backtest_stats) if backtest_stats else None,
                    _now(),
                ),
            )
            conn.commit()
        finally:
            conn.close()
    return get_deployment_by_slug(slug)


def get_deployment_by_slug(slug: str) -> Optional[dict]:
    conn = _connect()
    try:
        row = conn.execute("SELECT * FROM deployments WHERE slug = ?", (slug,)).fetchone()
    finally:
        conn.close()
    return _deployment_row(row) if row else None


def get_deployment(dep_id: str) -> Optional[dict]:
    conn = _connect()
    try:
        row = conn.execute("SELECT * FROM deployments WHERE id = ?", (dep_id,)).fetchone()
    finally:
        conn.close()
    return _deployment_row(row) if row else None


def list_deployments(status: str = "active") -> list:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT * FROM deployments WHERE status = ? ORDER BY deployed_at", (status,)
        ).fetchall()
    finally:
        conn.close()
    return [_deployment_row(r) for r in rows]


def _deployment_row(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["spec_frozen"] = json.loads(d["spec_frozen"])
    d["backtest_stats"] = json.loads(d["backtest_stats"]) if d["backtest_stats"] else None
    return d


# ── Ledger reads ──────────────────────────────────────────────────────────────

def get_signals(deployment_id: str) -> list:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT signal_date, action, symbol, price, shares, reason, created_at"
            " FROM forward_signals WHERE deployment_id = ?"
            " ORDER BY signal_date, id",
            (deployment_id,),
        ).fetchall()
    finally:
        conn.close()
    return [dict(r) for r in rows]


def get_equity_series(deployment_id: str) -> list:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT date, equity, open_positions FROM forward_equity"
            " WHERE deployment_id = ? ORDER BY date",
            (deployment_id,),
        ).fetchall()
    finally:
        conn.close()
    out = []
    for r in rows:
        d = dict(r)
        d["open_positions"] = json.loads(d["open_positions"])
        out.append(d)
    return out


def open_positions_from_signals(signals: list) -> list:
    """Ledger-derived open positions: entries without a matching exit."""
    open_by_symbol: dict = {}
    for s in signals:
        if s["action"] == "entry":
            open_by_symbol.setdefault(s["symbol"], []).append(s)
        else:
            lots = open_by_symbol.get(s["symbol"])
            if lots:
                lots.pop(0)
    out = []
    for symbol, lots in open_by_symbol.items():
        for lot in lots:
            out.append({
                "symbol": symbol,
                "entry_date": lot["signal_date"],
                "entry_price": lot["price"],
                "shares": lot["shares"],
            })
    return out


# ── Worker: replay + append ───────────────────────────────────────────────────

_EXIT_ACTION = {
    "STOP_LOSS": "stop",
    "INTRADAY_VWAP_STOP": "stop",
    "TIME_EXIT": "time_exit",
}


def _exit_action(reason: str) -> Optional[str]:
    reason = (reason or "").upper()
    if reason == "END_OF_TEST":
        return None  # forced close at replay end — the position is still open
    return _EXIT_ACTION.get(reason, "exit")


def process_deployment(deployment: dict, as_of: str) -> dict:
    """Replay the frozen spec to as_of and append anything the ledger lacks.

    Idempotent per (deployment, date): re-running the same day appends nothing
    (unique constraints) and equity snapshots are INSERT OR IGNORE.
    """
    from service.backtest_runner import run_backtest, serialize_results

    spec = deployment["spec_frozen"]
    deployed_at = deployment["deployed_at"]
    warmup_start = (
        datetime.strptime(deployed_at, "%Y-%m-%d") - timedelta(days=WARMUP_DAYS)
    ).strftime("%Y-%m-%d")

    # Full history for indicator warm-up, but trading starts FLAT at the
    # deployment date (engine-enforced) — no warm-up positions can bleed in.
    results, _bt = run_backtest(
        spec=spec,
        start_date=warmup_start,
        end_date=as_of,
        starting_capital=deployment["starting_capital"],
        trade_start_date=deployed_at,
    )
    serialized = serialize_results(results)
    if serialized.get("error"):
        return {"deployment": deployment["slug"], "error": serialized["error"], "appended": 0}

    # Out-of-sample signals only: trades entered on/after the deployment date.
    new_signals = []
    for trade in serialized["trades"]:
        entry_date = str(trade["entry_date"])[:10]
        if entry_date < deployed_at:
            continue  # warm-up trade — discarded, never enters the ledger
        new_signals.append((entry_date, "entry", trade["symbol"],
                            float(trade["entry_price"]), float(trade["shares"]),
                            trade.get("signal_type") or "ENTRY"))
        action = _exit_action(str(trade.get("exit_reason") or ""))
        if action:
            exit_date = str(trade["exit_date"])[:10]
            new_signals.append((exit_date, action, trade["symbol"],
                                float(trade["exit_price"]), float(trade["shares"]),
                                str(trade.get("exit_reason") or "")))

    # Paper equity: replay curve from deployment date, rebased to paper capital.
    curve = [p for p in serialized["equity_curve"] if str(p["date"])[:10] >= deployed_at]
    snapshots = []
    if curve:
        base = curve[0]["equity"] or deployment["starting_capital"]
        factor = deployment["starting_capital"] / base if base else 1.0
        for p in curve:
            if p["equity"] is None:
                continue
            snapshots.append((str(p["date"])[:10], round(p["equity"] * factor, 2)))

    appended = 0
    with _db_lock:
        conn = _connect()
        try:
            for sig_date, action, symbol, price, shares, reason in new_signals:
                if sig_date > as_of:
                    continue
                cur = conn.execute(
                    "INSERT OR IGNORE INTO forward_signals"
                    " (deployment_id, signal_date, action, symbol, price, shares, reason, created_at)"
                    " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (deployment["id"], sig_date, action, symbol, price, shares, reason, _now()),
                )
                appended += cur.rowcount
            signals_now = conn.execute(
                "SELECT signal_date, action, symbol, price, shares, reason FROM forward_signals"
                " WHERE deployment_id = ? ORDER BY signal_date, id",
                (deployment["id"],),
            ).fetchall()
            open_positions = open_positions_from_signals([dict(r) for r in signals_now])
            for snap_date, equity in snapshots:
                if snap_date > as_of:
                    continue
                conn.execute(
                    "INSERT OR IGNORE INTO forward_equity (deployment_id, date, equity, open_positions)"
                    " VALUES (?, ?, ?, ?)",
                    (deployment["id"], snap_date, equity,
                     json.dumps(open_positions if snap_date == snapshots[-1][0] else [])),
                )
            conn.commit()
        finally:
            conn.close()

    return {"deployment": deployment["slug"], "appended": appended,
            "snapshots": len(snapshots), "error": None}


def run_worker(as_of: Optional[str] = None) -> dict:
    """One worker pass over all active deployments. Safe to re-run any time."""
    as_of = as_of or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    deployments = list_deployments("active")
    results = []
    errors = []
    total_appended = 0
    for dep in deployments:
        try:
            out = process_deployment(dep, as_of)
            results.append(out)
            total_appended += out.get("appended", 0)
            if out.get("error"):
                errors.append(f"{dep['slug']}: {out['error']}")
        except Exception as exc:
            logger.error("worker failed for %s", dep["slug"], exc_info=True)
            errors.append(f"{dep['slug']}: {exc}")

    with _db_lock:
        conn = _connect()
        try:
            conn.execute(
                "INSERT INTO worker_runs (ran_at, as_of, deployments_processed,"
                " signals_appended, errors) VALUES (?, ?, ?, ?, ?)",
                (_now(), as_of, len(deployments), total_appended,
                 json.dumps(errors) if errors else None),
            )
            conn.commit()
        finally:
            conn.close()
    return {"as_of": as_of, "processed": len(deployments),
            "signals_appended": total_appended, "errors": errors, "results": results}


# ── Leaderboard ───────────────────────────────────────────────────────────────

def forward_summary(deployment: dict) -> dict:
    """Forward-performance block for a deployment (leaderboard + strategy page)."""
    equity = get_equity_series(deployment["id"])
    signals = get_signals(deployment["id"])
    days_live = len(equity)
    start_cap = deployment["starting_capital"]
    last_equity = equity[-1]["equity"] if equity else start_cap
    forward_return_pct = (last_equity / start_cap - 1.0) * 100 if start_cap else 0.0
    peak = start_cap
    max_dd = 0.0
    for point in equity:
        peak = max(peak, point["equity"])
        if peak > 0:
            max_dd = max(max_dd, (peak - point["equity"]) / peak * 100)
    spark = [p["equity"] for p in equity][-60:]
    return {
        "days_live": days_live,
        "forward_return_pct": round(forward_return_pct, 2),
        "max_drawdown_pct": round(max_dd, 2),
        "last_equity": last_equity,
        "signal_count": len(signals),
        "open_positions": open_positions_from_signals(signals),
        "sparkline": spark,
        "first_date": equity[0]["date"] if equity else None,
        "last_date": equity[-1]["date"] if equity else None,
    }


def seed_house_templates(
    templates_dir: str,
    deployed_at: Optional[str] = None,
) -> dict:
    """Deploy every template as a house deployment (idempotent by spec hash),
    so the leaderboard is alive before the first user arrives."""
    import json as _json
    from pathlib import Path as _Path

    tdir = _Path(templates_dir)
    stats_path = tdir / "_stats.json"
    cached_stats = _json.loads(stats_path.read_text(encoding="utf-8")) if stats_path.exists() else {}
    existing = {d["spec_hash"] for d in list_deployments("active") if d["owner"] == "house"}
    deployed, skipped = [], []
    for path in sorted(tdir.glob("*.json")):
        if path.name.startswith("_"):
            continue
        doc = _json.loads(path.read_text(encoding="utf-8"))
        spec = doc.get("spec", doc)
        if spec_hash_of(spec) in existing:
            skipped.append(path.stem)
            continue
        dep = create_deployment(
            spec,
            name=doc.get("meta", {}).get("display_name", spec.get("name")),
            owner="house",
            deployed_at=deployed_at,
            backtest_stats=(cached_stats.get(path.stem) or {}).get("stats"),
        )
        deployed.append(dep["slug"])
    return {"deployed": deployed, "skipped": skipped}


def leaderboard(min_days: Optional[int] = None) -> list:
    threshold = MIN_LEADERBOARD_DAYS if min_days is None else min_days
    entries = []
    for dep in list_deployments("active"):
        if dep["visibility"] != "public":
            continue
        summary = forward_summary(dep)
        if summary["days_live"] < threshold:
            continue
        entries.append({
            "slug": dep["slug"],
            "name": dep["name"],
            "owner": dep["owner"],
            "deployed_at": dep["deployed_at"],
            "spec_hash_short": dep["spec_hash"][:12],
            **summary,
        })
    entries.sort(key=lambda e: e["forward_return_pct"], reverse=True)
    return entries
