"""Intraday /deploy gating: plan gate, one-time tiered credit fee, refund.

EOD (1d) deployments stay free within plan slots. Intraday requires pro/max
AND a one-time fee (reason "deploy_intraday", ref = deployment slug, refunded
if the deploy fails after the spend): 100 credits for 15m/30m/60m, 250 for
the premium 1m/5m data class.
"""

import pytest
from fastapi.testclient import TestClient

from service import auth, credits, forward, main


def spec_with_timeframe(timeframe):
    return {
        "name": "Intraday Deploy Test",
        "symbols": ["AAPL", "MSFT"],
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


def make_user(plan):
    return {"id": "user-1", "email": "t@example.com", "plan": plan}


@pytest.fixture
def deploy_env(monkeypatch, tmp_path):
    monkeypatch.setenv("SERVICE_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(auth, "auth_configured", lambda: True)
    monkeypatch.setattr(credits, "enabled_for", lambda user: True)
    monkeypatch.setattr(credits, "balance", lambda user_id: 900)

    spends, refunds = [], []
    monkeypatch.setattr(
        credits, "spend",
        lambda uid, amount, reason, ref=None: spends.append((uid, amount, reason, ref))
        or (True, 900),
    )
    monkeypatch.setattr(
        credits, "refund",
        lambda uid, amount, reason, ref=None: refunds.append((uid, amount, reason, ref)),
    )

    def client_for(plan, run_spec):
        monkeypatch.setattr(
            main.runs_store, "get_run",
            lambda run_id: {"spec": run_spec, "stats": {"total_return_pct": 12.0}},
        )
        main.app.dependency_overrides[main.current_user] = lambda: make_user(plan)
        return TestClient(main.app)

    yield {"client_for": client_for, "spends": spends, "refunds": refunds}
    main.app.dependency_overrides.pop(main.current_user, None)


def test_free_plan_intraday_deploy_403(deploy_env):
    client = deploy_env["client_for"]("free", spec_with_timeframe("15m"))
    resp = client.post("/deploy", json={"run_id": "r1"})
    assert resp.status_code == 403
    assert "Pro" in resp.json()["detail"]
    assert deploy_env["spends"] == []  # plan gate fires before any spend


def test_pro_intraday_deploy_spends_fee_with_slug_ref(deploy_env):
    client = deploy_env["client_for"]("pro", spec_with_timeframe("15m"))
    resp = client.post("/deploy", json={"run_id": "r1"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["deployment"]["timeframe"] == "15m"  # UI badge payload
    assert body["credits_charged"] == credits.INTRADAY_DEPLOY_CREDITS == 100
    assert body["credits_remaining"] == 900

    assert len(deploy_env["spends"]) == 1
    uid, amount, reason, ref = deploy_env["spends"][0]
    assert (uid, amount, reason) == ("user-1", 100, "deploy_intraday")
    assert ref == body["deployment"]["slug"]  # ref = slug -> idempotent retries
    assert deploy_env["refunds"] == []

    # The deployment really froze the intraday spec.
    dep = forward.get_deployment_by_slug(body["deployment"]["slug"])
    assert dep["spec_frozen"]["backtest_timeframe"] == "15m"


def test_intraday_deploy_failure_refunds_fee(deploy_env, monkeypatch):
    client = deploy_env["client_for"]("pro", spec_with_timeframe("30m"))

    def boom(**kwargs):
        raise RuntimeError("disk full")

    monkeypatch.setattr(main.forward, "create_deployment", boom)
    resp = client.post("/deploy", json={"run_id": "r1"})
    assert resp.status_code == 500
    assert "refunded" in resp.json()["detail"]
    assert len(deploy_env["spends"]) == 1
    assert len(deploy_env["refunds"]) == 1
    uid, amount, reason, ref = deploy_env["refunds"][0]
    assert (uid, amount, reason) == ("user-1", 100, "deploy_intraday")
    assert ref == deploy_env["spends"][0][3]  # refund targets the same ref


def test_1m_deploy_charges_premium_fee(deploy_env):
    client = deploy_env["client_for"]("max", spec_with_timeframe("1m"))
    resp = client.post("/deploy", json={"run_id": "r1"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["deployment"]["timeframe"] == "1m"
    assert body["credits_charged"] == credits.INTRADAY_DEPLOY_CREDITS_FAST == 250
    uid, amount, reason, ref = deploy_env["spends"][0]
    assert (uid, amount, reason) == ("user-1", 250, "deploy_intraday")
    assert ref == body["deployment"]["slug"]


def test_5m_deploy_premium_fee_still_needs_plan(deploy_env):
    client = deploy_env["client_for"]("free", spec_with_timeframe("5m"))
    resp = client.post("/deploy", json={"run_id": "r1"})
    assert resp.status_code == 403  # pro/max only, even at the premium fee
    assert deploy_env["spends"] == []

    client = deploy_env["client_for"]("pro", spec_with_timeframe("5m"))
    resp = client.post("/deploy", json={"run_id": "r1"})
    assert resp.status_code == 200
    assert resp.json()["credits_charged"] == 250


def test_eod_deploy_stays_free_on_free_plan(deploy_env):
    client = deploy_env["client_for"]("free", spec_with_timeframe("1d"))
    resp = client.post("/deploy", json={"run_id": "r1"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["deployment"]["timeframe"] == "1d"
    assert body["credits_charged"] == 0
    assert deploy_env["spends"] == []  # EOD deploys carry no credit fee
