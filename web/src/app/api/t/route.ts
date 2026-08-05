import { after } from "next/server";
import { CLIENT_EVENTS } from "@/lib/analytics";
import { captureServer } from "@/lib/server/analytics";
import { serverSession } from "@/lib/supabase/server";

// First-party analytics beacon (P0-5). The browser may only report VIEW-ish
// events — authoritative funnel actions (backtest_run, deploy_completed,
// signup, upgrade_completed, …) are emitted by the servers that perform them,
// so a page can't inflate activation or deployment numbers.
const ALLOWED = new Set<string>(CLIENT_EVENTS);

const MAX_BODY_CHARS = 2048;

// Cheap per-IP throttle: each accepted beacon is a billable PostHog event and
// (inside after()) a Supabase session lookup, so an unauthenticated loop must
// hit a wall. Per-instance memory is fine — Vercel instances are few and an
// attacker crossing instances still divides into these buckets.
const BUCKET_LIMIT = 60; // events per window per IP
const BUCKET_WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

function throttled(ip: string): boolean {
  const now = Date.now();
  if (buckets.size > 10_000) buckets.clear(); // bound the map, worst case = brief amnesty
  const bucket = buckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + BUCKET_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > BUCKET_LIMIT;
}

export async function POST(request: Request) {
  // Always 204 — the page must never care whether analytics is on, valid, or
  // reachable. Bad payloads are dropped, not argued with.
  const done = new Response(null, { status: 204 });
  try {
    // Browser beacons from our own pages send Origin (sendBeacon/fetch POST
    // always do) or Sec-Fetch-Site; anything else — curl loops, cross-site
    // pages — is not our telemetry. This is spam control, not auth.
    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    const sameOrigin = origin
      ? origin === new URL(request.url).origin
      : fetchSite === "same-origin";
    if (!sameOrigin) return done;

    const length = Number(request.headers.get("content-length") ?? "0");
    if (!Number.isFinite(length) || length <= 0 || length > MAX_BODY_CHARS) return done;

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (throttled(ip)) return done;

    const raw = await request.text();
    if (!raw || raw.length > MAX_BODY_CHARS) return done;
    const { event, props, aid } = JSON.parse(raw) as {
      event?: string;
      props?: Record<string, unknown>;
      aid?: string | null;
    };
    if (!event || !ALLOWED.has(event)) return done;

    // "anon:" namespace — a caller-chosen label must never collide with a
    // real user UUID (owner ids are public on the leaderboard, and unprefixed
    // ids would let forged events be attributed to named accounts).
    const anonId =
      typeof aid === "string" && /^[a-z0-9-]{8,64}$/i.test(aid) ? `anon:${aid}` : null;

    // Cap and flatten props defensively — beacons are unauthenticated input.
    const safeProps: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props ?? {}).slice(0, 10)) {
      if (["string", "number", "boolean"].includes(typeof v)) {
        safeProps[k.slice(0, 40)] = typeof v === "string" ? v.slice(0, 200) : v;
      }
    }

    // Session resolution inside after(): route handlers may read cookies()
    // there (per the after() docs), and it keeps the 204 instant instead of
    // paying a Supabase round-trip per beacon.
    after(async () => {
      const session = await serverSession().catch(() => null);
      const distinctId = session?.user.id ?? anonId;
      if (!distinctId) return;
      if (session && anonId) safeProps.aid = anonId;
      await captureServer(event, distinctId, safeProps);
    });
  } catch {
    /* malformed beacon — drop */
  }
  return done;
}
