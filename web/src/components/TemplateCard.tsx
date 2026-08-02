import Link from "next/link";
import type { Template } from "@/lib/types";
import { fmtNum, fmtPct, fmtSignedPct } from "@/lib/format";

export default function TemplateCard({ template }: { template: Template }) {
  const s = template.cached_stats?.stats;
  const cagr = s?.cagr ?? null;
  return (
    <Link
      href={`/playground?template=${encodeURIComponent(template.id)}`}
      className="group flex flex-col rounded-xl border border-hairline bg-panel p-4 transition-colors hover:border-accent"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-tight">{template.meta.display_name}</h3>
        <span className="shrink-0 rounded-full border border-hairline px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
          {template.meta.category}
        </span>
      </div>
      <p className="mt-2 flex-1 text-xs leading-relaxed text-muted">
        {template.meta.one_liner}
      </p>
      {s ? (
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-hairline pt-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted">CAGR</div>
            <div className={`tnum text-base ${cagr !== null && cagr < 0 ? "text-loss" : ""}`}>
              {fmtPct(cagr, 1)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted">Return</div>
            <div className="tnum text-base">{fmtSignedPct(s.total_return_pct ?? null, 0)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted">Max DD</div>
            <div className="tnum text-base">{fmtPct(s.max_drawdown ?? null, 0)}</div>
          </div>
        </div>
      ) : (
        <div className="mt-3 border-t border-hairline pt-3 text-xs text-muted">
          Run it to see results
        </div>
      )}
      {s && (
        <div className="mt-2 flex items-center justify-between text-[10px] text-muted">
          <span className="tnum">
            {template.cached_stats?.start_date.slice(0, 4)}–
            {template.cached_stats?.end_date.slice(0, 4)} · Sharpe {fmtNum(s.sharpe ?? null)}
          </span>
          <span className="text-accent opacity-0 transition-opacity group-hover:opacity-100">
            Open →
          </span>
        </div>
      )}
    </Link>
  );
}
