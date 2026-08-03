"use client";

import Link from "next/link";
import { useState } from "react";

const TIERS = [
  {
    plan: null,
    name: "Free",
    price: "$0",
    tagline: "Starter credits to build your first strategy",
    features: [
      "250 starter credits on signup",
      "All 8 strategy templates",
      "AI chat editing + explanations",
      "Trade-by-trade candle forensics",
      "1 public forward-test deployment",
      "Share links (watermarked)",
    ],
  },
  {
    plan: "pro",
    name: "Pro",
    price: "$29/mo",
    tagline: "For building your own system",
    features: [
      "2,500 credits every month",
      "Up to 100 symbols per run",
      "Intraday timeframes (60m → 1m)",
      "5 forward-test deployments",
      "Private deployments",
      "Clean share links + exports",
    ],
  },
  {
    plan: "max",
    name: "Max",
    price: "$79/mo",
    tagline: "For the obsessed",
    features: [
      "10,000 credits every month",
      "Everything in Pro",
      "Full US-universe backtests (ALL_US)",
      "Crypto markets (X:BTCUSD …)",
      "25 forward-test deployments",
    ],
  },
];

const PACKS = [
  { pack: "small", name: "500 credits", price: "$10" },
  { pack: "large", name: "1,500 credits", price: "$25" },
];

export default function PricingPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkout = async (body: { plan?: string; pack?: string }) => {
    const key = body.plan ?? body.pack ?? "";
    setBusy(key);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.detail ?? "checkout failed");
      window.location.href = out.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "checkout failed");
      setBusy(null);
    }
  };
  const upgrade = (plan: string) => checkout({ plan });

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Simple pricing</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Free is genuinely usable. Paid plans buy more scale and more forward-test
        slots — never “better signals,” because we don&apos;t sell signals.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-loss">
          {error} {error.includes("sign in") && <Link href="/login" className="underline">Sign in</Link>}
        </p>
      )}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {TIERS.map((t) => (
          <div
            key={t.name}
            className={`flex flex-col rounded-xl border p-6 ${
              t.plan === "pro" ? "border-accent/60 bg-accent-soft" : "border-hairline bg-panel"
            }`}
          >
            <h2 className="text-lg font-semibold">{t.name}</h2>
            <div className="tnum mt-1 text-2xl">{t.price}</div>
            <p className="mt-1 text-xs text-muted">{t.tagline}</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-accent">✓</span>
                  <span className="text-muted">{f}</span>
                </li>
              ))}
            </ul>
            {t.plan ? (
              <button
                onClick={() => upgrade(t.plan!)}
                disabled={busy !== null}
                className="mt-6 rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40"
              >
                {busy === t.plan ? "Redirecting…" : `Upgrade to ${t.name}`}
              </button>
            ) : (
              <Link
                href="/playground"
                className="mt-6 rounded-md border border-hairline px-4 py-2 text-center text-sm hover:bg-panel-2"
              >
                Start free
              </Link>
            )}
          </div>
        ))}
      </div>
      <div className="mt-10 rounded-xl border border-hairline bg-panel p-6">
        <h2 className="text-lg font-semibold">Need more credits?</h2>
        <p className="mt-1 text-sm text-muted">
          Top-up packs never expire. Subscriptions are the better deal — packs are
          for the &ldquo;one more idea tonight&rdquo; moments.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {PACKS.map((p) => (
            <button
              key={p.pack}
              onClick={() => checkout({ pack: p.pack })}
              disabled={busy !== null}
              className="focus-ring rounded-[10px] border border-hairline-strong px-4 py-2.5 text-sm hover:bg-panel-2 disabled:opacity-40"
            >
              <span className="tnum font-medium">{p.name}</span>
              <span className="ml-2 text-muted">{busy === p.pack ? "…" : p.price}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-8 text-[11px] text-muted">
        Credits are spent on backtest runs and AI messages (bigger timeframes cost
        more). Cancel anytime through the billing portal. Payments handled by
        Stripe — we never see your card.
      </p>
    </main>
  );
}
