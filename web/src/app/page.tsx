import Link from "next/link";
import LivePreview from "@/components/landing/LivePreview";
import Reveal from "@/components/Reveal";
import Sparkline from "@/components/Sparkline";
import TemplateCard from "@/components/TemplateCard";
import { fmtSignedPct } from "@/lib/format";
import { BACKTEST_API_URL } from "@/lib/server/backend";
import type { LeaderboardEntry, Template } from "@/lib/types";

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

async function getLedgerTeaser(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(`${BACKTEST_API_URL}/leaderboard`, { cache: "no-store" });
    if (!res.ok) return [];
    const body = (await res.json()) as { entries: LeaderboardEntry[] };
    return (body.entries ?? []).slice(0, 5);
  } catch {
    return [];
  }
}

const PILLARS = [
  {
    eyebrow: "The Lab",
    title: "Build anything",
    body: "Describe a strategy in plain English — any symbols, famous templates, or from scratch. The AI writes the rules, runs a decade of data in seconds, and teaches as it edits.",
  },
  {
    eyebrow: "The Proof",
    title: "Freeze it, forward-test it",
    body: "One click deploys your strategy to the ledger. The spec freezes — hash-verified — and every trading day it's evaluated on fresh data. Timestamped. Append-only. Unfakeable.",
  },
  {
    eyebrow: "The Board",
    title: "Receipts, in public",
    body: "The leaderboard ranks live forward performance, not backtested hindsight. Losers stay on the board. That's the point — a track record no one can rewrite.",
  },
];

const FAQ = [
  {
    q: "Will this make me money?",
    a: "No. This is a research and education tool. It shows how ideas would have performed historically — and history does not predict the future. Nothing here is financial advice or a recommendation to trade.",
  },
  {
    q: "Where does the data come from?",
    a: "Daily US equity prices, split-adjusted, going back roughly a decade, with a slippage assumption on every simulated fill. Full-universe tests note their survivorship bias right on the result.",
  },
  {
    q: "What makes the forward ledger trustworthy?",
    a: "Deployed strategies are frozen — the spec's cryptographic hash is public, and the signals ledger is append-only at the database level. We could not rewrite a track record if we wanted to.",
  },
  {
    q: "Can it predict what a stock will do?",
    a: "No, and it won't pretend to. Ask it to predict prices and it politely refuses and offers a historical test instead. That's a feature.",
  },
  {
    q: "How is this different from indicator platforms?",
    a: "Indicator platforms sell black-box signals and pre-computed lookup tables. Here every strategy is a readable rule you can inspect, every “what if” actually re-runs the simulation, and every claim carries receipts.",
  },
  {
    q: "Is your AI “trained on market data”?",
    a: "We won't hide the ball: the strategist is a frontier AI model wired into our research engine — two decades of price history across 5,000+ US symbols. The intelligence you feel is that loop: it never hands you an unvalidated opinion, because everything it proposes gets simulated before you see a number. Platforms claiming their AI was “built to understand markets” are describing the same architecture with less honesty.",
  },
];

export default async function Home() {
  const [templates, ledger] = await Promise.all([getTemplates(), getLedgerTeaser()]);

  return (
    <main className="w-full">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="aurora" aria-hidden />
        <div className="hero-grid pointer-events-none absolute inset-0" />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-6 pb-16 pt-14 lg:grid-cols-2 lg:pb-24 lg:pt-20">
          <Reveal>
            <p className="mb-4 w-fit rounded-full border border-hairline bg-panel px-3 py-1 text-xs text-muted">
              A strategy lab, not a signal service
            </p>
            <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
              Build it. Test it.{" "}
              <span className="bg-gradient-to-r from-accent to-prev bg-clip-text text-transparent">
                Prove it in public.
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted">
              Tell the AI strategist your idea in plain English. It writes the exact
              rules, stress-tests them against two decades of market data in seconds,
              and warns you where they&apos;ll break — then the survivors prove
              themselves on a public forward-test ledger, one honest day at a time.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/playground"
                className="gloss-ring btn-glow focus-ring rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-accent-hover"
              >
                Open the lab
              </Link>
              <Link
                href="/leaderboard"
                className="focus-ring rounded-xl border border-hairline-strong px-5 py-2.5 text-sm hover:bg-panel"
              >
                See the receipts
              </Link>
            </div>
            <p className="mt-4 text-[11px] text-faint">
              Free to start · no card · results in seconds
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <LivePreview />
          </Reveal>
        </div>
      </section>

      {/* Three pillars */}
      <section className="border-t border-hairline">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-6 py-16 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <Reveal key={p.eyebrow} delay={i * 0.06}>
              <div className="card h-full p-6">
                <p className="text-[11px] uppercase tracking-widest text-accent">
                  {p.eyebrow}
                </p>
                <h3 className="mt-2 text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* The AI strategist */}
      <section className="relative overflow-hidden border-t border-hairline">
        <div className="aurora" aria-hidden />
        <div className="relative mx-auto w-full max-w-6xl px-6 py-16">
          <Reveal>
            <p className="text-[11px] uppercase tracking-widest text-accent">
              The Strategist · An AI that tests, not guesses
            </p>
            <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight">
              Every opinion this AI has is a backtest
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
              Other platforms sell an &ldquo;AI that understands markets.&rdquo; Ours is
              wired directly into a research engine — when it has an opinion, it runs
              the simulation and shows you the result, so every claim comes with a
              test you can inspect.
            </p>
          </Reveal>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                t: "Speaks fluent strategy",
                b: "Plain English in, exact executable rules out — entries, exits, stops, sizing. Nothing hidden behind an arrow: you can read, edit, and export every rule it writes.",
              },
              {
                t: "Validated against decades",
                b: "Every edit re-runs the full simulation — up to 5,000 US symbols, twenty years of history, intraday down to one-minute candles. The AI's suggestions are measured, not imagined.",
              },
              {
                t: "Warns you first",
                b: "It flags look-ahead bias, overtight stops, oversized positions, and too-few-trades significance before you spend on a doomed run. An AI that says your idea is flawed is worth more than one that says it's brilliant.",
              },
            ].map((x, i) => (
              <Reveal key={x.t} delay={i * 0.06}>
                <div className="card h-full p-6">
                  <h3 className="text-sm font-semibold">{x.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{x.b}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.14}>
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">
              The strategy library was built the same way — every house strategy was
              drafted with the AI, refined through the engine run after run, and is now
              forward-testing on the public ledger.{" "}
              <Link href="/library" className="text-accent hover:underline">
                Browse the library →
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* Ledger teaser */}
      {ledger.length > 0 && (
        <section className="relative overflow-hidden border-t border-hairline">
          <div className="aurora" aria-hidden />
          <div className="relative mx-auto w-full max-w-6xl px-6 py-16">
            <Reveal>
              <p className="text-[11px] uppercase tracking-widest text-accent">
                The Board · Live now
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                Strategies proving themselves in public
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="card mt-6 overflow-hidden">
                {ledger.map((e, i) => (
                  <Link
                    key={e.slug}
                    href={`/strategy/${e.slug}`}
                    className="flex items-center gap-4 border-b border-hairline px-4 py-3 transition-colors last:border-0 hover:bg-panel-2"
                  >
                    <span className="tnum w-5 text-xs text-faint">{i + 1}</span>
                    <span className="flex-1 text-sm font-medium">{e.name}</span>
                    <span className="hidden text-xs text-muted sm:block">
                      {e.days_live} days live
                    </span>
                    <Sparkline values={e.sparkline} baseline={100000} width={90} height={22} />
                    <span
                      className={`tnum w-20 text-right text-sm ${
                        e.forward_return_pct > 0
                          ? "text-gain"
                          : e.forward_return_pct < 0
                            ? "text-loss"
                            : "text-muted"
                      }`}
                    >
                      {fmtSignedPct(e.forward_return_pct, 2)}
                    </span>
                  </Link>
                ))}
              </div>
              <Link
                href="/leaderboard"
                className="mt-4 inline-block text-sm text-accent hover:underline"
              >
                Full leaderboard →
              </Link>
            </Reveal>
          </div>
        </section>
      )}

      {/* Templates */}
      <section id="templates" className="relative overflow-hidden border-t border-hairline">
        <div className="aurora" aria-hidden />
        <div className="relative mx-auto w-full max-w-6xl px-6 py-16">
          <Reveal>
            <p className="text-[11px] uppercase tracking-widest text-accent">
              Templates · The starting point
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Famous strategies, actually tested
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted">
              Real numbers from real historical data — computed before you clicked,
              never cherry-picked after.
            </p>
          </Reveal>
          {templates.length ? (
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {templates.map((t, i) => (
                <Reveal key={t.id} delay={Math.min(i * 0.04, 0.2)}>
                  <TemplateCard template={t} />
                </Reveal>
              ))}
            </div>
          ) : (
            <p className="card mt-7 p-4 text-sm text-muted">
              The backtest service isn&apos;t reachable right now — refresh in a moment.
            </p>
          )}
        </div>
      </section>

      {/* Honesty block */}
      <section className="border-t border-hairline">
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <Reveal>
            <p className="text-[11px] uppercase tracking-widest text-accent">
              Honesty · Printed on every result
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              What a backtest can&apos;t tell you
            </h2>
          </Reveal>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                t: "Past ≠ future",
                b: "A strategy that worked for ten years can stop working tomorrow. Every result here is a historical simulation, never a forecast.",
              },
              {
                t: "Survivorship bias is real",
                b: "Full-universe tests use currently listed stocks — companies that went to zero aren't in the data, which flatters results. We label it when it applies.",
              },
              {
                t: "Costs are assumptions",
                b: "Every simulated fill includes a slippage assumption, shown with the run. Real trading costs vary — results are approximations, not receipts.",
              },
            ].map((x, i) => (
              <Reveal key={x.t} delay={i * 0.06}>
                <div className="card h-full p-5">
                  <h3 className="text-sm font-medium">{x.t}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted">{x.b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-hairline">
        <div className="mx-auto w-full max-w-3xl px-6 py-16">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight">
              Questions, answered straight
            </h2>
          </Reveal>
          <div className="mt-6 space-y-3">
            {FAQ.map((f, i) => (
              <Reveal key={f.q} delay={Math.min(i * 0.04, 0.16)}>
                <details className="card group px-5 py-4">
                  <summary className="focus-ring cursor-pointer rounded-md text-sm font-medium marker:text-faint">
                    {f.q}
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden border-t border-hairline">
        <div className="aurora" aria-hidden />
        <div className="relative mx-auto w-full max-w-6xl px-6 py-20 text-center">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-tight">
              Curious what &ldquo;buy the dip&rdquo; actually returned?
            </h2>
            <p className="mt-2 text-sm text-muted">Find out in about four seconds.</p>
            <Link
              href="/playground?template=buy-the-dip"
              className="gloss-ring-hover btn-glow focus-ring mt-7 inline-block rounded-xl bg-accent px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-accent-hover"
            >
              Test it now
            </Link>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
