"use client";

import type { Stats } from "@/lib/types";
import { fmtNum, fmtPct, fmtSignedPct } from "@/lib/format";

interface TileDef {
  key: keyof Stats;
  label: string;
  hint: string;
  fmt: (v: number | null | undefined) => string;
  /** For deltas: is a higher value better? undefined = don't color the delta. */
  higherIsBetter?: boolean;
  deltaSuffix?: string;
}

const TILES: TileDef[] = [
  {
    key: "total_return_pct",
    label: "Total return",
    hint: "How much the starting money grew over the whole test, after slippage.",
    fmt: (v) => fmtSignedPct(v),
    higherIsBetter: true,
    deltaSuffix: "pp",
  },
  {
    key: "cagr",
    label: "CAGR",
    hint: "Compound annual growth rate — the smoothed per-year return.",
    fmt: (v) => fmtPct(v, 2),
    higherIsBetter: true,
    deltaSuffix: "pp",
  },
  {
    key: "max_drawdown",
    label: "Max drawdown",
    hint: "The worst peak-to-bottom drop. How much pain you'd have sat through.",
    fmt: (v) => fmtPct(v),
    higherIsBetter: false,
    deltaSuffix: "pp",
  },
  {
    key: "sharpe",
    label: "Sharpe",
    hint: "Return per unit of volatility. Above 1 is generally considered good.",
    fmt: (v) => fmtNum(v),
    higherIsBetter: true,
  },
  {
    key: "win_rate",
    label: "Win rate",
    hint: "Share of trades that made money. High win rate ≠ profitable by itself.",
    fmt: (v) => fmtPct(v),
    higherIsBetter: true,
    deltaSuffix: "pp",
  },
  {
    key: "total_trades",
    label: "Trades",
    hint: "Number of round-trip trades in the test.",
    fmt: (v) => (v === null || v === undefined ? "—" : String(v)),
  },
  {
    key: "profit_factor",
    label: "Profit factor",
    hint: "Gross profits divided by gross losses. Above 1 means net profitable.",
    fmt: (v) => fmtNum(v),
    higherIsBetter: true,
  },
  {
    key: "expectancy_r",
    label: "Expectancy (R)",
    hint: "Average result per trade, measured in units of initial risk.",
    fmt: (v) => fmtNum(v, 3),
    higherIsBetter: true,
  },
];

function Delta({
  tile,
  current,
  previous,
}: {
  tile: TileDef;
  current: number;
  previous: number;
}) {
  const diff = current - previous;
  if (Math.abs(diff) < 1e-9) return <span className="text-xs text-muted">·</span>;
  const improved =
    tile.higherIsBetter === undefined ? null : diff > 0 === tile.higherIsBetter;
  const color =
    improved === null ? "text-muted" : improved ? "text-gain" : "text-loss";
  const arrow = diff > 0 ? "▲" : "▼";
  const magnitude =
    tile.deltaSuffix === "pp" ? `${Math.abs(diff).toFixed(1)}pp` : Math.abs(diff).toFixed(2);
  // Valence must not be color-alone (WCAG 1.4.1): "better/worse" carries it in
  // text, since ▲ on Max drawdown is a WORSE result.
  const word = improved === null ? "" : improved ? " better" : " worse";
  const ariaLabel =
    improved === null
      ? `${tile.label} changed by ${magnitude} vs previous run`
      : `${tile.label} ${improved ? "improved" : "worsened"} by ${magnitude} vs previous run`;
  return (
    <span className={`tnum text-xs ${color}`} title="Change vs previous run" aria-label={ariaLabel}>
      {arrow} {magnitude}
      {word}
    </span>
  );
}

export default function StatTiles({
  stats,
  prevStats = null,
}: {
  stats: Stats;
  prevStats?: Stats | null;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {TILES.map((tile) => {
        const value = stats[tile.key];
        const prev = prevStats?.[tile.key];
        return (
          <div
            key={String(tile.key)}
            className="group relative rounded-lg border border-hairline bg-panel px-3 py-2.5"
          >
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted">
              {tile.label}
              <button
                type="button"
                className="cursor-help rounded-full text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
                aria-label={`${tile.label}: ${tile.hint}`}
                title={tile.hint}
              >
                ⓘ
              </button>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="tnum text-lg">{tile.fmt(value as number | null)}</span>
              {typeof value === "number" && typeof prev === "number" && (
                <Delta tile={tile} current={value} previous={prev} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
