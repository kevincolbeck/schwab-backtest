"""The /templates/{id}/curve endpoint behind the Section 4 strategy pages.

The downsample invariant is the one worth pinning: the chart on a public page
must never be able to flatter the record by dropping its trough.
"""

import json

import pytest
from fastapi.testclient import TestClient

from service.main import app
from scripts.build_template_stats import _downsample

client = TestClient(app)


def test_known_template_returns_a_curve():
    body = client.get("/templates/golden-cross/curve").json()
    assert body["found"] is True
    assert len(body["points"]) > 50
    assert {"d", "e", "dd"} <= set(body["points"][0])


def test_unknown_template_is_found_false_not_an_error():
    body = client.get("/templates/no-such-template/curve").json()
    assert body["found"] is False
    assert body["points"] == []


@pytest.mark.parametrize("bad", ["..%2F..%2Fetc%2Fpasswd", "UPPER", "with space"])
def test_path_traversal_and_junk_are_rejected(bad):
    assert client.get(f"/templates/{bad}/curve").status_code == 404


def test_downsample_keeps_the_deepest_drawdown():
    # A trough hidden mid-series is exactly what an even-stride sample drops.
    curve = [{"date": f"d{i}", "equity": 100.0, "drawdown_pct": 1.0} for i in range(1000)]
    curve[437]["drawdown_pct"] = 62.5
    out = _downsample(curve, target=50)
    assert max(p["dd"] for p in out) == 62.5, "the trough must survive downsampling"


def test_downsample_keeps_both_endpoints():
    curve = [{"date": f"d{i}", "equity": float(i), "drawdown_pct": 0.0} for i in range(1000)]
    out = _downsample(curve, target=40)
    assert out[0]["d"] == "d0"
    assert out[-1]["d"] == "d999"


def test_downsample_passes_short_curves_through():
    curve = [{"date": f"d{i}", "equity": 1.0, "drawdown_pct": 0.0} for i in range(9)]
    assert len(_downsample(curve, target=180)) == 9


def test_every_shipped_template_has_a_curve():
    # A template without a curve renders a page with a hole in it.
    from service.main import TEMPLATES_DIR

    ids = {p.stem for p in TEMPLATES_DIR.glob("*.json") if not p.name.startswith("_")}
    curves = json.loads((TEMPLATES_DIR / "_curves.json").read_text(encoding="utf-8"))
    assert ids <= set(curves), f"missing curves: {ids - set(curves)}"
