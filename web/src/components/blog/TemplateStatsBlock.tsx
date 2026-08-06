import Link from "next/link";
import { BACKTEST_API_URL } from "@/lib/server/backend";
import { fmtPct, fmtSignedPct } from "@/lib/format";
import { SHORT_WINDOW_DAYS, templateHero, windowDays } from "@/lib/templates";
import type { Template } from "@/lib/types";

/** Live results block for blog articles (P1-1).
 *
 * The truth rule made structural: articles carry NO performance numbers in
 * prose — every stat here renders from the engine's cached template results
 * (the same source as the library), revalidated every 6 hours, so a data
 * refresh can never strand a stale claim inside an article. Short windows
 * refuse to annualize, exactly like TemplateCard.
 */

const REVALIDATE_SECONDS = 21_600; // 6h — matches the stock pages' ISR cadence

async function getTemplate(id: string): Promise<Template | null> {
  try {
    const res = await fetch(`${BACKTEST_API_URL}/templates`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { templates?: Template[] };
    return body.templates?.find((t) => t.id === id) ?? null;
  } catch {
    return null;
  }
}

function Stat({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
  return (
    <div>
      <dt className="text-caption uppercase tracking-widest text-muted">{label}</dt>
      <dd className={`tnum mt-0.5 text-lg font-medium ${negative ? "text-loss" : "text-ink"}`}>
        {value}
      </dd>
    </div>
  );
}

export default async function TemplateStatsBlock({ templateId }: { templateId: string }) {
  const template = await getTemplate(templateId);
  const labHref = `/playground?template=${encodeURIComponent(templateId)}`;

  if (!template?.cached_stats) {
    return (
      <aside aria-label="Live backtest results" className="card my-8 p-5">
        <p className="text-sm text-muted">
          Live results are unavailable right now — but the strategy itself is
          one click away:
        </p>
        <Link href={labHref} className="focus-ring mt-3 inline-block rounded-(--radius-tag) text-sm text-accent hover:underline">
          Open this strategy in the lab →
        </Link>
      </aside>
    );
  }

  const cached = template.cached_stats;
  const hero = templateHero(template);
  const stats = cached.stats ?? {};
  const short = windowDays(cached.start_date, cached.end_date) < SHORT_WINDOW_DAYS;
  const num = (k: string) => (typeof stats[k] === "number" ? (stats[k] as number) : null);
  const maxDd = num("max_drawdown");
  const sharpe = num("sharpe");
  const trades = num("total_trades");
  const winRate = num("win_rate");

  return (
    <aside aria-label="Live backtest results" className="card my-8 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">
          {template.meta.display_name} — live backtest results
        </h3>
        <span className="tnum text-caption text-faint">
          {cached.start_date} → {cached.end_date}
          {template.spec.backtest_timeframe && template.spec.backtest_timeframe !== "1d"
            ? ` · ${template.spec.backtest_timeframe} bars`
            : ""}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {hero && (
          <Stat
            label={hero.kind === "cagr" ? "CAGR" : "Total return (window)"}
            value={
              hero.kind === "cagr" ? fmtPct(hero.value, 1) : fmtSignedPct(hero.value, 1)
            }
            negative={hero.value < 0}
          />
        )}
        {/* Positive convention, matching StatTiles/leaderboard site-wide. */}
        {maxDd !== null && <Stat label="Max drawdown" value={fmtPct(Math.abs(maxDd), 1)} />}
        {sharpe !== null && <Stat label="Sharpe" value={sharpe.toFixed(2)} />}
        {trades !== null && <Stat label="Trades" value={String(trades)} />}
        {winRate !== null && <Stat label="Win rate" value={fmtPct(winRate, 1)} />}
      </dl>
      <p className="mt-4 text-caption leading-relaxed text-faint">
        Rendered live from our engine&rsquo;s latest run of this exact template —
        not typed into the article.{short ? " This window is under a year, so we show the window's actual total return instead of annualizing it." : ""}{" "}
        Historical simulation with a slippage assumption; not financial advice;
        past performance does not predict future results.
      </p>
      <div className="mt-3 flex flex-col gap-1.5">
        <Link href={labHref} className="focus-ring inline-block rounded-(--radius-tag) text-sm text-accent hover:underline">
          {template.spec.backtest_timeframe && template.spec.backtest_timeframe !== "1d"
            ? // Intraday runs need an account and draw on its allowance — the
              // "free, no signup" promise is only true for daily templates.
              "Open this strategy in the lab →"
            : "Run this backtest yourself in the lab — free, no signup →"}
        </Link>
        {/* Section 4 page for the same template: the full rule set, equity
            curve and forward record. Contextual internal link, which is the
            kind that actually carries weight. */}
        <Link
          href={`/backtest/${encodeURIComponent(templateId)}`}
          className="focus-ring inline-block rounded-(--radius-tag) text-sm text-muted hover:text-ink"
        >
          Full {template.meta.display_name} backtest: rules, equity curve and
          forward record →
        </Link>
      </div>
    </aside>
  );
}
