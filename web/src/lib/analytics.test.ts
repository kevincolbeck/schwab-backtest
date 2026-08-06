import { describe, expect, it } from "vitest";
import { CLIENT_EVENTS } from "./analytics";

// P0-5 integrity rule: the browser may only ever report VIEW events. The
// /api/t allowlist is built from this constant, so this test is the tripwire
// against someone adding an authoritative funnel event (backtest_run,
// deploy_completed, signup, upgrade_completed, share_link_created,
// ai_message_sent) to the client — those must stay server-emitted or the
// activation/deployment numbers become spoofable from any browser console.
describe("CLIENT_EVENTS", () => {
  it("contains exactly the view + intent events", () => {
    expect([...CLIENT_EVENTS].sort()).toEqual([
      "deploy_started",
      // §8 demand test. Client-reported and therefore spoofable — which is
      // acceptable ONLY because it measures nothing authoritative: it is a
      // poll about whether to build a Phase 2 feature, and an inflated count
      // misleads us about a roadmap decision, not about activation or
      // revenue. It must never be used as a conversion or activation metric.
      "follow_interest",
      "result_viewed",
      "upgrade_viewed",
    ]);
  });

  it("never lets an authoritative funnel event be client-reported", () => {
    // The actual invariant this file exists to protect: these are emitted by
    // the servers that perform them, so a browser console cannot inflate the
    // activation or deployment numbers the roadmap is steered by.
    const SERVER_ONLY = [
      "backtest_run",
      "deploy_completed",
      "signup",
      "upgrade_completed",
      "share_link_created",
      "ai_message_sent",
    ];
    for (const e of SERVER_ONLY) {
      expect([...CLIENT_EVENTS], `${e} must stay server-emitted`).not.toContain(e);
    }
  });
});
