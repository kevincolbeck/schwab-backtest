import { BACKTEST_API_URL } from "@/lib/server/backend";
import type { StrategyPagePayload } from "@/lib/types";

/** Shared data + design tokens for the shareable record cards (P1-3).
 *
 * Two surfaces render the same record: the landscape OG card
 * (strategy/[slug]/opengraph-image.tsx, 1200x630, what social platforms
 * scrape) and the square downloadable card (strategy/[slug]/card, 1080x1080,
 * what a person posts by hand). They share this module so a change to what a
 * record CLAIMS can't land on one and miss the other.
 *
 * Honesty rules baked in here, not left to each layout:
 *  - forward return is the VERIFIED number; CAGR/Sharpe come from the
 *    backtest and must always be labelled hypothetical. The two are never
 *    merged or added together.
 *  - a record under the 20-trading-day threshold is "warming up", never
 *    presented as a verified track record — a 2-day number must not be
 *    shareable as proof.
 */

// Sanctioned hardcode (design/SYSTEM.md §12): OG renders off-DOM and cannot
// read CSS custom properties. Mirrors styles/tokens.css dark values.
export const CARD = {
  BG: "#0c0f14", // --bg-0
  PANEL: "#12151c", // --bg-1
  HAIRLINE: "rgba(148, 163, 184, 0.22)", // --hairline-strong
  INK: "#e9edf4", // --ink
  MUTED: "#98a2b3", // --muted
  ACCENT: "#4da2ff", // --accent
  GAIN: "#0aa88e", // --gain
  LOSS: "#f4505d", // --loss
} as const;

export const DISCLAIMER_LINE =
  "Simulated performance for research/education. Not financial advice.";

/** Matches service/forward.py MIN_LEADERBOARD_DAYS. */
export const VERIFY_DAYS = 20;

export async function getRecord(slug: string): Promise<StrategyPagePayload | null> {
  try {
    const res = await fetch(
      `${BACKTEST_API_URL}/strategy/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as StrategyPagePayload;
  } catch {
    return null;
  }
}

export interface RecordCardData {
  name: string;
  forwardPct: number;
  daysLive: number;
  /** True once the record clears the verification window. */
  verified: boolean;
  /** Status line that must accompany the forward number. */
  statusLabel: string;
  specHash: string;
  /** Backtest (hypothetical) figures — null when the deployment predates stats. */
  cagr: number | null;
  sharpe: number | null;
  maxDrawdownPct: number | null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function toCardData(data: StrategyPagePayload): RecordCardData {
  const { deployment, summary, backtest_stats } = data;
  const daysLive = summary.days_live ?? 0;
  const verified = daysLive >= VERIFY_DAYS;
  return {
    name:
      deployment.name.length > 70
        ? `${deployment.name.slice(0, 69)}…`
        : deployment.name,
    forwardPct: summary.forward_return_pct,
    daysLive,
    verified,
    // Never let a 2-day number read as proof.
    statusLabel: verified
      ? `verified · ${daysLive} trading days live`
      : `warming up · day ${daysLive} of ${VERIFY_DAYS}`,
    specHash: deployment.spec_hash.slice(0, 12),
    cagr: num(backtest_stats?.cagr),
    sharpe: num(backtest_stats?.sharpe),
    maxDrawdownPct: num(summary.max_drawdown_pct),
  };
}
