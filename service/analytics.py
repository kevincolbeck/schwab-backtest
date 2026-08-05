"""Product analytics capture (P0-5 — Section 1 events).

PostHog HTTP capture, deployed DORMANT: without a POSTHOG_KEY env var every
call is a no-op, exactly like the credits system before its SQL landed. When
the key exists, events are queued to a bounded in-memory buffer and shipped by
a single daemon thread — capture() must NEVER block, raise, or slow a request,
and dropping events under pressure is always preferable to backpressure.

Event names are the spec's Section 1 list; servers emit the authoritative
actions (backtest_run, ai_message_sent, deploy_completed, share_link_created
here; signup/upgrade_completed in the web's server routes) and the browser
only ever emits view events through the web /api/t allowlist.

Distinct-id namespace rule (security review): anonymous ids ALWAYS carry an
"anon:" prefix — a client-supplied label must never be able to collide with a
real Supabase user UUID, or forged events become attributable to named
accounts (owner UUIDs are public on the leaderboard).
"""

import atexit
import hashlib
import logging
import os
import queue
import threading
import time
from datetime import datetime, timezone
from typing import Optional

import httpx

from service import env  # noqa: F401

logger = logging.getLogger(__name__)

POSTHOG_HOST = os.getenv("POSTHOG_HOST", "https://us.i.posthog.com")

# Shutdown flush budget: a PostHog outage must never turn SIGTERM into a
# SIGKILL — ship what fits in the window, drop the rest.
EXIT_FLUSH_MAX_EVENTS = 20
EXIT_FLUSH_DEADLINE_SECONDS = 2.0

_queue: "queue.Queue[dict]" = queue.Queue(maxsize=1000)
_worker_started = False
_worker_lock = threading.Lock()
_client: Optional[httpx.Client] = None
_client_lock = threading.Lock()


def enabled() -> bool:
    return bool(os.getenv("POSTHOG_KEY"))


def anon_distinct_id(client_ip: str) -> str:
    """Stable pseudonymous id for anonymous traffic when the browser didn't
    send its first-party analytics id. Salted (ANALYTICS_SALT, falling back to
    the proxy secret) so the 2^32 IPv4 space can't be brute-forced back out of
    exported event data — an unsalted hash is reversible in minutes."""
    salt = os.getenv("ANALYTICS_SALT") or os.getenv("PROXY_SHARED_SECRET") or ""
    digest = hashlib.sha256(f"cb-anon:{salt}:{client_ip}".encode()).hexdigest()[:16]
    return f"anon:{digest}"


def capture(event: str, distinct_id: str, properties: Optional[dict] = None) -> None:
    """Fire-and-forget. Silently drops when analytics is off or the buffer is
    full — analytics must never be load-bearing."""
    if not enabled() or not distinct_id:
        return
    payload = {
        "event": event,
        "distinct_id": distinct_id,
        "properties": {**(properties or {}), "source": "service"},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    try:
        _queue.put_nowait(payload)
    except queue.Full:
        return
    _ensure_worker()


def _ensure_worker() -> None:
    global _worker_started
    if _worker_started:
        return
    with _worker_lock:
        if _worker_started:
            return
        threading.Thread(target=_drain, name="analytics", daemon=True).start()
        _worker_started = True


def _drain() -> None:
    while True:
        _send(_queue.get())


def _http_client() -> httpx.Client:
    """One shared client — a TLS handshake per event caps throughput so low
    that bursts overflow the queue and silently drop."""
    global _client
    with _client_lock:
        if _client is None:
            _client = httpx.Client(timeout=5)
        return _client


def _send(payload: dict) -> None:
    key = os.getenv("POSTHOG_KEY")
    if not key:
        return
    try:
        _http_client().post(f"{POSTHOG_HOST}/capture/", json={"api_key": key, **payload})
    except Exception:
        # Analytics loss is acceptable; noisy logs at error level are not.
        logger.debug("analytics capture failed", exc_info=True)


@atexit.register
def _flush_on_exit() -> None:
    """Best-effort, strictly bounded: ship a handful of queued events inside a
    short deadline, then let the rest drop — never hang shutdown."""
    if not enabled():
        return
    deadline = time.monotonic() + EXIT_FLUSH_DEADLINE_SECONDS
    for _ in range(EXIT_FLUSH_MAX_EVENTS):
        if time.monotonic() >= deadline:
            return
        try:
            _send(_queue.get_nowait())
        except queue.Empty:
            return
