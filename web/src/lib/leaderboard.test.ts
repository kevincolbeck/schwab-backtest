import { describe, expect, it } from "vitest";
import {
  addWeekdays,
  defaultSortKey,
  parseSortKey,
  projectedUnlockDate,
  sortRows,
} from "@/lib/leaderboard";
import type { LeaderboardEntry, Stats } from "@/lib/types";

function row(
  name: string,
  overrides: Partial<LeaderboardEntry> & { backtest_stats?: Stats | null } = {},
): LeaderboardEntry {
  return {
    slug: name.toLowerCase(),
    name,
    owner: "house",
    deployed_at: "2026-06-01",
    spec_hash_short: "abcdef123456",
    days_live: 0,
    forward_return_pct: 0,
    max_drawdown_pct: 0,
    last_equity: 100000,
    signal_count: 0,
    open_positions: [],
    sparkline: [],
    first_date: null,
    last_date: null,
    ...overrides,
  };
}

describe("addWeekdays", () => {
  it("skips weekends (Fri + 1 = Mon)", () => {
    expect(addWeekdays("2026-08-07", 1)).toBe("2026-08-10");
  });

  it("projects the production unlock: 2026-08-03 + 19 trading days = 2026-08-28", () => {
    expect(addWeekdays("2026-08-03", 19)).toBe("2026-08-28");
  });

  it("returns the input date for n = 0", () => {
    expect(addWeekdays("2026-08-03", 0)).toBe("2026-08-03");
  });
});

describe("projectedUnlockDate", () => {
  it("returns null for an empty board", () => {
    expect(projectedUnlockDate([], 20, "2026-08-04")).toBeNull();
  });

  it("returns null once any record has already unlocked", () => {
    const rows = [{ days_live: 20, last_date: "2026-08-03" }];
    expect(projectedUnlockDate(rows, 20, "2026-08-04")).toBeNull();
  });

  it("projects from the leader's last equity date", () => {
    const rows = [
      { days_live: 5, last_date: "2026-08-01" },
      { days_live: 10, last_date: "2026-07-31" },
    ];
    expect(projectedUnlockDate(rows, 20, "2026-08-01")).toBe("2026-08-14");
  });

  it("matches the production scenario (day 1 of 20 on Mon 2026-08-03)", () => {
    const rows = [{ days_live: 1, last_date: "2026-08-03" }];
    expect(projectedUnlockDate(rows, 20, "2026-08-04")).toBe("2026-08-28");
  });

  it("falls back to today for day-0 boards with no equity yet", () => {
    const rows = [{ days_live: 0, last_date: null }];
    expect(projectedUnlockDate(rows, 20, "2026-08-04")).toBe("2026-09-01");
  });

  it("suppresses projections the stale data would put in the past", () => {
    const rows = [{ days_live: 19, last_date: "2026-01-05" }];
    expect(projectedUnlockDate(rows, 20, "2026-08-04")).toBeNull();
  });
});

describe("defaultSortKey", () => {
  it("leads with backtest Sharpe until any record is verified", () => {
    expect(defaultSortKey(false)).toBe("backtest_sharpe");
    expect(defaultSortKey(true)).toBe("forward_return");
  });
});

describe("parseSortKey", () => {
  it("accepts known keys, first-of-array included", () => {
    expect(parseSortKey("backtest_sharpe")).toBe("backtest_sharpe");
    expect(parseSortKey(["days_live", "forward_return"])).toBe("days_live");
  });

  it("rejects garbage and absence", () => {
    expect(parseSortKey("nonsense")).toBeNull();
    expect(parseSortKey(undefined)).toBeNull();
  });
});

describe("sortRows", () => {
  it("sorts by backtest Sharpe desc with missing stats last", () => {
    const rows = [
      row("NoStats", { backtest_stats: null }),
      row("Low", { backtest_stats: { sharpe: 0.5 } }),
      row("High", { backtest_stats: { sharpe: 1.4 } }),
      row("NullSharpe", { backtest_stats: { sharpe: null } }),
    ];
    expect(sortRows(rows, "backtest_sharpe").map((r) => r.name)).toEqual([
      "High",
      "Low",
      "NoStats",
      "NullSharpe",
    ]);
  });

  it("breaks Sharpe ties by forward return", () => {
    const rows = [
      row("Flat", { backtest_stats: { sharpe: 1.0 }, forward_return_pct: 0 }),
      row("Up", { backtest_stats: { sharpe: 1.0 }, forward_return_pct: 3.2 }),
    ];
    expect(sortRows(rows, "backtest_sharpe")[0].name).toBe("Up");
  });

  it("sorts by forward return and days live", () => {
    const rows = [
      row("A", { forward_return_pct: -2, days_live: 30 }),
      row("B", { forward_return_pct: 8, days_live: 10 }),
    ];
    expect(sortRows(rows, "forward_return")[0].name).toBe("B");
    expect(sortRows(rows, "days_live")[0].name).toBe("A");
  });

  it("does not mutate its input", () => {
    const rows = [row("B"), row("A")];
    sortRows(rows, "forward_return");
    expect(rows.map((r) => r.name)).toEqual(["B", "A"]);
  });
});
