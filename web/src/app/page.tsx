import Link from "next/link";
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
import { BACKTEST_API_URL } from "@/lib/server/backend";
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

/** Full leaderboard — sections slice what they need. Truth rule: counts in
 *  EvidenceStrip must reflect the REAL ledger, so no teaser-slicing here. */
async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(`${BACKTEST_API_URL}/leaderboard`, { cache: "no-store" });
    if (!res.ok) return [];
    const body = (await res.json()) as { entries?: LeaderboardEntry[] };
    return body.entries ?? [];
  } catch {
    return [];
  }
}

/** The template's hero metric, mirroring TemplateCard: CAGR, falling back to
 *  total return. Null when the template has no cached result. */
function heroMetric(t: Template): number | null {
  const s = t.cached_stats?.stats;
  return s?.cagr ?? s?.total_return_pct ?? null;
}

/** Curate exactly 6 templates for the homepage wall (brief §4): a
 *  deterministic round-robin across categories (representative spread), best
 *  cached result first within each, and a guaranteed negative-return pick
 *  when one exists — losers on the wall are the brand's honesty. */
function curateTemplates(templates: Template[]): Template[] {
  const withStats = templates.filter((t) => heroMetric(t) !== null);
  const pool = withStats.length >= 6 ? withStats : templates;

  const byCategory = new Map<string, Template[]>();
  for (const t of [...pool].sort((a, b) => a.id.localeCompare(b.id))) {
    const cat = t.meta?.category || "Other";
    const list = byCategory.get(cat) ?? [];
    list.push(t);
    byCategory.set(cat, list);
  }
  const categories = [...byCategory.keys()].sort((a, b) => a.localeCompare(b));
  for (const cat of categories) {
    byCategory.get(cat)!.sort((a, b) => {
      const ha = heroMetric(a);
      const hb = heroMetric(b);
      if (ha === null && hb === null) return a.id.localeCompare(b.id);
      if (ha === null) return 1;
      if (hb === null) return -1;
      return hb - ha || a.id.localeCompare(b.id);
    });
  }

  const picked: Template[] = [];
  for (let round = 0; picked.length < 6; round++) {
    let added = false;
    for (const cat of categories) {
      const list = byCategory.get(cat)!;
      if (round < list.length && picked.length < 6) {
        picked.push(list[round]);
        added = true;
      }
    }
    if (!added) break;
  }

  const isNegative = (t: Template) => (heroMetric(t) ?? 0) < 0;
  if (picked.length && !picked.some(isNegative)) {
    const negatives = pool
      .filter(isNegative)
      .sort((a, b) => heroMetric(a)! - heroMetric(b)! || a.id.localeCompare(b.id));
    if (negatives.length) picked[picked.length - 1] = negatives[0];
  }
  return picked.slice(0, 6);
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
  const [templates, entries] = await Promise.all([getTemplates(), getLeaderboard()]);

  const curated = curateTemplates(templates);
  /* The Lab's proof object: buy-the-dip (the strategy the closing CTA dares
     you to test), else the first curated template with a cached result. */
  const labTemplate =
    templates.find((t) => t.id === "buy-the-dip") ??
    curated.find((t) => t.cached_stats) ??
    null;
  /* The Proof's evidence object: the longest-running deployment (most days
     of append-only history), deterministic tie-break by slug. */
  const frozen = entries.length
    ? [...entries].sort(
        (a, b) => b.days_live - a.days_live || a.slug.localeCompare(b.slug),
      )[0]
    : null;
  const teaser = entries.slice(0, 5);

  return (
    <main className="w-full">
      {/* ── Hero — the page's ONE aurora + grid; the CTA is the ONE idle ring ── */}
      <section className="relative overflow-hidden">
        <div className="aurora" aria-hidden />
        <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto grid w-full max-w-(--container-max) items-center gap-10 px-4 pb-(--space-section) pt-(--space-section-sm) sm:px-6 lg:grid-cols-2">
          <Reveal>
            <p className="mb-4 w-fit rounded-(--radius-pill) border border-hairline bg-panel px-3 py-1 text-xs text-muted">
              A strategy lab, not a signal service
            </p>
            <h1 className="max-w-xl text-display-xl font-semibold text-balance text-ink">
              Build it. Test it.{" "}
              <span className={styles.kineticSweep}>Prove it in public.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted">
              Tell the AI strategist your idea in plain English. It writes the exact
              rules, stress-tests them against two decades of market data in seconds,
              and warns you where they&apos;ll break — then the survivors prove
              themselves on a public forward-test ledger, one honest day at a time.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href="/playground" variant="ring" size="lg">
                Open the lab
              </ButtonLink>
              <ButtonLink href="/leaderboard" variant="secondary" size="lg">
                See the receipts
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

      {/* ── Template wall: exactly 6 curated, 3×2, honesty included ── */}
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
        {curated.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {curated.map((t, i) => (
              <Reveal key={t.id} index={i} className="h-full">
                <TemplateCard template={t} />
              </Reveal>
            ))}
          </div>
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
        {teaser.length > 0 && <LedgerRows entries={teaser} />}
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
          <EvidenceStrip templateCount={templates.length} entries={entries} />
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
