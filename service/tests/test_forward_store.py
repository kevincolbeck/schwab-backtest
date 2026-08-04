"""Unit tests for the forward-test store: immutability, idempotency, math."""

import json

import pytest

from service import forward


@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    monkeypatch.setenv("SERVICE_DATA_DIR", str(tmp_path))
    yield


SPEC = {
    "name": "Golden Cross",
    "symbols": ["SPY"],
    "entry_rule_long": "sma_50 > sma_200",
    "exit_rule": "sma_50 < sma_200",
    "backtest_timeframe": "1d",
}


def test_create_deployment_freezes_spec_and_hash():
    dep = forward.create_deployment(SPEC, deployed_at="2026-06-01")
    assert dep["spec_frozen"] == SPEC
    assert dep["spec_hash"] == forward.spec_hash_of(SPEC)
    assert dep["slug"].startswith("golden-cross-")
    assert dep["status"] == "active"
    assert dep["visibility"] == "public"


def test_duplicate_names_get_distinct_slugs():
    a = forward.create_deployment(SPEC, deployed_at="2026-06-01")
    b = forward.create_deployment(SPEC, deployed_at="2026-06-01")
    assert a["slug"] != b["slug"]
    assert forward.get_deployment_by_slug(a["slug"])["id"] == a["id"]
    assert forward.get_deployment_by_slug(b["slug"])["id"] == b["id"]


def test_signal_append_is_idempotent():
    dep = forward.create_deployment(SPEC, deployed_at="2026-06-01")
    conn = forward._connect()
    row = (dep["id"], "2026-06-05", "entry", "SPY", 500.0, 40.0, "RULE_LONG", forward._now())
    for _ in range(3):  # same (deployment, date, action, symbol) three times
        conn.execute(
            "INSERT OR IGNORE INTO forward_signals"
            " (deployment_id, signal_date, action, symbol, price, shares, reason, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?)", row,
        )
    conn.commit()
    conn.close()
    assert len(forward.get_signals(dep["id"])) == 1


def test_ledger_has_no_mutation_api():
    """The module exposes no update/delete for ledger rows — append-only by
    construction (Postgres additionally revokes UPDATE/DELETE in production)."""
    public_api = [name for name in dir(forward) if not name.startswith("_")]
    for name in public_api:
        assert "update" not in name.lower() and "delete" not in name.lower()


def test_exit_action_mapping():
    assert forward._exit_action("RULE_EXIT") == "exit"
    assert forward._exit_action("TAKE_PROFIT") == "exit"
    assert forward._exit_action("TP_RULE_1") == "exit"
    assert forward._exit_action("STOP_LOSS") == "stop"
    assert forward._exit_action("TIME_EXIT") == "time_exit"
    assert forward._exit_action("END_OF_TEST") is None  # still open, not an exit


def test_open_positions_from_signals():
    signals = [
        {"action": "entry", "symbol": "SPY", "signal_date": "2026-06-05", "price": 500.0, "shares": 40},
        {"action": "entry", "symbol": "QQQ", "signal_date": "2026-06-08", "price": 400.0, "shares": 50},
        {"action": "exit", "symbol": "SPY", "signal_date": "2026-06-20", "price": 510.0, "shares": 40},
    ]
    open_pos = forward.open_positions_from_signals(signals)
    assert len(open_pos) == 1
    assert open_pos[0]["symbol"] == "QQQ"


def test_forward_summary_math():
    dep = forward.create_deployment(SPEC, deployed_at="2026-06-01", starting_capital=100_000)
    conn = forward._connect()
    for day, equity in [("2026-06-01", 100000), ("2026-06-02", 104000),
                        ("2026-06-03", 98800), ("2026-06-04", 106000)]:
        conn.execute(
            "INSERT OR IGNORE INTO forward_equity (deployment_id, date, equity, open_positions)"
            " VALUES (?, ?, ?, '[]')", (dep["id"], day, equity),
        )
    conn.commit()
    conn.close()
    s = forward.forward_summary(dep)
    assert s["days_live"] == 4
    assert s["forward_return_pct"] == 6.0
    assert s["max_drawdown_pct"] == 5.0  # 104000 -> 98800
    assert s["sparkline"][-1] == 106000


def test_leaderboard_filters_and_ranks():
    a = forward.create_deployment({**SPEC, "name": "A"}, deployed_at="2026-06-01")
    b = forward.create_deployment({**SPEC, "name": "B"}, deployed_at="2026-06-01")
    c = forward.create_deployment({**SPEC, "name": "C"}, deployed_at="2026-06-01",
                                  visibility="private")
    conn = forward._connect()
    for dep, final in ((a, 105000), (b, 111000), (c, 150000)):
        for i, eq in enumerate([100000] * 24 + [final]):
            conn.execute(
                "INSERT OR IGNORE INTO forward_equity (deployment_id, date, equity, open_positions)"
                " VALUES (?, ?, ?, '[]')", (dep["id"], f"2026-06-{i+1:02d}", eq),
            )
    conn.commit()
    conn.close()
    board = forward.leaderboard(min_days=20)
    slugs = [e["slug"] for e in board]
    assert c["slug"] not in slugs          # private stays off the board
    assert slugs == [b["slug"], a["slug"]]  # ranked by forward return
    assert board[0]["forward_return_pct"] == 11.0
    assert forward.leaderboard(min_days=30) == []  # min-days gate


def test_leaderboard_entries_carry_backtest_stats():
    stats = {"sharpe": 1.32, "cagr": 29.42, "max_drawdown": 23.97}
    forward.create_deployment(SPEC, deployed_at="2026-06-01", backtest_stats=stats)
    entries = forward.leaderboard(min_days=0)
    assert entries[0]["backtest_stats"] == stats
    assert entries[0]["starting_capital"] == 100_000


def test_leaderboard_backtest_stats_null_when_absent():
    forward.create_deployment(SPEC, deployed_at="2026-06-01")
    assert forward.leaderboard(min_days=0)[0]["backtest_stats"] is None
