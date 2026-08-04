"use client";

import { useMemo } from "react";
import CandleChart, { type Bar, type TradeMarker } from "@/components/CandleChart";
import Modal from "@/components/ui/Modal";
import { fmtDate, fmtMoney, fmtNum } from "@/lib/format";
import type { IndicatorSeries, Trade } from "@/lib/types";

const CONTEXT_BARS = 30; // bars of context on each side of the trade

/** Click-a-trade forensics: the exact candles it entered and exited on. */
export default function TradeInspector({
  trade,
  bars,
  indicators = null,
  loading,
  onClose,
}: {
  trade: Trade | null;
  bars: Bar[] | null;
  indicators?: IndicatorSeries[] | null;
  loading: boolean;
  onClose: () => void;
}) {
  const sliced = useMemo(() => {
    if (!trade || !bars?.length) return [];
    const entry = fmtDate(trade.entry_date);
    const exit = fmtDate(trade.exit_date);
    let lo = bars.findIndex((b) => b.time >= entry);
    let hi = bars.findIndex((b) => b.time >= exit);
    if (lo < 0) lo = 0;
    if (hi < 0) hi = bars.length - 1;
    return bars.slice(Math.max(0, lo - CONTEXT_BARS), Math.min(bars.length, hi + CONTEXT_BARS + 1));
  }, [trade, bars]);

  // Indicators ride along on the same context window as the candles.
  const slicedIndicators = useMemo(() => {
    if (!sliced.length || !indicators?.length) return [];
    const lo = sliced[0].time;
    const hi = sliced[sliced.length - 1].time;
    return indicators.map((ind) => ({
      ...ind,
      series: ind.series.filter((p) => p.time >= lo && p.time <= hi),
    }));
  }, [sliced, indicators]);

  const markers: TradeMarker[] = useMemo(() => {
    if (!trade) return [];
    return [
      {
        time: fmtDate(trade.entry_date),
        kind: "entry",
        label: `entry ${fmtNum(trade.entry_price)}`,
      },
      {
        time: fmtDate(trade.exit_date),
        kind: "exit",
        label: `exit ${fmtNum(trade.exit_price)}`,
      },
    ];
  }, [trade]);

  if (!trade) return null;
  const win = trade.pnl_dollars >= 0;
  const stop = Number(trade.initial_stop);

  return (
    <Modal open onClose={onClose} wide title={`${trade.symbol} — ${trade.side} trade`}>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-caption uppercase tracking-wide text-faint">Entry</p>
          <p className="tnum text-sm">
            {fmtDate(trade.entry_date)} @ {fmtNum(trade.entry_price)}
          </p>
        </div>
        <div>
          <p className="text-caption uppercase tracking-wide text-faint">Exit</p>
          <p className="tnum text-sm">
            {fmtDate(trade.exit_date)} @ {fmtNum(trade.exit_price)}
          </p>
        </div>
        <div>
          <p className="text-caption uppercase tracking-wide text-faint">P&L</p>
          <p className={`tnum text-sm ${win ? "text-gain" : "text-loss"}`}>
            {win ? "+" : ""}
            {fmtMoney(trade.pnl_dollars)} ({win ? "won" : "lost"})
          </p>
        </div>
        <div>
          <p className="text-caption uppercase tracking-wide text-faint">Exit reason</p>
          <p className="text-sm text-muted">{trade.exit_reason}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted" role="status">
          Loading candles…
        </div>
      ) : (
        <CandleChart
          bars={sliced}
          markers={markers}
          stopPrice={Number.isFinite(stop) && stop > 0 ? stop : null}
          indicators={slicedIndicators}
          height={340}
        />
      )}
      <p className="mt-3 text-caption leading-relaxed text-faint">
        ▲ entry candle · ▼ exit candle · dashed line = initial stop. Simulated fills
        include slippage; markers sit on the signal dates.
      </p>
    </Modal>
  );
}
