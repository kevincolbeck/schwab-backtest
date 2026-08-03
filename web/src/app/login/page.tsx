"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

// Friendly copy for the ?error= codes the auth callback bounces back with.
const AUTH_ERRORS: Record<string, string> = {
  "oauth-failed":
    "Sign-in with that provider didn't complete — it may have been cancelled or the provider had a hiccup. Try again, or use an email link below.",
  "link-expired":
    "That sign-in link is invalid or has expired. Enter your email and we'll send a fresh one.",
};

function LoginInner() {
  const searchParams = useSearchParams();
  const authError = AUTH_ERRORS[searchParams.get("error") ?? ""] ?? null;
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = supabaseBrowser();

  const send = async () => {
    if (!supabase || !email.trim() || busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (err) setError(err.message);
    else setSent(true);
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-muted">
        No password — we email you a magic link. Accounts unlock saved runs and
        deploying strategies to the forward-test ledger.
      </p>
      {authError && !sent && (
        <p role="alert" className="mt-4 rounded-lg border border-hairline bg-loss-soft p-3 text-sm text-loss">
          {authError}
        </p>
      )}
      {!supabase ? (
        <p className="mt-6 rounded-lg border border-hairline bg-panel p-4 text-sm text-muted">
          Auth isn&apos;t configured in this environment.
        </p>
      ) : sent ? (
        <div role="status" className="mt-6 rounded-lg border border-accent/40 bg-accent-soft p-4 text-sm">
          Check your email — the sign-in link is on its way to{" "}
          <span className="font-medium">{email}</span>.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="you@example.com"
            aria-label="Email address"
            className="w-full rounded-md border border-hairline bg-panel px-3 py-2.5 text-sm placeholder:text-muted focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <button
            onClick={send}
            disabled={busy || !email.trim()}
            className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40"
          >
            {busy ? "Sending…" : "Email me a sign-in link"}
          </button>
          {error && (
            <p role="alert" className="text-sm text-loss">
              {error}
            </p>
          )}
        </div>
      )}
      <Link href="/" className="mt-8 text-xs text-muted hover:text-ink">
        ← Back to the playground
      </Link>
    </main>
  );
}

export default function LoginPage() {
  // useSearchParams requires a Suspense boundary (same pattern as /playground).
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}
