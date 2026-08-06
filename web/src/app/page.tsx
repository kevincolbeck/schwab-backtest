import Link from "next/link";
import { fmtSignedPct } from "@/lib/format";
import styles from "@/components/landing/landing.module.css";
import EvidenceStrip from "@/components/landing/EvidenceStrip";
import FrozenPanel from "@/components/landing/FrozenPanel";
import LedgerRows from "@/components/landing/LedgerRows";
import LivePreview from "@/components/landing/LivePreview";
import SpecPeek from "@/components/landing/SpecPeek";
import Reveal from "@/components/Reveal";
import SectionShell from "@/components/SectionShell";
import TemplateCard from "@/components/TemplateCard";
import Card from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Accordion, AccordionItem } from "@/components/ui/Accordion";
import { sortRows } from "@/lib/leaderboard";
import { BACKTEST_API_URL } from "@/lib/server/backend";
import { partitionTemplates, wallTemplates } from "@/lib/templates";
import type { LeaderboardEntry, Template } from "@/lib/types";

async function getTemplates(): Promise<Template[]> {
  try {
    const res = await fetch(`${BACKTEST_API_URL}/templates`, { cache: "no-store" });
    if (!res.ok) return [];
    const body = (await res.json()) as { templates?: Template[] };
    return body.templates ?? [];
  } catch {
    return [];
  }
}

/** Full leaderboard — verified entries AND warming deployments, mirroring the
 *  leaderboard page's payload handling. Truth rule: counts in EvidenceStrip
 *  must reflect the REAL ledger, so no teaser-slicing here. */
async function getLeaderboard(): Promise<{
  entries: LeaderboardEntry[];
  qualifying: LeaderboardEntry[];
  minDays: number;
}> {
  try {
    const res = await fetch(`${BACKTEST_API_URL}/leaderboard`, { cache: "no-store" });
    if (!res.ok) return { entries: [], qualifying: [], minDays: 20 };
    const body = (await res.json()) as {
      entries?: LeaderboardEntry[];
      qualifying?: LeaderboardEntry[];
      min_days?: number;
    };
    return {
      entries: body.entries ?? [],
      qualifying: body.qualifying ?? [],
      minDays: body.min_days ?? 20,
    };
  } catch {
    return { entries: [], qualifying: [], minDays: 20 };
  }
}

const PILLARS = [
  {
    eyebrow: "The Lab",
    title: "Build anything",
    body: "Describe a strategy in plain English — any symbols, famous templates, or from scratch. The AI writes the rules, runs two decades of data in seconds, and teaches as it edits.",
  },
  {
    eyebrow: "The Proof",
    title: "Freeze it, forward-test it",
    body: "One click deploys your strategy to the ledger. The spec freezes — hash-verified — and every trading day it's evaluated on fresh data. Timestamped. Append-only. Unfakeable.",
  },
  {
    eyebrow: "The Board · Live now",
    title: "Receipts, in public",
    body: "The leaderboard ranks live forward performance, not backtested hindsight. Losers stay on the board. That's the point — a track record no one can rewrite.",
  },
];

const STRATEGIST_CARDS = [
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
];

const HONESTY = [
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
];

/* Ordered confident-first (P0-2): the honesty answers all stay, verbatim —
   they're supporting texture now, not the opener. */
const FAQ = [
  {
    q: "How is this different from indicator platforms?",
    a: "Indicator platforms sell black-box signals and pre-computed lookup tables. Here every strategy is a readable rule you can inspect, every “what if” actually re-runs the simulation, and every claim carries receipts.",
  },
  {
    q: "Where does the data come from?",
    a: "Daily US equity prices, split-adjusted, going back two decades, with a slippage assumption on every simulated fill. Full-universe tests note their survivorship bias right on the result.",
  },
  {
    q: "Will this make me money?",
    a: "No. This is a research and education tool. It shows how ideas would have performed historically — and history does not predict the future. Nothing here is financial advice or a recommendation to trade.",
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
    q: "Is your AI “trained on market data”?",
    a: "We won't hide the ball: the strategist is a frontier AI model wired into our research engine — two decades of price history across 5,000+ US symbols. The intelligence you feel is that loop: it never hands you an unvalidated opinion, because everything it proposes gets simulated before you see a number. Platforms claiming their AI was “built to understand markets” are describing the same architecture with less honesty.",
  },
];

export default async function Home() {
  const [templates, { entries, qualifying, minDays }] = await Promise.all([
    getTemplates(),
    getLeaderboard(),
  ]);

  /* Winners-first wall (CHATBACKTEST-BUILD.md P0-2): flagship top 6 above the
     fold; failed strategies get their own transparency section below. */
  const partition = partitionTemplates(templates);
  const wall = wallTemplates(partition);
  /* The Lab's proof object: buy-the-dip (the strategy the closing CTA dares
     you to test), else the first wall template with a cached result. */
  const labTemplate =
    templates.find((t) => t.id === "buy-the-dip") ??
    wall.find((t) => t.cached_stats) ??
    null;
  /* Ledger sections read verified + warming rows so the board is alive from
     deployment day one (same semantics as the unified leaderboard page). */
  const merged = [...entries, ...qualifying];
  const verifiedSlugs = new Set(entries.map((e) => e.slug));
  /* The Proof's evidence object: the longest-running deployment (most days
     of append-only history), deterministic tie-break by slug. */
  const frozen = merged.length
    ? [...merged].sort(
        (a, b) => b.days_live - a.days_live || a.slug.localeCompare(b.slug),
      )[0]
    : null;
  /* The Board's pillar copy promises ranking by LIVE forward performance, so
     the teaser always sorts by forward return — even while warming, those are
     real out-of-sample numbers. The full leaderboard offers labeled sorts. */
  const teaser = sortRows(merged, "forward_return").slice(0, 5);
  // Top forward record for the live strip — same ordering the teaser uses.
  const leader = teaser[0] ?? null;

  return (
    <main className="w-full">
      {/* ── Hero — the page's ONE aurora + grid; the CTA is the ONE idle ring ── */}
      <section className="relative overflow-hidden">
        <div className="aurora" aria-hidden />
        <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto grid w-full max-w-(--container-max) items-center gap-10 px-4 pb-(--space-section) pt-(--space-section-sm) sm:px-6 lg:grid-cols-2">
          <Reveal>
            <p className="mb-4 w-fit rounded-(--radius-pill) border border-hairline bg-panel px-3 py-1 text-xs text-muted">
              The AI strategy lab for momentum &amp; swing traders
            </p>
            <h1 className="max-w-xl text-display-xl font-semibold text-balance text-ink">
              Test the setup you saw online —{" "}
              <span className={styles.kineticSweep}>before you risk a dollar.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted">
              Describe any strategy in plain English. Our AI writes the exact rules,
              backtests 20 years in seconds, and tells you where it breaks. Then
              prove the survivors on a public, independently verifiable track
              record.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href="/playground" variant="ring" size="lg">
                Run a backtest free →
              </ButtonLink>
              <ButtonLink href="/leaderboard" variant="secondary" size="lg">
                See the live records →
              </ButtonLink>
            </div>
            <p className="mt-4 text-caption text-faint">
              Free to start · no card · results in seconds
            </p>
          </Reveal>
          <Reveal index={1}>
            <LivePreview />
          </Reveal>
        </div>
      </section>

      {/* ── Live strip (Section 7 UX fix 5): the current top forward record,
         above the fold. Uses the leaderboard data the page already fetched —
         no extra request. Guarded on `leader` so an unreachable service
         renders nothing rather than a fabricated zero. ── */}
      {leader ? (
        <section className="border-t border-hairline bg-panel/40">
          <Link
            href={`/strategy/${leader.slug}`}
            className="focus-ring mx-auto flex w-full max-w-(--container-max) flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-6"
          >
            <span className="text-caption uppercase tracking-widest text-muted">
              Live on the ledger now
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
              {leader.name}
            </span>
            <span className="tnum inline-flex items-center gap-1 rounded-(--radius-pill) border border-hairline px-2.5 py-1 text-caption text-muted">
              {verifiedSlugs.has(leader.slug) ? (
                <>
                  <span aria-hidden>✓</span>
                  {leader.days_live} days
                  <span className="sr-only">verified record</span>
                </>
              ) : (
                <>
                  day {leader.days_live} of {minDays}
                  <span className="sr-only"> — not yet verified</span>
                </>
              )}
            </span>
            {/* Real out-of-sample P&L — the one place valence colour is earned.
               The sign carries the direction too, so colour is never alone. */}
            <span
              className={`tnum text-sm ${
                (leader.forward_return_pct ?? 0) > 0
                  ? "text-gain"
                  : (leader.forward_return_pct ?? 0) < 0
                    ? "text-loss"
                    : "text-muted"
              }`}
            >
              {fmtSignedPct(leader.forward_return_pct, 2)} forward
            </span>
          </Link>
        </section>
      ) : null}

      {/* ── Template wall: flagship top 6, winners-first (P0-2). The honesty
         now lives in its own transparency section further down — no forced
         loser above the fold. ── */}
      <SectionShell
        id="templates"
        className="border-t border-hairline"
        eyebrow="Templates · The starting point"
        title="Famous strategies, actually tested"
        sub="Real numbers from real historical data — computed before you clicked, never cherry-picked after."
        cta={
          templates.length > 0 && (
            <ButtonLink href="/library" variant="secondary">
              Explore all {templates.length} strategies →
            </ButtonLink>
          )
        }
      >
        {wall.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {wall.map((t, i) => (
              <Reveal key={t.id} index={i} className="h-full">
                <TemplateCard template={t} />
              </Reveal>
            ))}
          </div>
        ) : templates.length > 0 ? (
          <Card pad="sm" className="text-sm text-muted">
            Nothing currently passes the bar — every strategy that failed is
            published below.
          </Card>
        ) : (
          <Card pad="sm" className="text-sm text-muted">
            The backtest service isn&apos;t reachable right now — refresh in a moment.
          </Card>
        )}
      </SectionShell>

      {/* ── The Lab — proof object: a real template's executable rules ── */}
      <SectionShell
        className="border-t border-hairline"
        eyebrow={PILLARS[0].eyebrow}
        title={PILLARS[0].title}
        sub={PILLARS[0].body}
      >
        {labTemplate && (
          <Reveal>
            <SpecPeek template={labTemplate} />
          </Reveal>
        )}
      </SectionShell>

      {/* ── The Proof — evidence object: a real frozen deployment ── */}
      <SectionShell
        className="border-t border-hairline"
        center
        eyebrow={PILLARS[1].eyebrow}
        title={PILLARS[1].title}
        sub={PILLARS[1].body}
      >
        {frozen && (
          <Reveal>
            <FrozenPanel entry={frozen} />
          </Reveal>
        )}
      </SectionShell>

      {/* ── The Board — proof object: real append-only ledger rows ── */}
      <SectionShell
        className="border-t border-hairline"
        eyebrow={PILLARS[2].eyebrow}
        title={PILLARS[2].title}
        sub={PILLARS[2].body}
        cta={
          teaser.length > 0 && (
            <Link
              href="/leaderboard"
              className="focus-ring rounded-(--radius-tag) text-sm text-accent hover:underline"
            >
              Full leaderboard →
            </Link>
          )
        }
      >
        {teaser.length > 0 && (
          <LedgerRows entries={teaser} minDays={minDays} verifiedSlugs={verifiedSlugs} />
        )}
      </SectionShell>

      {/* ── The Strategist — proof element: real house-ledger aggregates ── */}
      <SectionShell
        className="border-t border-hairline"
        eyebrow="The Strategist · An AI that tests, not guesses"
        title="Every opinion this AI has is a backtest"
        sub="Other platforms sell an “AI that understands markets.” Ours is wired directly into a research engine — when it has an opinion, it runs the simulation and shows you the result, so every claim comes with a test you can inspect."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {STRATEGIST_CARDS.map((x, i) => (
            <Reveal key={x.t} index={i} className="h-full">
              <Card className="h-full">
                <h3 className="text-sm font-medium text-ink">{x.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{x.b}</p>
              </Card>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-4">
          <EvidenceStrip templateCount={templates.length} entries={merged} />
        </Reveal>
        <Reveal className="mt-6">
          <p className="max-w-2xl text-sm leading-relaxed text-muted">
            The strategy library was built the same way — every house strategy was
            drafted with the AI, refined through the engine run after run, and is now
            forward-testing on the public ledger.{" "}
            <Link
              href="/library"
              className="focus-ring rounded-(--radius-tag) text-accent hover:underline"
            >
              Browse the library →
            </Link>
          </p>
        </Reveal>
      </SectionShell>

      {/* ── Transparency — the failed strategies, published on purpose (P0-2).
         The proof-object for the Strategist's "Warns you first" claim. ── */}
      {partition.failed.length > 0 && (
        <SectionShell
          className="border-t border-hairline"
          eyebrow="Transparency · Losers stay published"
          title="Strategies that failed the test (we leave them up on purpose)"
          sub="These strategies went through the same engine as the winners above — and lost money in simulation. Most sites would quietly delete them; we publish them, because a test you can trust has to be allowed to fail. Each card shows the real simulated result over the window it was tested on — published as-is, never quietly deleted."
          cta={
            <ButtonLink href="/library" variant="secondary">
              See every result in the library →
            </ButtonLink>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {partition.failed.map((t, i) => (
              <Reveal key={t.id} index={i} className="h-full">
                <TemplateCard template={t} />
              </Reveal>
            ))}
          </div>
        </SectionShell>
      )}

      {/* ── Honesty — evidence-styled trust builders ── */}
      <SectionShell
        className="border-t border-hairline"
        eyebrow="Honesty · Printed on every result"
        title="What a backtest can't tell you"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {HONESTY.map((x, i) => (
            <Reveal key={x.t} index={i} className="h-full">
              <Card className="h-full">
                <p className="tnum text-caption text-faint">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 text-sm font-medium text-ink">{x.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{x.b}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </SectionShell>

      {/* ── FAQ ── */}
      <SectionShell
        className="border-t border-hairline"
        center
        title="Questions, answered straight"
      >
        <Reveal className="mx-auto max-w-3xl">
          <Accordion>
            {FAQ.map((f) => (
              <AccordionItem key={f.q} summary={f.q}>
                {f.a}
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </SectionShell>

      {/* ── Final CTA ── */}
      <SectionShell
        className="border-t border-hairline"
        center
        title="Curious what “buy the dip” actually returned?"
        sub="Find out in about four seconds."
        cta={
          <ButtonLink href="/playground?template=buy-the-dip" variant="primary" size="lg">
            Test it now
          </ButtonLink>
        }
      />
    </main>
  );
}
