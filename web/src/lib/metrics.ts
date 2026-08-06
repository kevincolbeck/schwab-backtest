import { fmtNum, fmtPct, fmtSignedPct } from "@/lib/format";

/** The metric registry (Section 7 design system).
 *
 *  One definition per statistic: its label, its plain-English hint, how it is
 *  formatted, and whether it is a real P&L value. Every stat surface reads
 *  from here, so the same number cannot be called "CAGR" in one place and
 *  "Annualized" in another, or shown at 1 decimal on the leaderboard and 2 on
 *  the strategy page — both of which were true before this existed.
 *
 *  `isPnl` is the load-bearing field. Valence colour (green/red) is for REAL
 *  profit and loss only, never decoration — SYSTEM.md §2. Max drawdown is a
 *  magnitude, not a loss, and a backtest's return is hypothetical; colouring
 *  either implies a claim the number can't support. `Stat` refuses
 *  valence="auto" on any metric where this is false.
 *
 *  Wording is carried over verbatim from the original TILES table in
 *  StatTiles.tsx and the hand-copied hints in leaderboard/page.tsx, so this
 *  consolidation changes no user-visible copy.
 */

export interface MetricDef {
  label: string;
  /** Plain-English explanation. Jargon is never unexplained (CLAUDE.md). */
  hint: string;
  fmt: (v: number | null | undefined) => string;
  /** For deltas: is a bigger number better? Undefined = no direction. */
  higherIsBetter?: boolean;
  /** Unit suffix for a delta, e.g. "pp" for percentage points. */
  deltaSuffix?: string;
  /** True ONLY for realised, out-of-sample P&L. Gates valence colour. */
  isPnl?: boolean;
}

export const METRICS = {
  total_return_pct: {
    label: "Total return",
    hint: "How much the starting money grew over the whole test, after slippage.",
    fmt: (v) => fmtSignedPct(v),
    higherIsBetter: true,
    deltaSuffix: "pp",
  },
  cagr: {
    label: "CAGR",
    hint: "Compound annual growth rate — the smoothed per-year return.",
    fmt: (v) => fmtPct(v, 2),
    higherIsBetter: true,
    deltaSuffix: "pp",
  },
  max_drawdown: {
    label: "Max drawdown",
    hint: "The worst peak-to-bottom drop. How much pain you'd have sat through.",
    fmt: (v) => fmtPct(v),
    higherIsBetter: false,
    deltaSuffix: "pp",
    // A magnitude, not a loss. Rendered in ink everywhere.
    isPnl: false,
  },
  sharpe: {
    label: "Sharpe",
    hint: "Return per unit of volatility. Above 1 is generally considered good.",
    fmt: (v) => fmtNum(v),
    higherIsBetter: true,
  },
  win_rate: {
    label: "Win rate",
    hint: "Share of trades that made money. High win rate ≠ profitable by itself.",
    fmt: (v) => fmtPct(v),
    higherIsBetter: true,
    deltaSuffix: "pp",
  },
  total_trades: {
    label: "Trades",
    hint: "Number of round-trip trades in the test.",
    fmt: (v) => (v === null || v === undefined ? "—" : String(v)),
  },
  profit_factor: {
    label: "Profit factor",
    hint: "Gross profits divided by gross losses. Above 1 means net profitable.",
    fmt: (v) => fmtNum(v),
    higherIsBetter: true,
  },
  expectancy_r: {
    label: "Expectancy (R)",
    hint: "Average result per trade, measured in units of initial risk.",
    fmt: (v) => fmtNum(v, 3),
    higherIsBetter: true,
  },
  /** The ONE metric on the site that earns valence colour: realised,
   *  out-of-sample, on frozen rules. */
  forward_return_pct: {
    label: "Forward return",
    hint: "Return since the rules were frozen, on data that did not exist when the strategy was written.",
    fmt: (v) => fmtSignedPct(v),
    higherIsBetter: true,
    deltaSuffix: "pp",
    isPnl: true,
  },
  days_live: {
    label: "Days live",
    hint: "Trading days the frozen strategy has been scored on fresh data.",
    fmt: (v) => (v === null || v === undefined ? "—" : String(v)),
  },
} satisfies Record<string, MetricDef>;

export type MetricKey = keyof typeof METRICS;

export function metric(key: MetricKey): MetricDef {
  return METRICS[key];
}
