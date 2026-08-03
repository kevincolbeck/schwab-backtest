"use client";

import { useState } from "react";
import type { Trade } from "@/lib/types";
import { fmtDate, fmtMoney, fmtNum } from "@/lib/format";

const PAGE = 50;

export default function TradeTable({
  trades,
  onInspect,
}: {
  trades: Trade[];
  /** When provided, rows become clickable and open the trade inspector. */
  onInspect?: (trade: Trade) => void;
}) {
  const [shown, setShown] = useState(PAGE);
  if (!trades.length) {
    return <p className="text-sm text-muted">No trades in this run.</p>;
  }
  const visible = trades.slice(0, shown);
  return (
    <div className="overflow-x-auto rounded-lg border border-hairline">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-hairline bg-panel text-left text-muted">
            <th className="px-3 py-2 font-medium">Symbol</th>
            <th className="px-3 py-2 font-medium">Side</th>
            <th className="px-3 py-2 font-medium">Entry</th>
            <th className="px-3 py-2 font-medium">Exit</th>
            <th className="px-3 py-2 font-medium text-right">Entry px</th>
            <th className="px-3 py-2 font-medium text-right">Exit px</th>
            <th className="px-3 py-2 font-medium text-right">P&L</th>
            <th className="px-3 py-2 font-medium text-right">R</th>
            <th className="px-3 py-2 font-medium">Exit reason</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((t, i) => (
            <tr
              key={`${t.symbol}-${t.entry_date}-${i}`}
              className={`border-b border-hairline last:border-0 ${
                onInspect ? "cursor-pointer transition-colors hover:bg-accent-soft" : ""
              }`}
              onClick={onInspect ? () => onInspect(t) : undefined}
              onKeyDown={
                onInspect
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onInspect(t);
                      }
                    }
                  : undefined
              }
              tabIndex={onInspect ? 0 : undefined}
              role={onInspect ? "button" : undefined}
              aria-label={
                onInspect
                  ? `Inspect ${t.symbol} trade from ${fmtDate(t.entry_date)} on the chart`
                  : undefined
              }
            >
              <td className="px-3 py-1.5 font-medium">{t.symbol}</td>
              <td className="px-3 py-1.5 text-muted">{t.side}</td>
              <td className="px-3 py-1.5 tnum">{fmtDate(t.entry_date)}</td>
              <td className="px-3 py-1.5 tnum">{fmtDate(t.exit_date)}</td>
              <td className="px-3 py-1.5 tnum text-right">{fmtNum(t.entry_price)}</td>
              <td className="px-3 py-1.5 tnum text-right">{fmtNum(t.exit_price)}</td>
              <td
                className={`px-3 py-1.5 tnum text-right ${
                  t.pnl_dollars >= 0 ? "text-gain" : "text-loss"
                }`}
              >
                {t.pnl_dollars >= 0 ? "+" : ""}
                {fmtMoney(t.pnl_dollars)}
              </td>
              <td className="px-3 py-1.5 tnum text-right">{fmtNum(t.pnl_r)}</td>
              <td className="px-3 py-1.5 text-muted">{t.exit_reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {shown < trades.length && (
        <button
          onClick={() => setShown((s) => s + PAGE)}
          className="w-full border-t border-hairline bg-panel py-2 text-xs text-muted hover:bg-panel-2 hover:text-ink"
        >
          Show more ({trades.length - shown} remaining)
        </button>
      )}
    </div>
  );
}
