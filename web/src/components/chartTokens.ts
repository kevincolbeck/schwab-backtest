"use client";

import { useEffect, useState } from "react";

/** Chart colors resolved from the design tokens at runtime (SYSTEM.md §10:
 *  charts must read tokens — SVG attributes can't consume CSS vars, so we
 *  resolve them with getComputedStyle and re-read on theme flips). */
export interface ChartTokens {
  accent: string;
  prev: string;
  gain: string;
  loss: string;
  hairline: string;
  muted: string;
  mono: string;
  /** Categorical ramp for indicator lines (--chart-1..4): fixed assignment
   *  order, cycle past the end via seriesColor(). Data lines ONLY. */
  series: string[];
}

/* Sanctioned fallbacks (SYSTEM.md §12 pattern): used only before first paint
   and in non-DOM environments. Values MIRROR styles/tokens.css dark theme —
   keep in sync when tokens change. */
const FALLBACK: ChartTokens = {
  accent: "#4da2ff",
  prev: "#37b7ce",
  gain: "#0aa88e",
  loss: "#f4505d",
  hairline: "rgba(148, 163, 184, 0.1)",
  muted: "#98a2b3",
  mono: "ui-monospace, monospace",
  series: ["#8b5cf6", "#e0559d", "#d0742a", "#2aa3c9"],
};

/** Fixed-order categorical assignment: series i keeps its color for life;
 *  past the ramp the colors cycle (legend chips keep identity readable). */
export function seriesColor(tokens: ChartTokens, index: number): string {
  return tokens.series[((index % tokens.series.length) + tokens.series.length) % tokens.series.length];
}

/** One-shot token read (for imperative chart APIs like lightweight-charts). */
export function readChartTokens(): ChartTokens {
  if (typeof window === "undefined") return FALLBACK;
  const s = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) =>
    s.getPropertyValue(name).trim() || fallback;
  return {
    accent: get("--accent", FALLBACK.accent),
    prev: get("--prev-run", FALLBACK.prev),
    gain: get("--gain", FALLBACK.gain),
    loss: get("--loss", FALLBACK.loss),
    hairline: get("--hairline", FALLBACK.hairline),
    muted: get("--muted", FALLBACK.muted),
    mono: get("--font-stack-mono", FALLBACK.mono),
    series: FALLBACK.series.map((fb, i) => get(`--chart-${i + 1}`, fb)),
  };
}

/** Reactive token read for declarative charts (Recharts): re-reads when
 *  [data-theme] flips, via the CandleChart MutationObserver pattern. */
export function useChartTokens(): ChartTokens {
  // Lazy init reads real tokens on the client (FALLBACK only during SSR).
  const [tokens, setTokens] = useState<ChartTokens>(() => readChartTokens());
  useEffect(() => {
    const observer = new MutationObserver(() => setTokens(readChartTokens()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  return tokens;
}
