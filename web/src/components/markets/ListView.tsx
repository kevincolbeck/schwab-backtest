"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import { fmtNum } from "@/lib/format";
import {
  type CalendarKind,
  type CalendarRow,
  HOUR_BADGES,
  fmtRevenue,
  fmtShares,
  rowTicker,
} from "./types";

function TickerLink({ ticker }: { ticker: string | null }) {
  if (!ticker) return <span className="text-ink">—</span>;
  return (
    <Link
      href={`/stocks/${encodeURIComponent(ticker)}`}
      className="focus-ring rounded-(--radius-tag) font-medium text-ink hover:text-accent"
    >
      {ticker}
    </Link>
  );
}

/** The power-user fallback: the whole month as one dense table (the old flat
 *  layout, kept alive behind the List toggle). */
export default function ListView({
  kind,
  rows,
}: {
  kind: CalendarKind;
  rows: CalendarRow[];
}) {
  if (rows.length === 0) {
    return (
      <Card pad="sm" className="border-dashed text-sm text-muted">
        Nothing on the calendar this month yet — check back after the next
        refresh.
      </Card>
    );
  }
  return (
    <Card pad="none" className="overflow-hidden">
      <div className="overflow-x-auto">
        {kind === "earnings" ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline bg-panel-2 text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Symbol</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 text-right font-medium">EPS est.</th>
                <th className="px-4 py-2.5 text-right font-medium">EPS actual</th>
                <th className="px-4 py-2.5 text-right font-medium">Rev. est.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={`${row.symbol}-${row.date}-${i}`}
                  className="border-b border-hairline last:border-0"
                >
                  <td className="px-4 py-2.5">
                    <TickerLink ticker={rowTicker(row)} />
                  </td>
                  <td className="tnum px-4 py-2.5 text-muted">{row.date}</td>
                  <td className="px-4 py-2.5 text-muted">
                    {row.hour ? (HOUR_BADGES[row.hour]?.label ?? row.hour) : "—"}
                  </td>
                  <td className="tnum px-4 py-2.5 text-right">
                    {fmtNum(row.epsEstimate)}
                  </td>
                  <td className="tnum px-4 py-2.5 text-right">
                    {fmtNum(row.epsActual)}
                  </td>
                  <td className="tnum px-4 py-2.5 text-right">
                    {fmtRevenue(row.revenueEstimate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline bg-panel-2 text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Symbol</th>
                <th className="px-4 py-2.5 font-medium">Company</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Exchange</th>
                <th className="px-4 py-2.5 text-right font-medium">Price</th>
                <th className="px-4 py-2.5 text-right font-medium">Shares</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={`${row.symbol ?? row.name}-${row.date}-${i}`}
                  className="border-b border-hairline last:border-0"
                >
                  <td className="px-4 py-2.5">
                    <TickerLink ticker={rowTicker(row)} />
                  </td>
                  <td className="max-w-52 truncate px-4 py-2.5 text-muted">
                    {row.name ?? "—"}
                  </td>
                  <td className="tnum px-4 py-2.5 text-muted">{row.date}</td>
                  <td className="px-4 py-2.5 text-muted">{row.exchange ?? "—"}</td>
                  <td className="tnum px-4 py-2.5 text-right">
                    {row.price !== null && row.price !== undefined && row.price !== ""
                      ? `$${String(row.price)}`
                      : "—"}
                  </td>
                  <td className="tnum px-4 py-2.5 text-right">
                    {fmtShares(row.numberOfShares)}
                  </td>
                  <td className="px-4 py-2.5 text-muted">
                    {row.status ? (
                      <span className="rounded-(--radius-pill) border border-hairline px-2 py-0.5 text-caption uppercase tracking-wide">
                        {row.status}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
