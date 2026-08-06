"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProviderLogo from "@/components/ProviderLogo";
import Button from "@/components/ui/Button";
import { supabaseBrowser } from "@/lib/supabase/client";

// Friendly copy for the ?error= codes the auth callback bounces back with.
const AUTH_ERRORS: Record<string, string> = {
  "oauth-failed":
    "Sign-in with that provider didn't complete — it may have been cancelled or the provider had a hiccup. Try again, or use an email link below.",
  "link-expired":
    "That sign-in link is invalid or has expired. Enter your email and we'll send a fresh one.",
};

// Same provider list the auth modal uses (configured in the Supabase dashboard).
const OAUTH_PROVIDERS = (process.env.NEXT_PUBLIC_OAUTH_PROVIDERS ?? "google,discord")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean) as Array<"google" | "discord" | "twitter">;

const PROVIDER_LABEL: Record<string, string> = {
  google: "Continue with Google",
  discord: "Continue with Discord",
  twitter: "Continue with X",
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

  const oauth = async (provider: "google" | "discord" | "twitter") => {
    if (!supabase || busy) return;
    setBusy(true);
    setError(null);
    // On success the browser navigates away; only failures come back here.
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) {
      setBusy(false);
      setError(err.message);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="text-headline font-semibold text-ink">Sign in</h1>
      <p className="mt-2 text-sm text-muted">
        No password — we email you a magic link. Accounts unlock saved runs and
        deploying strategies to the forward-test ledger.
      </p>
      {authError && !sent && (
        <p
          role="alert"
          className="mt-4 rounded-(--radius-control) border border-hairline bg-loss-soft p-3 text-sm text-loss"
        >
          {authError}
        </p>
      )}
      {!supabase ? (
        <p className="card mt-6 p-4 text-sm text-muted">
          Auth isn&apos;t configured in this environment.
        </p>
      ) : sent ? (
        <div
          role="status"
          className="mt-6 rounded-(--radius-control) border border-accent bg-accent-soft p-4 text-sm"
        >
          Check your email — the sign-in link is on its way to{" "}
          <span className="font-medium">{email}</span>.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {OAUTH_PROVIDERS.length > 0 && (
            <>
              {OAUTH_PROVIDERS.map((p) => (
                <Button
                  key={p}
                  variant="secondary"
                  className="w-full"
                  disabled={busy}
                  onClick={() => oauth(p)}
                >
                  <span className="flex items-center justify-center gap-2.5">
                    <ProviderLogo provider={p} />
                    {PROVIDER_LABEL[p]}
                  </span>
                </Button>
              ))}
              <div className="flex items-center gap-3 py-1 text-caption text-faint">
                <span className="h-px flex-1 bg-hairline" /> or{" "}
                <span className="h-px flex-1 bg-hairline" />
              </div>
            </>
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="you@example.com"
            aria-label="Email address"
            className="focus-ring w-full rounded-(--radius-control) border border-hairline bg-panel tap-target px-3 py-2.5 text-sm placeholder:text-faint focus:border-accent"
          />
          <Button className="w-full" onClick={send} disabled={busy || !email.trim()}>
            {busy ? "Sending…" : "Email me a sign-in link"}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-loss">
              {error}
            </p>
          )}
        </div>
      )}
      <Link
        href="/"
        className="focus-ring mt-8 self-start rounded-(--radius-tag) text-xs text-muted transition-colors duration-(--dur-micro) hover:text-ink"
      >
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
