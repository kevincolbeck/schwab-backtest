/** Client-side product analytics (P0-5 — Section 1 events).
 *
 * The browser only ever emits VIEW-ish events (result_viewed, upgrade_viewed,
 * deploy_started) as first-party beacons to /api/t, which allowlists them and
 * forwards server-side to PostHog. Authoritative action events (backtest_run,
 * ai_message_sent, deploy_completed, signup, upgrade_completed,
 * share_link_created) are emitted by the servers that perform them — a page
 * can't inflate the funnel.
 *
 * Everything here is fail-silent and dormant: without a POSTHOG_KEY on the
 * server the beacons are dropped at /api/t. No third-party script, no
 * autocapture, no fingerprinting — one random first-party id (cb_aid),
 * mirrored into a cookie so server routes (signup) can link the pre-signup
 * journey to the account.
 */

export const AID_KEY = "cb_aid";

/** Client events /api/t will accept — keep in sync with its allowlist. */
export const CLIENT_EVENTS = [
  "result_viewed",
  "upgrade_viewed",
  "deploy_started",
  // §8 demand test for Phase 2 "follow top strategies". A click is the whole
  // measurement — deliberately no email capture, because there is no consent
  // record, no unsubscribe, no suppression list and no privacy policy in this
  // codebase yet (see docs/P1-4-EMAIL-PLAN.md). Collecting addresses we cannot
  // lawfully mail is worse than counting clicks.
  "follow_interest",
] as const;
export type ClientEvent = (typeof CLIENT_EVENTS)[number];

/** Stable first-party anonymous id (localStorage + cookie mirror). */
export function anonymousId(): string | null {
  try {
    let aid = window.localStorage.getItem(AID_KEY);
    // The auth callback sets cb_aid_rotate after a signup: regenerate so a
    // shared machine's next visitor doesn't inherit an id already linked to
    // the previous account.
    const rotate = document.cookie.includes("cb_aid_rotate=1");
    if (rotate) {
      document.cookie = "cb_aid_rotate=; path=/; max-age=0";
    }
    if (rotate || !aid || !/^[a-z0-9-]{8,64}$/i.test(aid)) {
      aid = crypto.randomUUID();
      window.localStorage.setItem(AID_KEY, aid);
    }
    // Cookie mirror: lets the auth callback link pre-signup activity to the
    // new account. First-party, no cross-site use — SameSite=Lax.
    document.cookie = `${AID_KEY}=${aid}; path=/; max-age=31536000; samesite=lax`;
    return aid;
  } catch {
    return null;
  }
}

/** Fire-and-forget beacon. Never throws, never blocks navigation. */
export function track(event: ClientEvent, props: Record<string, unknown> = {}): void {
  try {
    const body = JSON.stringify({ event, props, aid: anonymousId() });
    if (navigator.sendBeacon?.("/api/t", new Blob([body], { type: "application/json" }))) {
      return;
    }
    fetch("/api/t", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* analytics must never break the page */
  }
}
