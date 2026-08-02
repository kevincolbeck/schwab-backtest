import Link from "next/link";
import TemplateCard from "@/components/TemplateCard";
import { BACKTEST_API_URL } from "@/lib/server/backend";
import type { Template } from "@/lib/types";

async function getTemplates(): Promise<Template[]> {
  try {
    const res = await fetch(`${BACKTEST_API_URL}/templates`, { cache: "no-store" });
    if (!res.ok) return [];
    const body = (await res.json()) as { templates: Template[] };
    return body.templates ?? [];
  } catch {
    return [];
  }
}

const STEPS = [
  {
    n: "1",
    title: "Build it",
    body: "Pick a classic swing-trading strategy — Golden Cross, Minervini, Turtle rules — or describe your own in plain English.",
    badge: null,
  },
  {
    n: "2",
    title: "Test it",
    body: "A decade of daily data in seconds. Ask “what if the stop was 5%?” — the AI edits the rules and re-runs while you watch, before vs after.",
    badge: null,
  },
  {
    n: "3",
    title: "Prove it in public",
    body: "Deploy to the forward-test ledger: the spec freezes, and every trading day it's evaluated on fresh data — timestamped, immutable, out-of-sample. No one can fake a track record here.",
    badge: "coming soon",
  },
];

const FAQ = [
  {
    q: "Will this make me money?",
    a: "No. This is a research and education tool. It shows you how ideas would have performed historically — and history does not predict the future. Nothing here is financial advice or a recommendation to trade.",
  },
  {
    q: "Where does the data come from?",
    a: "Daily US equity prices, split-adjusted, going back roughly a decade. Backtests include a slippage assumption on every fill. The full-universe option uses currently listed stocks, so those results can be optimistic (survivorship bias) — we say so right on the result.",
  },
  {
    q: "Do I need an account?",
    a: "Not to try it. Pick a template, run it, ask the chat questions — no login, no credits, no meter.",
  },
  {
    q: "Can it predict what a stock will do?",
    a: "No, and it won't pretend to. Ask it to predict prices and it will politely refuse and offer a historical test instead. That's a feature.",
  },
  {
    q: "How is this different from indicator platforms?",
    a: "Indicator platforms sell you black-box signals and pre-computed lookup tables. Here, every strategy is a readable rule you can inspect, and every “what if” actually re-runs the simulation — a fresh decade-long result in seconds, not a lookup of Wednesday's tables.",
  },
];

export default async function Home() {
  const templates = await getTemplates();

  return (
    <main className="mx-auto w-full max-w-6xl px-6">
      {/* Hero */}
      <section className="py-20 text-center">
        <p className="mx-auto mb-4 w-fit rounded-full border border-hairline bg-panel px-3 py-1 text-xs text-muted">
          A backtesting lab, not a signal service
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
          Build it. Test it. Prove it in public.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted">
          Describe a swing-trading strategy in plain English, backtest it on a decade
          of real data in seconds — then deploy it to a public forward-test ledger
          where results accrue out-of-sample, one honest day at a time.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/playground"
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-background hover:opacity-90"
          >
            Open the playground
          </Link>
          <a
            href="#templates"
            className="rounded-md border border-hairline px-5 py-2.5 text-sm text-ink hover:bg-panel"
          >
            Browse templates
          </a>
        </div>
      </section>

      {/* 3 steps */}
      <section className="grid gap-4 border-t border-hairline py-14 sm:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.n} className="rounded-xl border border-hairline bg-panel p-5">
            <div className="flex items-center justify-between">
              <div className="tnum text-xs text-accent">{s.n}</div>
              {s.badge && (
                <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                  {s.badge}
                </span>
              )}
            </div>
            <h3 className="mt-1 text-sm font-medium">{s.title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">{s.body}</p>
          </div>
        ))}
      </section>

      {/* Template gallery */}
      <section id="templates" className="border-t border-hairline py-14">
        <p className="text-xs uppercase tracking-widest text-accent">
          Templates · The starting point
        </p>
        <h2 className="mt-2 text-2xl font-semibold">
          Famous strategies, actually tested
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Real numbers from real historical data — computed before you clicked, not
          cherry-picked after.
        </p>
        {templates.length ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {templates.map((t) => (
              <TemplateCard key={t.id} template={t} />
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-lg border border-hairline bg-panel p-4 text-sm text-muted">
            The backtest service isn&apos;t reachable right now — start it and refresh to
            see the gallery with live numbers.
          </p>
        )}
      </section>

      {/* Honesty block — a feature, not a footer */}
      <section className="border-t border-hairline py-14">
        <p className="text-xs uppercase tracking-widest text-accent">
          Honesty · Printed on every result
        </p>
        <h2 className="mt-2 text-2xl font-semibold">What a backtest can&apos;t tell you</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-hairline bg-panel p-5">
            <h3 className="text-sm font-medium">Past ≠ future</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              A strategy that worked for ten years can stop working tomorrow. Every result
              here is a historical simulation, never a forecast.
            </p>
          </div>
          <div className="rounded-xl border border-hairline bg-panel p-5">
            <h3 className="text-sm font-medium">Survivorship bias is real</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Full-universe tests use currently listed stocks — companies that went to zero
              aren&apos;t in the data, which flatters the results. We label it when it applies.
            </p>
          </div>
          <div className="rounded-xl border border-hairline bg-panel p-5">
            <h3 className="text-sm font-medium">Costs are assumptions</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Every fill includes a slippage assumption, and it&apos;s shown with the run. Real
              trading costs vary — treat results as approximations, not receipts.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-hairline py-14">
        <h2 className="text-2xl font-semibold">Questions, answered straight</h2>
        <div className="mt-6 space-y-3">
          {FAQ.map((f) => (
            <details
              key={f.q}
              className="group rounded-lg border border-hairline bg-panel px-4 py-3"
            >
              <summary className="cursor-pointer text-sm font-medium marker:text-muted">
                {f.q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-hairline py-16 text-center">
        <h2 className="text-2xl font-semibold">
          Curious what &ldquo;buy the dip&rdquo; actually returned?
        </h2>
        <p className="mt-2 text-sm text-muted">Find out in about four seconds.</p>
        <Link
          href="/playground?template=buy-the-dip"
          className="mt-6 inline-block rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-background hover:opacity-90"
        >
          Test it now — free, no login
        </Link>
      </section>
    </main>
  );
}
