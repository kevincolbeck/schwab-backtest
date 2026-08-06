"use client";

import { useEffect, useState } from "react";
import { fetchReferral, redeemReferral } from "@/lib/api";
import { clearPendingRef, readPendingRef } from "@/components/ReferralCapture";

interface Status {
  enabled: boolean;
  code: string | null;
  bonus_deployments: number;
  max_bonus?: number;
}

/** §8 referral: "give a friend 1 extra deployment slot, get 1."
 *
 *  Renders NOTHING when the feature is off (no REFERRAL_SECRET configured) —
 *  an empty card promising a code that doesn't exist is worse than no card.
 *  The copy states the cap honestly rather than implying an unlimited lever,
 *  because it is capped and a reader will find that out either way.
 */
export default function ReferralCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let s: Status | null = null;
      try {
        s = await fetchReferral();
      } catch {
        if (!cancelled) setStatus(null);
        return;
      }
      // An invite link stashed a code before this person had an account.
      // Redeem it now, silently: they clicked the link, that IS the intent,
      // and making them re-type a code they never saw would be absurd.
      const pending = readPendingRef();
      if (pending && s?.enabled) {
        try {
          const out = await redeemReferral(pending);
          s = { ...s, bonus_deployments: out.bonus_deployments };
          if (!cancelled) setMsg("Invite applied — you've got an extra deployment slot.");
        } catch {
          /* already redeemed, self-referral, or a bad code — nothing to say. */
        }
        // Clear either way: a code that failed once will fail again, and
        // retrying it on every page load helps nobody.
        clearPendingRef();
      }
      if (!cancelled) setStatus(s);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status?.enabled || !status.code) return null;

  const link = `${window.location.origin}/?ref=${status.code}`;

  return (
    <section className="card mt-6 p-5">
      <h2 className="text-sm font-medium text-ink">Refer a friend</h2>
      <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted">
        Give a friend an extra forward-test deployment slot, and get one
        yourself when they use it. Capped at {status.max_bonus ?? 3} —
        it&rsquo;s a thank-you, not a growth lever.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="tnum rounded-(--radius-tag) border border-hairline bg-panel-2 px-3 py-1.5 text-sm text-ink">
          {status.code}
        </code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* clipboard blocked — the code is visible right there. */
            }
          }}
          className="focus-ring tap-target rounded-(--radius-control) border border-hairline px-3 py-1.5 text-xs text-muted hover:border-hairline-strong hover:text-ink"
        >
          {copied ? "Link copied!" : "Copy invite link"}
        </button>
        <span className="text-caption text-faint">
          {status.bonus_deployments} bonus slot
          {status.bonus_deployments === 1 ? "" : "s"} earned
        </span>
      </div>

      <div className="mt-4 border-t border-hairline pt-4">
        <label htmlFor="ref-code" className="text-caption uppercase tracking-widest text-muted">
          Got a code?
        </label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <input
            id="ref-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABCD1234"
            className="focus-ring tap-target rounded-(--radius-control) border border-hairline bg-panel-2 px-3 py-2 text-sm text-ink placeholder:text-faint"
          />
          <button
            type="button"
            onClick={async () => {
              setMsg(null);
              try {
                const out = await redeemReferral(code);
                setStatus((s) => (s ? { ...s, bonus_deployments: out.bonus_deployments } : s));
                setMsg("Applied — you've got an extra deployment slot.");
              } catch (e) {
                setMsg(e instanceof Error ? e.message : "Couldn't apply that code.");
              }
            }}
            className="focus-ring tap-target rounded-(--radius-control) border border-hairline px-3 py-2 text-sm text-ink hover:border-hairline-strong"
          >
            Redeem
          </button>
        </div>
        {msg && <p className="mt-2 text-caption text-muted">{msg}</p>}
        <p className="mt-2 text-caption text-faint">
          One code per account, and you can&rsquo;t refer yourself.
        </p>
      </div>
    </section>
  );
}
