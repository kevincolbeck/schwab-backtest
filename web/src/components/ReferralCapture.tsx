"use client";

import { useEffect } from "react";

/** Captures a `?ref=CODE` invite link so it survives until the visitor has an
 *  account to attach it to.
 *
 *  The link lands on the marketing site, where the visitor is by definition
 *  signed out — there is no account yet to credit. Without this the code was
 *  simply dropped on arrival, which made the "Copy invite link" button a lie:
 *  it produced a URL that did nothing, and the friend would have had to
 *  notice the code in the query string and paste it in by hand.
 *
 *  Stashed in localStorage rather than a cookie because nothing server-side
 *  reads it, and redeemed by ReferralCard once the user is signed in. 30-day
 *  expiry so a stale code can't attach itself to an unrelated signup months
 *  later.
 */

export const PENDING_REF_KEY = "cb_pending_ref";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function readPendingRef(): string | null {
  try {
    const raw = localStorage.getItem(PENDING_REF_KEY);
    if (!raw) return null;
    const { code, at } = JSON.parse(raw) as { code: string; at: number };
    if (!code || Date.now() - at > MAX_AGE_MS) {
      localStorage.removeItem(PENDING_REF_KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function clearPendingRef() {
  try {
    localStorage.removeItem(PENDING_REF_KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

export default function ReferralCapture() {
  useEffect(() => {
    try {
      const code = new URLSearchParams(window.location.search).get("ref");
      if (!code) return;
      // Codes are 8 hex chars by construction (service/referrals.py). Reject
      // anything else rather than storing arbitrary query input.
      if (!/^[0-9A-F]{8}$/i.test(code)) return;
      // First code wins: someone already carrying an invite shouldn't have it
      // overwritten by a later link.
      if (!readPendingRef()) {
        localStorage.setItem(
          PENDING_REF_KEY,
          JSON.stringify({ code: code.toUpperCase(), at: Date.now() }),
        );
      }
    } catch {
      /* storage blocked — the code can still be entered by hand */
    }
  }, []);

  return null;
}
