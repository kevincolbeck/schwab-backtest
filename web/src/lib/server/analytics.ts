/** Server-side PostHog capture for the web tier (P0-5).
 *
 * Dormant without POSTHOG_KEY (server-only env — never NEXT_PUBLIC). Callers
 * wrap invocations in next/server `after()` so a capture round-trip never
 * delays a response; every failure is swallowed — analytics is not
 * load-bearing.
 */

import { createHash } from "node:crypto";

const HOST = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";

export function analyticsEnabled(): boolean {
  return Boolean(process.env.POSTHOG_KEY);
}

/** Deterministic event uuid from a stable source id (e.g. a Stripe session
 * id). PostHog dedupes same-day events sharing a uuid, which makes
 * at-least-once webhook redelivery not double-count conversions. */
export function eventUuid(source: string): string {
  const hex = createHash("sha1").update(`cb-event:${source}`).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`, // version nibble → valid UUIDv5 shape
    `8${hex.slice(17, 20)}`, // variant nibble
    hex.slice(20, 32),
  ].join("-");
}

async function post(body: Record<string, unknown>): Promise<void> {
  const key = process.env.POSTHOG_KEY;
  if (!key) return;
  try {
    await fetch(`${HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: key, timestamp: new Date().toISOString(), ...body }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    /* analytics loss is acceptable */
  }
}

export async function captureServer(
  event: string,
  distinctId: string,
  properties: Record<string, unknown> = {},
  uuid?: string,
): Promise<void> {
  if (!distinctId) return;
  await post({
    event,
    distinct_id: distinctId,
    properties: { ...properties, source: "web" },
    ...(uuid ? { uuid } : {}),
  });
}

/** Link a pre-signup anonymous journey ("anon:<aid>") to the new account.
 * Uses $identify with $anon_distinct_id — unlike $create_alias it is designed
 * for anon→identified and won't permanently merge two REAL people when a
 * shared browser reuses an anonymous id (PostHog refuses already-identified
 * anon ids on this path). */
export async function identifyServer(userId: string, anonDistinctId: string): Promise<void> {
  if (!userId || !anonDistinctId || userId === anonDistinctId) return;
  await post({
    event: "$identify",
    distinct_id: userId,
    properties: { $anon_distinct_id: anonDistinctId, source: "web" },
  });
}
