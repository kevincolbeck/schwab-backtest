"""Section 9: "ledger event recorded" is NOT "trade executed".

    "Keep a strict separation between 'ledger event recorded' (what the
     platform does) and 'trade executed' (which never happens on the
     platform). Preserve this boundary in all schema and API design."

The boundary was in good shape when audited — the ledger's event vocabulary is
already event-shaped (`action in (entry, exit, stop, time_exit)`, never
buy/sell/filled/order), no route path contains order/execute/broker, and the
disclaimer rides on every public payload. Exactly one violation had reached a
public surface: the API returned `execution_model` and the strategy page
labelled it "Execution model".

This test is the ratchet. NEW schema and NEW response keys are where a
boundary like this actually breaks, so both are scanned rather than a
hand-maintained list being trusted.

Simulated-trade vocabulary is legitimate and deliberately NOT banned: a
backtest genuinely has trades, entry prices and fills, and they are simulated.
What is banned is naming something in a way that asserts the PLATFORM placed
an order.
"""

import re

import pytest
from fastapi.testclient import TestClient

from service import forward
from service.main import app

client = TestClient(app)

BANNED_COLUMN = re.compile(
    r"(order|fill|execut|broker|commission|routed|\bbuy\b|\bsell\b)", re.I
)

# Every column that legitimately exists today. A NEW column that is not here
# fails the test even if its name looks innocent — the point is to force a
# deliberate decision when the ledger schema grows.
ALLOWED_COLUMNS = {
    "deployments": {
        "id", "slug", "name", "owner", "spec_frozen", "spec_hash", "status",
        "visibility", "starting_capital", "deployed_at", "source_run_id",
        "backtest_stats", "created_at",
        # Section 9 groundwork, inert.
        "creator_id", "follower_count", "subscription_price", "terms",
        "archived_reason", "replaced_by",
    },
    "forward_signals": {
        "id", "deployment_id", "signal_date", "action", "symbol", "price",
        "shares", "reason", "created_at",
    },
    "forward_equity": {"deployment_id", "date", "equity", "open_positions"},
    "forward_returns": {
        "spec_hash", "date", "record_kind", "daily_return_pct",
        "cumulative_return_pct", "recorded_at",
    },
    "worker_runs": {
        "id", "ran_at", "as_of", "deployments_processed", "signals_appended",
        "errors",
    },
}


@pytest.fixture
def ledger(tmp_path, monkeypatch):
    monkeypatch.setenv("SERVICE_DATA_DIR", str(tmp_path))
    conn = forward._connect()
    yield conn
    conn.close()


def test_no_ledger_column_implies_an_order_was_placed(ledger):
    for table, allowed in ALLOWED_COLUMNS.items():
        cols = {row["name"] for row in ledger.execute(f"PRAGMA table_info({table})")}
        assert cols, f"{table} does not exist"
        unexpected = cols - allowed
        assert not unexpected, (
            f"{table} grew {sorted(unexpected)} — if that is intended, add it to "
            "ALLOWED_COLUMNS after checking it does not imply execution"
        )
        for col in cols:
            # record_kind's whole job is to say NOTHING was executed.
            if col == "record_kind":
                continue
            assert not BANNED_COLUMN.search(col), f"{table}.{col} implies execution"


def test_ledger_action_vocabulary_cannot_grow_an_order_verb(ledger):
    """The four legal actions are events, not orders. A 'buy'/'sell'/'filled'
    member would turn the ledger into an order book on paper."""
    actions = set(forward._EXIT_ACTION.values()) | {"entry", "exit"}
    assert actions == {"entry", "exit", "stop", "time_exit"}


def test_forward_returns_states_it_is_simulated(ledger):
    ledger.execute(
        "INSERT INTO forward_returns"
        " (spec_hash, date, daily_return_pct, cumulative_return_pct, recorded_at)"
        " VALUES ('h', '2026-08-06', 1.0, 1.0, 'now')"
    )
    kind = ledger.execute("SELECT record_kind FROM forward_returns").fetchone()[0]
    assert kind == "simulated_forward_return"
    with pytest.raises(Exception):
        ledger.execute(
            "INSERT INTO forward_returns (spec_hash, date, record_kind,"
            " daily_return_pct, cumulative_return_pct, recorded_at)"
            " VALUES ('x', '2026-08-06', 'trade_executed', 0, 0, 'now')"
        )


def test_forward_returns_is_append_only(ledger):
    ledger.execute(
        "INSERT INTO forward_returns"
        " (spec_hash, date, daily_return_pct, cumulative_return_pct, recorded_at)"
        " VALUES ('h', '2026-08-06', 1.0, 1.0, 'now')"
    )
    with pytest.raises(Exception):
        ledger.execute("UPDATE forward_returns SET daily_return_pct = 99")
    with pytest.raises(Exception):
        ledger.execute("DELETE FROM forward_returns")


def test_no_route_path_implies_execution():
    for route in app.routes:
        path = getattr(route, "path", "")
        assert not re.search(r"(order|execut|broker|/buy|/sell)", path, re.I), path


def test_sql_migrations_keep_the_boundary():
    """New Postgres schema is scanned too — the SQLite guard above cannot see
    it, and the two stores are supposed to mirror each other."""
    import pathlib

    root = pathlib.Path(__file__).resolve().parents[2] / "supabase"
    for path in sorted(root.glob("**/*.sql")):
        text = path.read_text(encoding="utf-8")
        # Strip comments — the migrations EXPLAIN the boundary in prose, and
        # that prose necessarily contains the words it forbids.
        body = re.sub(r"--[^\n]*", "", text)
        for m in re.finditer(r"add column if not exists (\w+)|^\s*(\w+)\s+(text|uuid|numeric|integer|boolean|date|timestamptz|double precision)",
                             body, re.I | re.M):
            col = m.group(1) or m.group(2)
            if not col or col.lower() in {"record_kind", "create", "table", "primary", "constraint"}:
                continue
            assert not BANNED_COLUMN.search(col), f"{path.name}: column {col} implies execution"


def test_public_payloads_never_name_execution():
    """The assertion that failed before `execution_model` was renamed."""
    banned_key = re.compile(r"(execut|order|broker|filled)", re.I)

    def walk(node, path="$"):
        if isinstance(node, dict):
            for k, v in node.items():
                assert not banned_key.search(k), f"{path}.{k} implies execution"
                walk(v, f"{path}.{k}")
        elif isinstance(node, list):
            for i, v in enumerate(node):
                walk(v, f"{path}[{i}]")

    res = client.get("/leaderboard")
    assert res.status_code == 200
    walk(res.json())
