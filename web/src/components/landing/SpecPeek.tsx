import Card from "@/components/ui/Card";
import { fmtPct } from "@/lib/format";
import type { Indicator, Template } from "@/lib/types";

/** The Lab section's proof object (brief §4): the REAL executable spec of a
 *  shipped template, rendered as the exact mono rule lines the engine runs,
 *  with its real cached result underneath. Truth rule (SYSTEM.md §3): every
 *  line derives from the template JSON fetched server-side — nothing is
 *  illustrated, and when data is missing the row simply doesn't render. */

function indicatorLine(ind: Indicator): string | null {
  if (!ind.name) return null;
  if (ind.formula) return `${ind.name} = ${ind.formula}`;
  const args = [ind.source, ind.length != null ? String(ind.length) : null]
    .filter(Boolean)
    .join(", ");
  return `${ind.name} = ${(ind.type || "").toUpperCase()}(${args})`;
}

export default function SpecPeek({ template }: { template: Template }) {
  const { spec, meta } = template;
  const rows: Array<{ label: string; value: string }> = [];
  if (spec.symbols?.length) rows.push({ label: "universe", value: spec.symbols.join(" · ") });
  for (const ind of spec.indicators ?? []) {
    const line = indicatorLine(ind);
    if (line) rows.push({ label: "indicator", value: line });
  }
  const entry = spec.entry_rule_long ?? spec.entry_rule;
  if (entry) rows.push({ label: "entry", value: entry });
  if (spec.exit_rule) rows.push({ label: "exit", value: spec.exit_rule });

  const cached = template.cached_stats;
  const cagr = cached?.stats?.cagr ?? null;
  const range = cached
    ? `${cached.start_date.slice(0, 4)}–${cached.end_date.slice(0, 4)}`
    : null;
  const meta2 = [
    range,
    spec.backtest_timeframe ?? null,
    cached?.elapsed_seconds != null ? `ran in ${cached.elapsed_seconds.toFixed(1)}s` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card pad="none" className="max-w-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3">
        <p className="truncate text-sm font-medium text-ink">{meta.display_name}</p>
        <span className="shrink-0 rounded-(--radius-pill) border border-hairline px-2 py-0.5 text-caption uppercase tracking-wide text-muted">
          {meta.category}
        </span>
      </div>
      <dl className="space-y-2.5 px-5 py-4">
        {rows.map((r, i) => (
          <div key={`${r.label}-${i}`} className="flex items-baseline gap-3">
            <dt className="w-16 shrink-0 text-caption uppercase tracking-widest text-muted">
              {r.label}
            </dt>
            <dd className="tnum min-w-0 break-words text-sm text-ink">{r.value}</dd>
          </div>
        ))}
      </dl>
      {cagr !== null && (
        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-hairline px-5 py-4">
          <div>
            <p className="text-caption uppercase tracking-widest text-muted">CAGR</p>
            <p className={`tnum mt-0.5 text-headline ${cagr < 0 ? "text-loss" : "text-ink"}`}>
              {fmtPct(cagr, 1)}
            </p>
          </div>
          {meta2 && <p className="tnum pb-1 text-caption text-faint">{meta2}</p>}
        </div>
      )}
    </Card>
  );
}
