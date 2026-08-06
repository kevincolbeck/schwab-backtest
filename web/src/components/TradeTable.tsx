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
    <div className="overflow-x-auto rounded-(--radius-card) border border-hairline">
      <table className="w-full text-xs">
        <caption className="sr-only">
          Every trade in this run: symbol, side, entry and exit dates and
          prices, profit or loss, R multiple, and why the position closed.
        </caption>
        <thead>
          <tr className="border-b border-hairline bg-panel text-left text-muted">
            <th scope="col" className="px-3 py-2 font-medium">Symbol</th>
            <th scope="col" className="px-3 py-2 font-medium">Side</th>
            <th scope="col" className="px-3 py-2 font-medium">Entry</th>
            <th scope="col" className="px-3 py-2 font-medium">Exit</th>
            <th scope="col" className="px-3 py-2 font-medium text-right">Entry px</th>
            <th scope="col" className="px-3 py-2 font-medium text-right">Exit px</th>
            <th scope="col" className="px-3 py-2 font-medium text-right">P&L</th>
            <th scope="col" className="px-3 py-2 font-medium text-right">R</th>
            <th scope="col" className="px-3 py-2 font-medium">Exit reason</th>
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
              // Deliberately NOT role="button"/tabIndex here: that role is
              // Children Presentational, which hides every cell from
              // assistive tech. The row click stays as a mouse convenience;
              // the keyboard/AT path is the real button in the first cell.
            >
              <td className="px-3 py-1.5 font-medium">
                {onInspect ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onInspect(t);
                    }}
                    className="focus-ring tap-target -mx-1 inline-flex items-center rounded-(--radius-tag) px-1 hover:text-accent"
                  >
                    {t.symbol}
                    <span className="sr-only">
                      {" "}— inspect this {fmtDate(t.entry_date)} trade on the chart
                    </span>
                  </button>
                ) : (
                  t.symbol
                )}
              </td>
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
          className="focus-ring w-full border-t border-hairline bg-panel py-2 text-xs text-muted transition-colors duration-(--dur-micro) hover:bg-panel-2 hover:text-ink"
        >
          Show more ({trades.length - shown} remaining)
        </button>
      )}
    </div>
  );
}
