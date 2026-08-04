import { describe, expect, it } from "vitest";
import {
  partitionTemplates,
  templateHero,
  wallTemplates,
  windowDays,
} from "@/lib/templates";
import type { Template } from "@/lib/types";

function tpl(
  id: string,
  opts: {
    cagr?: number | null;
    total?: number | null;
    start?: string;
    end?: string;
    noStats?: boolean;
  } = {},
): Template {
  return {
    id,
    meta: {
      display_name: id,
      category: "Test",
      difficulty: "starter",
      one_liner: "",
      explainer_md: "",
    },
    spec: { name: id },
    cached_stats: opts.noStats
      ? null
      : {
          stats: { cagr: opts.cagr ?? null, total_return_pct: opts.total ?? null },
          start_date: opts.start ?? "2016-01-01",
          end_date: opts.end ?? "2026-08-03",
        },
  };
}

describe("windowDays", () => {
  it("measures the production intraday window as 45 days", () => {
    expect(windowDays("2026-06-19", "2026-08-03")).toBe(45);
  });

  it("handles same-day and cross-year windows", () => {
    expect(windowDays("2026-08-03", "2026-08-03")).toBe(0);
    expect(windowDays("2025-12-01", "2026-01-31")).toBe(61);
    expect(windowDays("2016-01-01", "2026-08-03")).toBeGreaterThan(365);
  });
});

describe("templateHero", () => {
  it("uses CAGR for year-plus windows", () => {
    expect(templateHero(tpl("a", { cagr: 21.8, total: 709 }))).toEqual({
      kind: "cagr",
      value: 21.8,
    });
  });

  it("refuses to annualize short windows (the −57% trap)", () => {
    const t = tpl("rb15", {
      cagr: -57.17,
      total: -9.29,
      start: "2026-06-19",
      end: "2026-08-03",
    });
    expect(templateHero(t)).toEqual({ kind: "total_return", value: -9.29 });
  });

  it("flips exactly at the 365-day boundary", () => {
    const long = tpl("l", { cagr: 5, total: 5, start: "2025-08-03", end: "2026-08-03" });
    const short = tpl("s", { cagr: 5, total: 4, start: "2025-08-04", end: "2026-08-03" });
    expect(templateHero(long)).toEqual({ kind: "cagr", value: 5 });
    expect(templateHero(short)).toEqual({ kind: "total_return", value: 4 });
  });

  it("falls back to total return when CAGR is missing on a long window", () => {
    expect(templateHero(tpl("a", { cagr: null, total: 12 }))).toEqual({
      kind: "total_return",
      value: 12,
    });
  });

  it("returns null without stats or with all-null stats", () => {
    expect(templateHero(tpl("a", { noStats: true }))).toBeNull();
    expect(templateHero(tpl("b", { cagr: null, total: null }))).toBeNull();
    expect(templateHero(tpl("c", { cagr: NaN, total: null }))).toBeNull();
  });
});

describe("partitionTemplates", () => {
  const fixture = [
    tpl("golden-cross", { cagr: 21.76 }),
    tpl("statless", { noStats: true }),
    tpl("vwap-15m", { cagr: -42.57, total: -6.18, start: "2026-06-19", end: "2026-08-03" }),
    tpl("donchian", { cagr: 29.42 }),
    tpl("range-15m", { cagr: -57.17, total: -9.29, start: "2026-06-19", end: "2026-08-03" }),
    tpl("macd", { cagr: 25.16 }),
  ];

  it("splits and orders winners-first / worst-first / unproven", () => {
    const p = partitionTemplates(fixture);
    expect(p.flagship.map((t) => t.id)).toEqual(["donchian", "macd", "golden-cross"]);
    expect(p.failed.map((t) => t.id)).toEqual(["range-15m", "vwap-15m"]);
    expect(p.unproven.map((t) => t.id)).toEqual(["statless"]);
  });

  it("classifies by the DISPLAYED stat: short-window negative CAGR but positive total return is flagship", () => {
    const p = partitionTemplates([
      tpl("odd", { cagr: -3, total: 2.5, start: "2026-06-19", end: "2026-08-03" }),
    ]);
    expect(p.flagship.map((t) => t.id)).toEqual(["odd"]);
    expect(p.failed).toEqual([]);
  });

  it("handles all-negative and empty inputs", () => {
    const p = partitionTemplates([tpl("a", { cagr: -5 }), tpl("b", { cagr: -1 })]);
    expect(p.flagship).toEqual([]);
    expect(p.failed.map((t) => t.id)).toEqual(["a", "b"]);
    expect(partitionTemplates([])).toEqual({ flagship: [], failed: [], unproven: [] });
  });

  it("breaks ties by id and does not mutate its input", () => {
    const rows = [tpl("b", { cagr: 5 }), tpl("a", { cagr: 5 })];
    const p = partitionTemplates(rows);
    expect(p.flagship.map((t) => t.id)).toEqual(["a", "b"]);
    expect(rows.map((t) => t.id)).toEqual(["b", "a"]);
  });
});

describe("wallTemplates", () => {
  it("takes flagship top 6", () => {
    const p = partitionTemplates(
      Array.from({ length: 9 }, (_, i) => tpl(`t${i}`, { cagr: 20 - i })),
    );
    expect(wallTemplates(p)).toHaveLength(6);
    expect(wallTemplates(p)[0].id).toBe("t0");
  });

  it("falls back to unproven, and never returns failed templates", () => {
    const p = partitionTemplates([
      tpl("failed", { cagr: -5 }),
      tpl("mystery", { noStats: true }),
    ]);
    expect(wallTemplates(p).map((t) => t.id)).toEqual(["mystery"]);
    const allFailed = partitionTemplates([tpl("a", { cagr: -5 })]);
    expect(wallTemplates(allFailed)).toEqual([]);
  });
});
