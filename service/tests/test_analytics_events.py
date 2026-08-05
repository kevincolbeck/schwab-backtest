"""P0-5 analytics: dormant-until-key capture, Section 1 service events, the
admin metrics guard, and the weekly-cohort math.

The contract under test:
- analytics.capture is a silent no-op without POSTHOG_KEY (deploys dormant)
- the four service-authoritative events fire exactly on success paths
- distinct ids: user id when signed in; browser aid header when anonymous
  (shape-validated); hashed IP otherwise — raw IPs never become distinct ids
- /admin/metrics hides without ADMIN_TOKEN, 403s on a bad one
- weekly_cohorts buckets by ISO Monday and rates deployment over ACTIVATED
"""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from service import analytics, auth, credits, main, metrics

USER = {"id": "user-1", "email": "t@example.com", "plan": "free"}


def spec_with(symbols, timeframe="1d"):
    return {
        "name": "Analytics Test",
        "symbols": symbols,
        "indicators": [{"name": "sma_50", "type": "sma", "source": "close", "length": 50}],
        "entry_rule_long": "close > sma_50",
        "exit_rule": "close < sma_50",
        "entry_price_field": "close",
        "backtest_timeframe": timeframe,
        "position_size_mode": "notional_pct",
        "position_size_pct": 25,
        "max_positions": 4,
        "stop_loss_pct": 8,
    }


def _stub_engine(monkeypatch):
    monkeypatch.setattr(
        main.backtest_runner, "run_backtest",
        lambda **kwargs: ({"equity_curve": [], "trades": [], "total_trades": 0},
                          SimpleNamespace(benchmark="SPY")),
    )
    monkeypatch.setattr(main.runs_store, "save_run", lambda *a, **k: "run-analytics")


@pytest.fixture
def events(monkeypatch):
    captured = []
    monkeypatch.setattr(
        analytics, "capture",
        lambda event, distinct_id, properties=None: captured.append(
            (event, distinct_id, properties or {})
        ),
    )
    return captured


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(auth, "auth_configured", lambda: True)
    monkeypatch.setattr(credits, "enabled_for", lambda user: False)
    main.app.dependency_overrides[main.current_user] = lambda: dict(USER)
    try:
        yield TestClient(main.app)
    finally:
        main.app.dependency_overrides.pop(main.current_user, None)


# ── capture() dormancy ───────────────────────────────────────────────────────

def test_capture_is_noop_without_key(monkeypatch):
    monkeypatch.delenv("POSTHOG_KEY", raising=False)
    started = []
    monkeypatch.setattr(analytics, "_ensure_worker", lambda: started.append(True))
    analytics.capture("backtest_run", "u-1", {"x": 1})
    assert started == []  # nothing queued, no worker spawned
    assert analytics._queue.empty()


def test_capture_enqueues_with_key(monkeypatch):
    monkeypatch.setenv("POSTHOG_KEY", "phc_test")
    monkeypatch.setattr(analytics, "_ensure_worker", lambda: None)  # keep it queued
    analytics.capture("backtest_run", "u-1", {"timeframe": "1d"})
    payload = analytics._queue.get_nowait()
    assert payload["event"] == "backtest_run"
    assert payload["distinct_id"] == "u-1"
    assert payload["properties"]["timeframe"] == "1d"
    assert payload["properties"]["source"] == "service"


# ── the four service events ──────────────────────────────────────────────────

def test_backtest_run_event_fires_on_success(client, monkeypatch, events):
    _stub_engine(monkeypatch)
    resp = client.post("/backtest", json={"spec": spec_with(["ZZZA", "ZZZB"])})
    assert resp.status_code == 200
    assert [e[0] for e in events] == ["backtest_run"]
    event, distinct_id, props = events[0]
    assert distinct_id == USER["id"]
    assert props["timeframe"] == "1d"
    assert props["anon"] is False


def test_no_event_on_validation_failure(client, monkeypatch, events):
    resp = client.post("/backtest", json={"spec": {"symbols": []}})
    assert resp.status_code == 422
    assert events == []


def test_ai_message_sent_event_fires(client, monkeypatch, events):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(
        main.chat_brain, "call_claude",
        lambda *a, **k: '{"reply": "hi", "updated_spec": null, "should_rerun": false}',
    )
    resp = client.post("/chat", json={"messages": [{"role": "user", "content": "hello"}]})
    assert resp.status_code == 200
    assert [e[0] for e in events] == ["ai_message_sent"]
    assert events[0][2]["scratch"] is True  # no current_spec sent


def test_share_link_created_event_fires(client, monkeypatch, events):
    monkeypatch.setattr(main.runs_store, "get_run", lambda run_id: {"spec": {}})
    monkeypatch.setattr(main.runs_store, "create_share", lambda run_id, watermarked: "slug1")
    resp = client.post("/share", json={"run_id": "r1"})
    assert resp.status_code == 200
    assert [e[0] for e in events] == ["share_link_created"]
    assert events[0][2]["watermarked"] is True  # free plan watermark


def test_deploy_completed_event_fires(client, monkeypatch, tmp_path, events):
    monkeypatch.setenv("SERVICE_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(
        main.runs_store, "get_run", lambda run_id: {"spec": spec_with(["ZZZA"])}
    )
    resp = client.post("/deploy", json={"run_id": "r1"})
    assert resp.status_code == 200
    assert [e[0] for e in events] == ["deploy_completed"]
    assert events[0][1] == USER["id"]
    assert events[0][2]["timeframe"] == "1d"


# ── anonymous distinct ids ───────────────────────────────────────────────────

def test_anon_distinct_id_prefers_valid_aid_header(client, monkeypatch, events):
    _stub_engine(monkeypatch)
    main.app.dependency_overrides[main.current_user] = lambda: None
    monkeypatch.setattr(main, "_template_hashes", lambda: set())
    monkeypatch.setattr(main, "_within_template_universe", lambda symbols: True)
    # Don't consume the real shared per-IP counter — test_anon_access owns it.
    monkeypatch.setattr(auth, "check_and_count_run", lambda identity, limit: True)
    resp = client.post(
        "/backtest",
        json={"spec": spec_with(["ZZZA"])},
        headers={"x-cb-aid": "0f2a9c1e-aaaa-bbbb-cccc-1234567890ab"},
    )
    assert resp.status_code == 200
    # "anon:" namespace — a client-chosen label must never be able to collide
    # with a real user UUID (owner ids are public on the leaderboard).
    assert events[0][1] == "anon:0f2a9c1e-aaaa-bbbb-cccc-1234567890ab"
    assert events[0][2]["anon"] is True


def test_anon_distinct_id_rejects_garbage_aid(client, monkeypatch, events):
    _stub_engine(monkeypatch)
    main.app.dependency_overrides[main.current_user] = lambda: None
    monkeypatch.setattr(main, "_template_hashes", lambda: set())
    monkeypatch.setattr(main, "_within_template_universe", lambda symbols: True)
    monkeypatch.setattr(auth, "check_and_count_run", lambda identity, limit: True)
    resp = client.post(
        "/backtest",
        json={"spec": spec_with(["ZZZA"])},
        headers={"x-cb-aid": "<script>alert(1)</script>"},
    )
    assert resp.status_code == 200
    assert events[0][1].startswith("anon:")  # hashed-IP fallback
    assert "<" not in events[0][1]


def test_anon_ids_are_hashed_never_raw_ips(monkeypatch):
    distinct = analytics.anon_distinct_id("203.0.113.7")
    assert "203.0.113.7" not in distinct
    assert distinct.startswith("anon:")
    assert distinct == analytics.anon_distinct_id("203.0.113.7")  # stable
    # Salted: exported event data must not be brute-forceable back to an IP.
    monkeypatch.setenv("ANALYTICS_SALT", "different-salt")
    assert analytics.anon_distinct_id("203.0.113.7") != distinct


# ── /admin/metrics guard ─────────────────────────────────────────────────────

def test_admin_metrics_hidden_without_token_env(client, monkeypatch):
    monkeypatch.delenv("ADMIN_TOKEN", raising=False)
    assert client.get("/admin/metrics").status_code == 404


def test_admin_metrics_403_on_bad_token(client, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "secret-token")
    resp = client.get("/admin/metrics", headers={"x-admin-token": "wrong"})
    assert resp.status_code == 403


def test_admin_metrics_200_with_token(client, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "secret-token")
    monkeypatch.setattr(
        metrics, "dashboard",
        lambda force=False: {"cohorts": [], "totals": {"signups": 0}},
    )
    resp = client.get("/admin/metrics", headers={"x-admin-token": "secret-token"})
    assert resp.status_code == 200
    assert resp.json()["totals"]["signups"] == 0


# ── cohort math ──────────────────────────────────────────────────────────────

def _dt(day: str) -> datetime:
    return datetime.fromisoformat(day).replace(tzinfo=timezone.utc)


def test_weekly_cohorts_buckets_and_rates():
    # Wed 2026-07-29 and Thu 2026-07-30 share Monday 2026-07-27; Tue 2026-08-04
    # lands in the 2026-08-03 week.
    signups = [
        ("a", _dt("2026-07-29")),
        ("b", _dt("2026-07-30")),
        ("c", _dt("2026-08-04")),
    ]
    runs = {"a": _dt("2026-07-29"), "c": _dt("2026-08-04")}
    deploys = {"a": _dt("2026-07-30")}
    out = metrics.weekly_cohorts(signups, runs, deploys)

    weeks = {row["week"]: row for row in out["cohorts"]}
    assert set(weeks) == {"2026-07-27", "2026-08-03"}
    july = weeks["2026-07-27"]
    assert (july["signups"], july["activated"], july["deployed"]) == (2, 1, 1)
    assert july["activation_rate"] == 0.5
    assert july["deployment_rate"] == 1.0  # over activated, not signups

    aug = weeks["2026-08-03"]
    assert aug["activation_rate"] == 1.0
    assert aug["deployment_rate"] == 0.0

    totals = out["totals"]
    assert (totals["signups"], totals["activated"], totals["deployed"]) == (3, 2, 1)
    assert totals["deployment_rate"] == 0.5


def test_weekly_cohorts_deploy_without_run_not_counted():
    # Defensive: a deploy row for a user with no owned run must not appear in
    # the deployed count (the spec's funnel is signup → activate → deploy).
    signups = [("a", _dt("2026-08-04"))]
    out = metrics.weekly_cohorts(signups, {}, {"a": _dt("2026-08-05")})
    assert out["totals"]["deployed"] == 0
    assert out["totals"]["deployment_rate"] is None  # no activated users


def test_weekly_cohorts_empty():
    out = metrics.weekly_cohorts([], {}, {})
    assert out["cohorts"] == []
    assert out["totals"]["signups"] == 0
    assert out["totals"]["activation_rate"] is None


def test_cohorts_are_newest_first():
    signups = [(f"u{i}", _dt("2026-07-06") + timedelta(weeks=i)) for i in range(3)]
    out = metrics.weekly_cohorts(signups, {}, {})
    assert [r["week"] for r in out["cohorts"]] == sorted(
        (r["week"] for r in out["cohorts"]), reverse=True
    )


def test_partial_signup_fetch_is_flagged_and_never_cached(monkeypatch):
    # A Supabase failure mid-fetch must surface as signups_partial and skip
    # the cache — a silently-zeroed snapshot rendered as truth for 10 minutes
    # is the failure mode this guards against.
    monkeypatch.setattr(metrics, "_cache", None)
    monkeypatch.setattr(metrics, "first_runs_by_owner", lambda: {})
    monkeypatch.setattr(metrics, "first_deploys_by_owner", lambda: {})
    monkeypatch.setattr(metrics, "fetch_signups", lambda: ([], False))
    out = metrics.dashboard()
    assert out["signups_partial"] is True

    now = datetime.now(timezone.utc)
    monkeypatch.setattr(metrics, "fetch_signups", lambda: ([("u1", now)], True))
    out = metrics.dashboard()  # partial result must not have been cached
    assert out["signups_partial"] is False
    assert out["totals"]["signups"] == 1


def test_first_runs_streams_manifest_without_opening_payloads(monkeypatch, tmp_path):
    # Post-P0-5 manifest rows carry owner inline — the cohort scan must not
    # open per-run payload files for them (each is hundreds of KB). Legacy
    # rows without the key still fall back to the payload.
    import json as _json

    manifest = tmp_path / "backtest_runs.jsonl"
    manifest.write_text(
        _json.dumps({"run_id": "20260805T120000Z_aaaaaaaaaaaa",
                     "timestamp_utc": "2026-08-05T12:00:00+00:00", "owner": "u-new"})
        + "\n"
        + _json.dumps({"run_id": "20260805T130000Z_bbbbbbbbbbbb",
                       "timestamp_utc": "2026-08-05T13:00:00+00:00", "owner": None})
        + "\n"
        + _json.dumps({"run_id": "20260804T090000Z_cccccccccccc"})  # legacy row
        + "\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(metrics.runs_store, "DATA_DIR", tmp_path)
    opened = []

    def fake_get_run(run_id):
        opened.append(run_id)
        return {"owner": "u-legacy"}

    monkeypatch.setattr(metrics.runs_store, "get_run", fake_get_run)
    firsts = metrics.first_runs_by_owner()
    assert set(firsts) == {"u-new", "u-legacy"}
    assert opened == ["20260804T090000Z_cccccccccccc"]  # only the legacy row
