import Link from "next/link";
import Reveal from "@/components/Reveal";
import SectionShell from "@/components/SectionShell";
import TemplateCard from "@/components/TemplateCard";
import Card from "@/components/ui/Card";
import { postForTemplate } from "@/lib/blog";
import { DISCLAIMER } from "@/lib/constants";
import { BACKTEST_API_URL } from "@/lib/server/backend";
import type { Template } from "@/lib/types";

export const metadata = {
  title: "Strategy Library — Chat to Backtest",
  description:
    "Every strategy in the library ships with a real backtest attached. Fork any of them in one click and deploy to the public forward ledger.",
};

/** Canonical section order; categories the API sends beyond these append after. */
const CATEGORY_ORDER = ["Trend", "Momentum", "Breakout", "Mean Reversion", "Seasonal"];

const CATEGORY_TAGLINES: Record<string, string> = {
  Trend: "Ride moves that are already underway — and get out when they end.",
  Momentum: "Own what's strongest. Winners tend to keep winning, until they don't.",
  Breakout: "Buy new highs. No prediction — just insisting on being long what's moving.",
  "Mean Reversion": "Buy the stretch, sell the snap-back.",
  Seasonal: "Calendar folklore, made precise enough to test.",
};

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

function groupByCategory(templates: Template[]): Array<[string, Template[]]> {
  const groups = new Map<string, Template[]>();
  for (const t of templates) {
    const category = t.meta?.category || "Other";
    const list = groups.get(category) ?? [];
    list.push(t);
    groups.set(category, list);
  }
  const ordered: Array<[string, Template[]]> = [];
  for (const cat of CATEGORY_ORDER) {
    const list = groups.get(cat);
    if (list) {
      ordered.push([cat, list]);
      groups.delete(cat);
    }
  }
  for (const [cat, list] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    ordered.push([cat, list]);
  }
  return ordered;
}

function slugOf(category: string): string {
  return category.toLowerCase().replace(/\s+/g, "-");
}

/** Category filter chip — server-rendered link, so filtering works without
 *  JS. Accent marks the ACTIVE chip only (SYSTEM.md §1: active states are a
 *  sanctioned accent use); resting chips stay hairline + muted. */
function FilterChip({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`focus-ring inline-flex items-center gap-1.5 rounded-(--radius-control) border px-3 py-1.5 text-xs transition-colors duration-(--dur-micro) ${
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-hairline text-muted hover:border-hairline-strong hover:text-ink"
      }`}
    >
      {label}
      <span className={`tnum text-caption ${active ? "" : "text-faint"}`}>{count}</span>
    </Link>
  );
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const [templates, params] = await Promise.all([getTemplates(), searchParams]);
  const sections = groupByCategory(templates);
  const rawCategory = Array.isArray(params.category) ? params.category[0] : params.category;
  const activeCategory =
    sections.find(([cat]) => slugOf(cat) === rawCategory)?.[0] ?? null;
  const visible = activeCategory
    ? sections.filter(([cat]) => cat === activeCategory)
    : sections;

  return (
    <main className="w-full">
      <SectionShell
        headingAs="h1"
        hero
        tight
        eyebrow="The Library · Receipts included"
        title="The Library"
        sub={
          <>
            Every strategy comes with receipts. Real backtests, forkable in one click,
            deployable to the public forward ledger. The numbers on each card are the
            actual simulated results — winners and losers alike — and one click drops
            the full strategy into the playground where you can pick it apart, change
            any rule, and rerun it yourself.
          </>
        }
      >
        {sections.length === 0 ? (
          <Card pad="sm" className="text-sm text-muted">
            The library couldn&apos;t be loaded. Is the backtest service running?
          </Card>
        ) : (
          <>
            <Reveal>
              <nav aria-label="Filter strategies by category" className="flex flex-wrap gap-2">
                <FilterChip
                  href="/library"
                  active={activeCategory === null}
                  label="All"
                  count={templates.length}
                />
                {sections.map(([category, list]) => (
                  <FilterChip
                    key={category}
                    href={`/library?category=${encodeURIComponent(slugOf(category))}`}
                    active={activeCategory === category}
                    label={category}
                    count={list.length}
                  />
                ))}
              </nav>
            </Reveal>

            <div className="mt-12 space-y-14">
              {visible.map(([category, list]) => (
                <section key={category} aria-labelledby={`cat-${slugOf(category)}`}>
                  <Reveal>
                    <div className="flex items-baseline gap-3">
                      <h2
                        id={`cat-${slugOf(category)}`}
                        className="text-xl font-medium text-ink"
                      >
                        {category}
                      </h2>
                      <span className="tnum rounded-(--radius-pill) border border-hairline px-2 py-0.5 text-caption text-muted">
                        {list.length}
                      </span>
                    </div>
                    {CATEGORY_TAGLINES[category] && (
                      <p className="mt-1.5 text-sm text-muted">
                        {CATEGORY_TAGLINES[category]}
                      </p>
                    )}
                  </Reveal>
                  <Reveal>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {list.map((t) => {
                        // P1-1 backlink rule: templates with a published
                        // write-up link back to it. Sibling of the card —
                        // TemplateCard is itself one big anchor; anchors
                        // don't nest.
                        const article = postForTemplate(t.id);
                        return (
                          // [&>a.card]:flex-1 keeps row heights equal: the
                          // wrapper stretches with the grid, and the card
                          // (not the backlink anchor) absorbs the slack.
                          <div key={t.id} className="flex flex-col gap-2 [&>a.card]:flex-1">
                            <TemplateCard template={t} />
                            {article && (
                              <Link
                                href={`/blog/${article.slug}`}
                                className="focus-ring self-start rounded-(--radius-tag) px-1 text-caption text-muted hover:text-accent"
                              >
                                Read the full test → {article.title}
                              </Link>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Reveal>
                </section>
              ))}
            </div>
          </>
        )}
      </SectionShell>

      <div className="mx-auto w-full max-w-(--container-max) px-4 pb-12 sm:px-6">
        <p className="max-w-prose text-caption text-muted">
          Backtest results are simulations on historical data with a slippage
          assumption — not real executions, and not a promise about the future.{" "}
          {DISCLAIMER}
        </p>
      </div>
    </main>
  );
}
