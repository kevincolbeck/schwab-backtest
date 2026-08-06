"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SectionShell from "@/components/SectionShell";
import Card from "@/components/ui/Card";
import Button, { ButtonLink } from "@/components/ui/Button";
import { track } from "@/lib/analytics";
import { PLAN_PRICES, dollars, perMonthDisplay, type Interval, type PaidPlan } from "@/lib/pricing";

/* §5 pricing restructure: flat, capability-gated tiers. No credit counters in
   the core experience — what you buy is what you can DO, and the quiet
   fair-use caps behind the scenes exist to stop scripts, not to be rationed
   against. Copy here must stay true to service/auth.py PLAN_LIMITS. */

const TIERS = [
  {
    plan: null,
    name: "Free",
    tagline: "Genuinely usable, not a countdown to a paywall",
    features: [
      "Unlimited backtests on daily data",
      "The strategy library (12 of 14 run on daily bars)",
      "AI strategy chat — 5 messages/day",
      "1 public forward-test deployment",
      "Trade-by-trade candle forensics",
      "Python + Pine Script export",
      "Share links (watermarked)",
    ],
  },
  {
    plan: "pro",
    name: "Pro",
    tagline: "For building your own system",
    features: [
      "Everything unlimited on daily data",
      "Intraday timeframes down to 1m",
      "Up to 100 symbols per run",
      "10 forward-test deployments",
      "Private deployments",
      "Clean share links (no watermark)",
    ],
  },
  {
    plan: "max",
    name: "Max",
    tagline: "For the obsessed",
    features: [
      "Everything in Pro",
      "Full US-universe backtests (ALL_US)",
      "Crypto markets (X:BTCUSD …)",
      "Unlimited forward-test deployments",
      "Up to 200 symbols per run",
    ],
  },
] as const;
/* Deliberately NOT advertised, because they don't exist yet: §5 lists
   "priority engine", "verified-record badge", "public profile page" and
   "early access" under Max. We don't sell unbuilt features — add the bullets
   in the same commit that ships them. Exports are NOT a paid feature either:
   any signed-in user can export Python/Pine today, so only SHARE LINKS carry
   the free-tier watermark (service/main.py::create_share). */

const PACKS = [
  { pack: "small", name: "500 credits", price: "$10" },
  { pack: "large", name: "1,500 credits", price: "$25" },
];

/** Prices render from lib/pricing.ts — the same numbers checkout verifies
 *  against Stripe before charging, so the page can't advertise one amount
 *  while the card is billed another. */
function Price({ plan, interval }: { plan: PaidPlan | null; interval: Interval }) {
  if (!plan) return <p className="tnum mt-2 text-headline text-ink">$0</p>;
  return (
    <>
      <p className="tnum mt-2 text-headline text-ink">
        ${perMonthDisplay(plan, interval)}
        <span className="ml-1 font-sans text-sm text-muted">/mo</span>
      </p>
      <p className="tnum mt-0.5 text-caption text-faint">
        {interval === "annual"
          ? `$${dollars(PLAN_PRICES[plan].annual)} billed yearly · 2 months free`
          : "billed monthly"}
      </p>
    </>
  );
}

export default function PricingPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState<Interval>("monthly");

  useEffect(() => {
    track("upgrade_viewed");
  }, []);

  const checkout = async (body: { plan?: string; pack?: string; interval?: Interval }) => {
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

  return (
    <main>
      <SectionShell
        headingAs="h1"
        hero
        eyebrow="Pricing · Plans"
        title="Simple pricing. You're paying to build a track record no one can rewrite."
        sub={
          <>
            Free is genuinely usable. Paid unlocks scale, privacy, and tools to
            make a verified record work for you. Research and education only —
            never trade recommendations.
          </>
        }
      >
        {error && (
          <p role="alert" className="mb-6 text-sm text-loss">
            {error}{" "}
            {error.includes("sign in") && (
              <Link href="/login" className="focus-ring rounded-(--radius-tag) underline">
                Sign in
              </Link>
            )}
          </p>
        )}

        {/* Billing-interval toggle. Two real buttons in a radiogroup so it's
            keyboard-operable and screen-reader-legible, not a styled div. */}
        <div
          role="radiogroup"
          aria-label="Billing interval"
          className="mb-8 inline-flex rounded-(--radius-control) border border-hairline p-1"
        >
          {(["monthly", "annual"] as const).map((option) => (
            <button
              key={option}
              role="radio"
              aria-checked={interval === option}
              onClick={() => setInterval(option)}
              className={`focus-ring rounded-(--radius-tag) tap-target px-3.5 py-1.5 text-sm capitalize transition-colors duration-(--dur-micro) ${
                interval === option
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:text-ink"
              }`}
            >
              {option}
              {option === "annual" && (
                <span className="ml-1.5 text-caption text-faint">2 months free</span>
              )}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {TIERS.map((t) => (
            <Card
              key={t.name}
              pad="none"
              featured={t.plan === "pro"}
              className={`flex flex-col p-6 ${t.plan === "pro" ? "border-hairline-strong" : ""}`}
            >
              <h2 className="text-caption uppercase tracking-widest text-muted">{t.name}</h2>
              <Price plan={t.plan} interval={interval} />
              <p className="mt-1.5 text-sm text-muted">{t.tagline}</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2 text-muted">
                    <span aria-hidden>✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {t.plan ? (
                <Button
                  variant={t.plan === "pro" ? "primary" : "secondary"}
                  className="mt-6 w-full"
                  onClick={() => checkout({ plan: t.plan, interval })}
                  disabled={busy !== null}
                >
                  {busy === t.plan ? "Redirecting…" : `Upgrade to ${t.name}`}
                </Button>
              ) : (
                <ButtonLink variant="secondary" href="/playground" className="mt-6 w-full">
                  Start free
                </ButtonLink>
              )}
            </Card>
          ))}
        </div>

        <p className="mt-8 max-w-prose text-sm leading-relaxed text-muted">
          Backtests on daily data are unlimited on every plan, and you&rsquo;ll
          never watch a counter drain while you work. AI messages do carry a
          daily limit — 5 on Free, 15 on Pro, 40 on Max — because model tokens
          are a real per-use cost; the exact numbers are published on{" "}
          <Link
            href="/docs/credits"
            className="focus-ring rounded-(--radius-tag) underline hover:text-ink"
          >
            Plans &amp; limits
          </Link>
          . Cancel anytime through the billing portal. Payments handled by
          Stripe — we never see your card.
        </p>

        <details className="mt-6 max-w-prose">
          <summary className="focus-ring cursor-pointer rounded-(--radius-tag) text-caption text-faint">
            Need headroom beyond fair use?
          </summary>
          <div className="mt-3">
            <p className="text-caption leading-relaxed text-faint">
              Top-up packs add overflow headroom if you ever hit a daily
              fair-use limit — most people never do, and subscribing is the
              better deal if you regularly would. Packs never expire.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {PACKS.map((p) => (
                <Button
                  key={p.pack}
                  variant="secondary"
                  onClick={() => checkout({ pack: p.pack })}
                  disabled={busy !== null}
                >
                  <span className="tnum font-medium">{p.name}</span>
                  <span className="ml-2 text-muted">{busy === p.pack ? "…" : p.price}</span>
                </Button>
              ))}
            </div>
          </div>
        </details>
      </SectionShell>
    </main>
  );
}
