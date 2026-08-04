"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartTokens } from "@/components/chartTokens";
import type { EquityPoint } from "@/lib/types";
import { fmtDate, fmtMoneyCompact, fmtPct } from "@/lib/format";

interface MergedPoint {
  date: string;
  equity: number | null;
  prevEquity: number | null;
  drawdown: number | null;
}

function mergeCurves(
  curve: EquityPoint[],
  prevCurve: EquityPoint[] | null,
): MergedPoint[] {
  const byDate = new Map<string, MergedPoint>();
  for (const p of curve) {
    const d = fmtDate(p.date);
    byDate.set(d, {
      date: d,
      equity: p.equity,
      prevEquity: null,
      drawdown: p.drawdown_pct === null ? null : -Math.abs(p.drawdown_pct),
    });
  }
  if (prevCurve) {
    for (const p of prevCurve) {
      const d = fmtDate(p.date);
      const existing = byDate.get(d);
      if (existing) {
        existing.prevEquity = p.equity;
      } else {
        byDate.set(d, { date: d, equity: null, prevEquity: p.equity, drawdown: null });
      }
    }
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function yearTicks(data: MergedPoint[]): string[] {
  const seen = new Set<string>();
  const ticks: string[] = [];
  for (const p of data) {
    const year = p.date.slice(0, 4);
    if (!seen.has(year)) {
      seen.add(year);
      ticks.push(p.date);
    }
  }
  return ticks;
}

function EquityTooltip({
  active,
  payload,
  label,
  hasPrev,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number | null }>;
  label?: string;
  hasPrev: boolean;
}) {
  if (!active || !payload?.length) return null;
  const get = (key: string) => payload.find((p) => p.dataKey === key)?.value;
  return (
    <div className="rounded-(--radius-tag) border border-hairline bg-panel-2 px-3 py-2 text-xs shadow-[var(--shadow-card)]">
      <div className="tnum mb-1 text-muted">{label}</div>
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-(--radius-pill)"
          style={{ background: "var(--accent)" }}
        />
        <span className="text-muted">This run</span>
        <span className="tnum ml-auto">{fmtMoneyCompact(get("equity") ?? null)}</span>
      </div>
      {hasPrev && (
        <div className="mt-1 flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-(--radius-pill)"
            style={{ background: "var(--prev-run)" }}
          />
          <span className="text-muted">Previous</span>
          <span className="tnum ml-auto">{fmtMoneyCompact(get("prevEquity") ?? null)}</span>
        </div>
      )}
    </div>
  );
}

/** Equity + drawdown panel (Kevin's keeper — restyled via tokens, never
 *  replaced). SVG strokes can't consume CSS vars, so colors resolve through
 *  useChartTokens (theme-reactive). Previous run = --prev-run ghost curve:
 *  dashed + thinner + legend label, never color alone (SYSTEM.md §2). */
export default function EquityChart({
  curve,
  prevCurve = null,
  height = 320,
}: {
  curve: EquityPoint[];
  prevCurve?: EquityPoint[] | null;
  height?: number;
}) {
  const T = useChartTokens();
  const data = mergeCurves(curve, prevCurve);
  const ticks = yearTicks(data);
  const hasPrev = Boolean(prevCurve?.length);

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={T.hairline} vertical={false} />
          <XAxis
            dataKey="date"
            ticks={ticks}
            tickFormatter={(d: string) => d.slice(0, 4)}
            tick={{ fill: T.muted, fontSize: 11 }}
            axisLine={{ stroke: T.hairline }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => fmtMoneyCompact(v)}
            tick={{ fill: T.muted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={56}
            domain={["auto", "auto"]}
          />
          <Tooltip
            content={<EquityTooltip hasPrev={hasPrev} />}
            cursor={{ stroke: T.muted, strokeDasharray: "3 3" }}
          />
          {hasPrev && (
            <Legend
              verticalAlign="top"
              height={28}
              formatter={(value: string) => (
                <span className="text-xs text-muted">
                  {value === "equity" ? "This run" : "Previous run"}
                </span>
              )}
            />
          )}
          {hasPrev && (
            <Line
              dataKey="prevEquity"
              name="prevEquity"
              stroke={T.prev}
              strokeWidth={2}
              strokeDasharray="6 4"
              strokeOpacity={0.65}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          )}
          <Line
            dataKey="equity"
            name="equity"
            stroke={T.accent}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-1">
        <div className="mb-0.5 pl-1 text-caption text-muted">Drawdown</div>
        <ResponsiveContainer width="100%" height={72}>
          <AreaChart data={data} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" hide />
            <YAxis
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              tick={{ fill: T.muted, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip
              formatter={(value) => [fmtPct(Math.abs(Number(value ?? 0))), "Drawdown"]}
              labelFormatter={(label) => String(label)}
              contentStyle={{
                background: "var(--bg-2)",
                border: "1px solid var(--hairline)",
                borderRadius: "var(--radius-tag)",
                fontSize: 11,
              }}
            />
            <Area
              dataKey="drawdown"
              stroke={T.loss}
              strokeWidth={1}
              strokeOpacity={0.6}
              fill={T.loss}
              fillOpacity={0.12}
              isAnimationActive={false}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
