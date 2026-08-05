import { describe, expect, it } from "vitest";
import { CLIENT_EVENTS } from "./analytics";

// P0-5 integrity rule: the browser may only ever report VIEW events. The
// /api/t allowlist is built from this constant, so this test is the tripwire
// against someone adding an authoritative funnel event (backtest_run,
// deploy_completed, signup, upgrade_completed, share_link_created,
// ai_message_sent) to the client — those must stay server-emitted or the
// activation/deployment numbers become spoofable from any browser console.
describe("CLIENT_EVENTS", () => {
  it("contains exactly the view events", () => {
    expect([...CLIENT_EVENTS].sort()).toEqual([
      "deploy_started",
      "result_viewed",
      "upgrade_viewed",
    ]);
  });
});
