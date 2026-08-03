"""Tests for owner display-identity resolution (Phase G).

Privacy contract pinned here: metadata-name precedence, email local-part
fallback with the domain stripped, the fixed 'house' mapping (no HTTP), and
graceful None on any lookup failure.
"""

import pytest

from service import auth, identity


class FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload


def install_fake_client(monkeypatch, payloads, calls):
    """Patch identity.httpx.Client with a canned admin-users endpoint.

    payloads: user_id -> user object returned with 200; unknown ids get 404.
    Every fetched URL is appended to calls.
    """

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def get(self, url, headers=None):
            calls.append(url)
            user_id = url.rsplit("/", 1)[-1]
            if user_id in payloads:
                return FakeResponse(200, payloads[user_id])
            return FakeResponse(404)

    monkeypatch.setattr(identity.httpx, "Client", FakeClient)


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setattr(identity, "_cache", {})
    monkeypatch.setattr(auth, "auth_configured", lambda: True)
    monkeypatch.setattr(auth, "SUPABASE_URL", "https://sb.example")
    monkeypatch.setattr(auth, "SUPABASE_SERVICE_KEY", "service-key")


def test_house_maps_without_http(monkeypatch):
    calls = []
    install_fake_client(monkeypatch, {}, calls)
    assert identity.resolve("house") == {"display_name": "House", "avatar_url": None}
    assert calls == []


@pytest.mark.parametrize(
    "meta,email,expected",
    [
        ({"full_name": "Kevin C", "name": "kev", "user_name": "kc"}, "x@y.com", "Kevin C"),
        ({"name": "kev", "user_name": "kc"}, "x@y.com", "kev"),
        ({"user_name": "kc", "preferred_username": "kevy"}, "x@y.com", "kc"),
        ({"preferred_username": "kevy"}, "x@y.com", "kevy"),
        ({}, "colbeck@example.com", "colbeck"),  # local-part only, domain stripped
        ({"full_name": "   "}, "colbeck@example.com", "colbeck"),  # blank name skipped
    ],
)
def test_display_name_precedence(monkeypatch, meta, email, expected):
    calls = []
    install_fake_client(monkeypatch, {"u1": {"email": email, "user_metadata": meta}}, calls)
    ident = identity.resolve("u1")
    assert ident["display_name"] == expected
    assert "@" not in ident["display_name"]  # an email address never leaks


def test_avatar_precedence(monkeypatch):
    calls = []
    install_fake_client(monkeypatch, {
        "u1": {"email": "a@b.com", "user_metadata": {
            "avatar_url": "https://img/av.png", "picture": "https://img/pic.png"}},
        "u2": {"email": "a@b.com", "user_metadata": {"picture": "https://img/pic.png"}},
        "u3": {"email": "a@b.com", "user_metadata": {}},
    }, calls)
    assert identity.resolve("u1")["avatar_url"] == "https://img/av.png"
    assert identity.resolve("u2")["avatar_url"] == "https://img/pic.png"
    assert identity.resolve("u3")["avatar_url"] is None


def test_lookup_failure_returns_none(monkeypatch):
    calls = []
    install_fake_client(monkeypatch, {}, calls)  # every id 404s
    assert identity.resolve("missing-user") is None
    assert len(calls) == 1


def test_transport_failure_returns_none(monkeypatch):
    class Down:
        def __init__(self, *args, **kwargs):
            raise RuntimeError("connection refused")

    monkeypatch.setattr(identity.httpx, "Client", Down)
    assert identity.resolve("u1") is None


def test_unconfigured_auth_skips_http(monkeypatch):
    monkeypatch.setattr(auth, "auth_configured", lambda: False)
    calls = []
    install_fake_client(monkeypatch, {"u1": {"email": "a@b.com"}}, calls)
    assert identity.resolve("u1") is None
    assert calls == []


def test_resolve_many_batches_through_warm_cache(monkeypatch):
    calls = []
    install_fake_client(monkeypatch, {
        "u1": {"email": "a@b.com", "user_metadata": {"full_name": "A"}},
        "u2": {"email": "c@d.com", "user_metadata": {"full_name": "B"}},
    }, calls)
    first = identity.resolve_many(["u1", "u2", "house", "u1"])
    assert first["u1"]["display_name"] == "A"
    assert first["house"]["display_name"] == "House"
    assert len(calls) == 2  # one fetch per unique non-house id

    second = identity.resolve_many(["u1", "u2", "house"])
    assert second["u2"]["display_name"] == "B"
    assert len(calls) == 2  # warm cache: zero additional HTTP
