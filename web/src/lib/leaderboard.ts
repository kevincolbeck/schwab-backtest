import { todayISO } from "@/lib/format";
import type { LeaderboardEntry } from "@/lib/types";

/* ── Leaderboard presentation logic ──────────────────────────────────────────
   Pure functions only — the page (a server component) calls these per request,
   and they are unit-testable without a DOM or a running service. */

export type SortKey = "backtest_sharpe" | "forward_return" | "days_live";

export const SORT_LABELS: Record<SortKey, string> = {
  backtest_sharpe: "Backtest Sharpe",
  forward_return: "Forward return",
  days_live: "Days live",
};

const SORT_KEYS = Object.keys(SORT_LABELS) as SortKey[];

/** Parse a `?sort=` value; unknown/absent → null so callers fall back to
 *  `defaultSortKey`. */
export function parseSortKey(raw: string | string[] | undefined): SortKey | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return SORT_KEYS.includes(value as SortKey) ? (value as SortKey) : null;
}

/** Hypothetical numbers lead only until the first verified record exists —
 *  from then on the live out-of-sample return is the headline. */
export function defaultSortKey(anyVerified: boolean): SortKey {
  return anyVerified ? "forward_return" : "backtest_sharpe";
}

function num(value: unknown): number | null {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

/** Sort a merged board. Rows missing the sorted stat go last; ties break
 *  toward the stronger live record, then name for determinism. */
export function sortRows<T extends LeaderboardEntry>(rows: T[], key: SortKey): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  const desc = (a: number | null, b: number | null): number => {
    if (a === null && b === null) return 0;
    if (a === null) return 1; // nulls last
    if (b === null) return -1;
    return b - a;
  };
  const sorted = [...rows];
  if (key === "backtest_sharpe") {
    sorted.sort(
      (a, b) =>
        desc(num(a.backtest_stats?.sharpe), num(b.backtest_stats?.sharpe)) ||
        desc(a.forward_return_pct, b.forward_return_pct) ||
        byName(a, b),
    );
  } else if (key === "forward_return") {
    sorted.sort(
      (a, b) =>
        desc(a.forward_return_pct, b.forward_return_pct) ||
        desc(a.days_live, b.days_live) ||
        byName(a, b),
    );
  } else {
    sorted.sort(
      (a, b) =>
        desc(a.days_live, b.days_live) ||
        desc(a.forward_return_pct, b.forward_return_pct) ||
        byName(a, b),
    );
  }
  return sorted;
}

/** Add n weekdays to an ISO date (UTC math, skips Sat/Sun). Market holidays
 *  are NOT modeled — callers must phrase results as "expected". */
export function addWeekdays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  let remaining = n;
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return d.toISOString().slice(0, 10);
}

/** Projected date the leading strategy completes `minDays` trading days.
 *  Base = the `last_date` of the row with the most days live (the worker
 *  backfills missed days on its next pass, so equity-date arithmetic stays
 *  correct even when it lags), falling back to today for day-0 boards.
 *  Returns null when there is nothing to project (empty board, a record has
 *  already unlocked) or when stale data would put the "expected" date in the
 *  past — omitting the date is honest; showing a wrong one is not. */
export function projectedUnlockDate(
  rows: Array<{ days_live: number; last_date: string | null }>,
  minDays: number,
  todayIso: string = todayISO(),
): string | null {
  if (rows.length === 0) return null;
  const leader = rows.reduce((a, b) => (b.days_live > a.days_live ? b : a));
  if (leader.days_live >= minDays) return null;
  const base = leader.last_date ?? todayIso;
  const unlock = addWeekdays(base, minDays - leader.days_live);
  return unlock >= todayIso ? unlock : null;
}
