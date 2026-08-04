import Link from "next/link";
import Sparkline from "@/components/Sparkline";
import StrategyPreview from "@/components/StrategyPreview";
import type { Template } from "@/lib/types";
import { fmtPct, fmtSignedPct } from "@/lib/format";

/** Template/strategy card, redesigned per brief §4: name, one-liner, THE
 *  number (CAGR — total return when CAGR is absent) as the mono hero stat,
 *  tiny sparkline, category tag. Everything else lives on the detail view.
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
  const s = template.cached_stats?.stats;
  const cagr = s?.cagr ?? null;
  const totalReturn = s?.total_return_pct ?? null;
  const hero =
    cagr !== null
      ? { label: "CAGR", value: fmtPct(cagr, 1), negative: cagr < 0 }
      : totalReturn !== null
        ? { label: "Total return", value: fmtSignedPct(totalReturn, 0), negative: totalReturn < 0 }
        : null;
  const range = template.cached_stats
    ? `${template.cached_stats.start_date.slice(0, 4)}–${template.cached_stats.end_date.slice(0, 4)}`
    : null;

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
        <span className="shrink-0 rounded-(--radius-pill) border border-hairline px-2 py-0.5 text-caption uppercase tracking-wide text-muted">
          {template.meta.category}
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
            {range && <div className="tnum mt-1 text-caption text-faint">{range}</div>}
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
