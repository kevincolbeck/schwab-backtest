"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SectionShell from "@/components/SectionShell";
import Card from "@/components/ui/Card";
import Button, { ButtonLink } from "@/components/ui/Button";
import { track } from "@/lib/analytics";

const TIERS = [
  {
    plan: null,
    name: "Free",
    price: "$0",
    tagline: "Everything you need to prove an idea",
    features: [
      "Unlimited backtests on daily data",
      "The full strategy library",
      "1 live forward-test deployment (public)",
      "AI chat editing + explanations (starter allowance)",
      "Trade-by-trade candle forensics",
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
      "Intraday forward-test deployments",
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

/** Split "$29/mo" so the amount is the mono hero and the period whispers. */
function Price({ price }: { price: string }) {
  const [amount, period] = price.split("/");
  return (
    <p className="tnum mt-2 text-headline text-ink">
      {amount}
      {period && <span className="ml-1 font-sans text-sm text-muted">/{period}</span>}
    </p>
  );
}

export default function PricingPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track("upgrade_viewed");
  }, []);

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
    <main>
      <SectionShell
        headingAs="h1"
        hero
        eyebrow="Pricing · Plans & credits"
        title="Simple pricing"
        sub={
          <>
            Free is genuinely usable. Paid plans buy more scale and more
            forward-test slots — never &ldquo;better signals,&rdquo; because we
            don&apos;t sell signals.
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

        <div className="grid gap-4 md:grid-cols-3">
          {TIERS.map((t) => (
            <Card
              key={t.name}
              pad="none"
              featured={t.plan === "pro"}
              className={`flex flex-col p-6 ${t.plan === "pro" ? "border-hairline-strong" : ""}`}
            >
              <h2 className="text-caption uppercase tracking-widest text-muted">{t.name}</h2>
              <Price price={t.price} />
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
                  onClick={() => upgrade(t.plan!)}
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

        <Card className="mt-6" pad="none">
          <div className="p-6">
            <h2 className="text-sm font-medium text-ink">Need more credits?</h2>
            <p className="mt-1 text-sm text-muted">
              Top-up packs never expire. Subscriptions are the better deal — packs
              are for the &ldquo;one more idea tonight&rdquo; moments.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
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
        </Card>

        <p className="mt-8 max-w-prose text-caption leading-relaxed text-faint">
          Daily-data backtests — every template and any universe up to 10
          symbols — are free on every plan, with no meter attached.
          &ldquo;Unlimited&rdquo; on Free means exactly that for a human: a
          generous daily fair-use cap exists only to stop scripts. Included
          usage covers the genuinely expensive things: intraday timeframes,
          custom universes past 10 symbols, and AI conversations; intraday
          forward deployments carry a one-time fee. Cancel anytime through the
          billing portal. Payments handled by Stripe — we never see your card.
        </p>
      </SectionShell>
    </main>
  );
}
