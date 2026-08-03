import Link from "next/link";
import { DISCLAIMER } from "@/lib/constants";
import { fmtNum, fmtPct, fmtSignedPct } from "@/lib/format";
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

function timeframeOf(t: Template): string {
  return t.spec?.backtest_timeframe || "1d";
}

function LibraryCard({ template }: { template: Template }) {
  const s = template.cached_stats?.stats;
  const cagr = s?.cagr ?? null;
  const timeframe = timeframeOf(template);
  const intraday = timeframe !== "1d";
  return (
    <Link
      href={`/playground?template=${encodeURIComponent(template.id)}`}
      className="group flex flex-col rounded-xl border border-hairline bg-panel p-4 transition-colors hover:border-accent"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-tight">{template.meta.display_name}</h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {intraday && (
            <span
              className="tnum rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent"
              title={`Intraday strategy — runs on ${timeframe} bars`}
            >
              {timeframe}
            </span>
          )}
          <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
            {template.meta.category}
          </span>
        </div>
      </div>
      <p className="mt-2 flex-1 text-xs leading-relaxed text-muted">
        {template.meta.one_liner}
      </p>
      {s ? (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-hairline pt-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted">CAGR</div>
              <div className={`tnum text-base ${cagr !== null && cagr < 0 ? "text-loss" : ""}`}>
                {fmtPct(cagr, 1)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted">Return</div>
              <div
                className={`tnum text-base ${
                  (s.total_return_pct ?? 0) < 0 ? "text-loss" : ""
                }`}
              >
                {fmtSignedPct(s.total_return_pct ?? null, 0)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted">Max DD</div>
              <div className="tnum text-base">{fmtPct(s.max_drawdown ?? null, 0)}</div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted">
            <span className="tnum">
              {intraday
                ? `${timeframe} bars`
                : `${template.cached_stats?.start_date.slice(0, 4)}–${template.cached_stats?.end_date.slice(0, 4)}`}
              {" · "}Sharpe {fmtNum(s.sharpe ?? null)} · {s.total_trades ?? "—"} trades
            </span>
            <span className="text-accent opacity-0 transition-opacity group-hover:opacity-100">
              Fork it →
            </span>
          </div>
        </>
      ) : (
        <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3 text-xs text-muted">
          <span>Open it in the playground to run the backtest</span>
          <span className="text-accent opacity-0 transition-opacity group-hover:opacity-100">
            Fork it →
          </span>
        </div>
      )}
    </Link>
  );
}

export default async function LibraryPage() {
  const templates = await getTemplates();
  const sections = groupByCategory(templates);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <p className="text-xs uppercase tracking-widest text-accent">
        The Library · Receipts included
      </p>
      <h1 className="mt-2 text-3xl font-semibold">The Library</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Every strategy comes with receipts. Real backtests, forkable in one click,
        deployable to the public forward ledger. The numbers on each card are the actual
        simulated results — winners and losers alike — and one click drops the full
        strategy into the playground where you can pick it apart, change any rule, and
        rerun it yourself.
      </p>

      {sections.length === 0 ? (
        <p className="mt-8 rounded-lg border border-hairline bg-panel p-4 text-sm text-muted">
          The library couldn&apos;t be loaded. Is the backtest service running?
        </p>
      ) : (
        sections.map(([category, list]) => (
          <section key={category} className="mt-10">
            <div className="flex items-baseline gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide">{category}</h2>
              <span className="tnum rounded-full border border-hairline px-2 py-0.5 text-[10px] text-muted">
                {list.length}
              </span>
            </div>
            {CATEGORY_TAGLINES[category] && (
              <p className="mt-1 text-xs text-muted">{CATEGORY_TAGLINES[category]}</p>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((t) => (
                <LibraryCard key={t.id} template={t} />
              ))}
            </div>
          </section>
        ))
      )}

      <p className="mt-10 text-[11px] text-muted">
        Backtest results are simulations on historical data with a slippage assumption —
        not real executions, and not a promise about the future. {DISCLAIMER}
      </p>
    </main>
  );
}
