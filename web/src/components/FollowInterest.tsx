"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

/** §8 demand test: "Coming soon: follow top strategies".
 *
 *  Deliberately captures NOTHING. The spec's stated purpose is "measures
 *  demand before any build", and a click rate answers that. An email list
 *  would not, and this codebase cannot lawfully mail one: there is no consent
 *  record, no unsubscribe mechanism, no suppression list, no privacy policy
 *  and no terms page (established by the P1-4 audit — docs/P1-4-EMAIL-PLAN.md).
 *  Collecting addresses we can't use is a liability, not a signal.
 *
 *  The copy is honestly coming-soon and must stay carefully non-advisory:
 *  following a record is not a recommendation, and this platform does not and
 *  will not tell anyone what to trade.
 */
export default function FollowInterest() {
  const [registered, setRegistered] = useState(false);

  return (
    <div className="mt-6 rounded-(--radius-card) border border-dashed border-hairline-strong p-5">
      <p className="text-caption uppercase tracking-widest text-muted">
        Coming soon
      </p>
      {registered ? (
        <>
          <p className="mt-1.5 text-sm font-medium text-ink">
            Noted — thanks.
          </p>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            We counted your interest and nothing else — no email, no signup. If
            enough people want this, we&rsquo;ll build it and it&rsquo;ll show
            up here.
          </p>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-sm font-medium text-ink">
            Follow top strategies
          </p>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            Get notified when a record you care about posts a new day. It
            doesn&rsquo;t exist yet, and we&rsquo;re measuring whether it should
            before building it. Following a record would be a way to watch it —
            never a recommendation to trade it.
          </p>
          <button
            type="button"
            onClick={() => {
              track("follow_interest", { surface: "leaderboard" });
              setRegistered(true);
            }}
            className="focus-ring tap-target mt-3 inline-flex items-center rounded-(--radius-control) border border-hairline bg-panel px-4 py-2 text-sm text-ink hover:border-hairline-strong"
          >
            I&rsquo;d use this
          </button>
          <p className="mt-2 text-caption text-faint">
            One click. No email, no account, nothing stored about you.
          </p>
        </>
      )}
    </div>
  );
}
