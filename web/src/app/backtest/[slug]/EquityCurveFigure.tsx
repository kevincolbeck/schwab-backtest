"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartTokens } from "@/components/chartTokens";
import { fmtDate, fmtMoneyCompact, fmtPct } from "@/lib/format";
import type { TemplateCurve } from "@/lib/server/templatePages";

/** Equity curve for a strategy page (Section 4 §4).
 *
 *  The spec requires "an accessible text/table alternative", and that is not
 *  decoration: a canvas chart is invisible to a screen reader, and the numbers
 *  in it are the entire point of the page. The <details> table below carries
 *  the same series, so nothing on this page is available only to people who
 *  can see it. The figure is also aria-hidden precisely BECAUSE the table
 *  exists — otherwise a screen reader reads a wall of unlabelled SVG.
 */
export default function EquityCurveFigure({
  name,
  curve,
}: {
  name: string;
  curve: TemplateCurve | null;
}) {
  const tokens = useChartTokens();

  if (!curve?.points?.length) {
    return (
      <p className="mt-2 text-sm text-muted">
        The equity curve for this strategy isn&rsquo;t cached right now.
      </p>
    );
  }

  const data = curve.points.map((p) => ({
    date: fmtDate(p.d),
    equity: p.e,
    drawdown: p.dd === null ? null : -Math.abs(p.dd),
  }));
  const first = curve.points[0];
  const last = curve.points[curve.points.length - 1];
  const worst = curve.points.reduce(
    (acc, p) => ((p.dd ?? 0) > (acc.dd ?? 0) ? p : acc),
    curve.points[0],
  );

  return (
    <figure className="mt-4">
      <div className="h-64 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
              data={data}
              margin={{ top: 6, right: 6, bottom: 0, left: 0 }}
              tabIndex={-1}
              role="presentation"
            >
            <defs>
              <linearGradient id="eqfill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={tokens.accent} stopOpacity={0.28} />
                <stop offset="100%" stopColor={tokens.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={tokens.hairline} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: tokens.muted, fontSize: 11 }}
              minTickGap={48}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: tokens.muted, fontSize: 11 }}
              tickFormatter={(v) => fmtMoneyCompact(Number(v))}
              width={56}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--bg-2)",
                border: `1px solid ${tokens.hairline}`,
                borderRadius: "var(--radius-tag)",
                fontSize: 12,
              }}
              formatter={(v) => fmtMoneyCompact(Number(v ?? 0))}
            />
            <Area
              type="monotone"
              dataKey="equity"
              stroke={tokens.accent}
              strokeWidth={2}
              fill="url(#eqfill)"
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <figcaption className="mt-2 text-caption text-faint">
        {name} account equity, {curve.start_date} to {curve.end_date} on{" "}
        {curve.timeframe} bars, starting from{" "}
        {fmtMoneyCompact(Number(first.e ?? 0))}. Drawn from {curve.points.length}{" "}
        sampled points of {curve.raw_points.toLocaleString("en-US")} — the
        sample always keeps the start, the end, and the deepest drawdown.
      </figcaption>

      <details className="mt-3">
        <summary className="focus-ring inline-flex min-h-11 cursor-pointer items-center text-caption text-muted hover:text-ink">
          Read the curve as a table
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-caption">
            <caption className="sr-only">
              {name} equity curve: date, account equity and drawdown at each
              sampled point.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="py-1 pr-4 text-left font-medium text-muted">
                  Point
                </th>
                <th scope="col" className="py-1 pr-4 text-left font-medium text-muted">
                  Date
                </th>
                <th scope="col" className="py-1 pr-4 text-left font-medium text-muted">
                  Equity
                </th>
                <th scope="col" className="py-1 text-left font-medium text-muted">
                  Drawdown
                </th>
              </tr>
            </thead>
            <tbody className="tnum">
              <tr>
                <th scope="row" className="py-1 pr-4 text-left font-normal text-muted">
                  Start
                </th>
                <td className="py-1 pr-4">{fmtDate(first.d)}</td>
                <td className="py-1 pr-4">{fmtMoneyCompact(Number(first.e ?? 0))}</td>
                <td className="py-1">{fmtPct(first.dd ?? 0)}</td>
              </tr>
              <tr>
                <th scope="row" className="py-1 pr-4 text-left font-normal text-muted">
                  Deepest drawdown
                </th>
                <td className="py-1 pr-4">{fmtDate(worst.d)}</td>
                <td className="py-1 pr-4">{fmtMoneyCompact(Number(worst.e ?? 0))}</td>
                <td className="py-1 text-loss">{fmtPct(worst.dd ?? 0)}</td>
              </tr>
              <tr>
                <th scope="row" className="py-1 pr-4 text-left font-normal text-muted">
                  End
                </th>
                <td className="py-1 pr-4">{fmtDate(last.d)}</td>
                <td className="py-1 pr-4">{fmtMoneyCompact(Number(last.e ?? 0))}</td>
                <td className="py-1">{fmtPct(last.dd ?? 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
