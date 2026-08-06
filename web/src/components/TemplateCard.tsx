import Link from "next/link";
import Sparkline from "@/components/Sparkline";
import StrategyPreview from "@/components/StrategyPreview";
import type { Template } from "@/lib/types";
import { fmtPct, fmtSignedPct } from "@/lib/format";
import { SHORT_WINDOW_DAYS, templateHero, windowDays } from "@/lib/templates";

/** Template/strategy card, redesigned per brief §4: name, one-liner, THE
 *  number as the mono hero stat, tiny sparkline, category tag. The hero comes
 *  from templateHero(): CAGR when a year-plus window backs it, the window's
 *  total return otherwise — annualizing a six-week test would violate the
 *  truth rule, so short windows show what actually happened plus the exact
 *  dates. Everything else lives on the detail view.
 *
 *  Above the stats sits a StrategyPreview — a deterministic illustration of
 *  the strategy's MECHANIC derived from its spec (labeled "illustration",
 *  never data).
 *
 *  Truth rule: the sparkline renders ONLY when real equity values are passed
 *  via `spark` — it is never fabricated from the stats. Negative heroes stay
 *  visibly negative (the honesty is the brand). */
export default function TemplateCard({
  template,
  spark,
  featured = false,
}: {
  template: Template;
  /** Real equity-curve values for the tiny sparkline (optional). */
  spark?: number[];
  /** Featured items (one per section max) get the hover gloss ring. */
  featured?: boolean;
}) {
  const heroStat = templateHero(template);
  const hero = heroStat
    ? heroStat.kind === "cagr"
      ? { label: "CAGR", value: fmtPct(heroStat.value, 1), negative: heroStat.value < 0 }
      : {
          label: "Total return",
          value: fmtSignedPct(heroStat.value, 1),
          negative: heroStat.value < 0,
        }
    : null;
  const cached = template.cached_stats;
  const shortWindow =
    cached !== null &&
    cached !== undefined &&
    windowDays(cached.start_date, cached.end_date) < SHORT_WINDOW_DAYS;
  const range = cached
    ? shortWindow
      ? `${cached.start_date} → ${cached.end_date} · ${windowDays(cached.start_date, cached.end_date)} days`
      : `${cached.start_date.slice(0, 4)}–${cached.end_date.slice(0, 4)}`
    : null;
  const timeframe = template.spec.backtest_timeframe;

  return (
    <Link
      href={`/playground?template=${encodeURIComponent(template.id)}`}
      className={`card card-hover focus-ring flex flex-col p-5 ${
        featured ? "gloss-ring-hover" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium leading-snug text-ink">
          {template.meta.display_name}
        </h3>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-(--radius-pill) border border-hairline px-2 py-0.5 text-caption uppercase tracking-wide text-muted">
            {template.meta.category}
          </span>
          {timeframe && timeframe !== "1d" && (
            // Intraday templates need Pro to RUN (§5 capability gate) — say
            // so on the card so a free user doesn't discover it via a 403.
            <span
              className="tnum rounded-(--radius-pill) border border-hairline px-1.5 py-0.5 text-caption text-muted"
              title="Intraday strategy — running it needs a Pro plan"
            >
              {timeframe} · Pro
            </span>
          )}
        </span>
      </div>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
        {template.meta.one_liner}
      </p>
      <StrategyPreview spec={template.spec} meta={template.meta} className="mt-4" />
      {hero ? (
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-hairline pt-4">
          <div>
            <div className="text-caption uppercase tracking-widest text-muted">
              {hero.label}
            </div>
            <div
              className={`tnum mt-0.5 text-headline ${hero.negative ? "text-loss" : "text-ink"}`}
            >
              {hero.value}
            </div>
            {range && (
              <div
                className="tnum mt-1 text-caption text-faint"
                title={
                  shortWindow
                    ? "Simulated over this exact window — too short to annualize"
                    : undefined
                }
              >
                {range}
              </div>
            )}
          </div>
          {spark && spark.length > 1 && (
            <div className="pb-1">
              <Sparkline values={spark} width={88} height={30} />
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 border-t border-hairline pt-4 text-xs text-muted">
          Run it to see results
        </div>
      )}
    </Link>
  );
}
