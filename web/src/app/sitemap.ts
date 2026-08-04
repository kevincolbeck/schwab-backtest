import type { MetadataRoute } from "next";
import { STOCK_UNIVERSE } from "@/lib/server/stocks";

/** Sitemap for the public, indexable surfaces.
 *
 * /stocks/{symbol} entries come from STOCK_UNIVERSE — the same fixed liquid
 * universe the service's markets overview reads (service/markets.py SECTORS).
 * Follow-up: expand to the engine's full 5k+ cached symbols once the service
 * exposes a cheap symbol-list endpoint (the pages themselves already serve any
 * cached ticker via ISR + dynamicParams). */

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://schwab-backtest.vercel.app";

const STATIC_ROUTES: { path: string; changeFrequency: "daily" | "weekly"; priority: number }[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/markets", changeFrequency: "daily", priority: 0.9 },
  { path: "/library", changeFrequency: "weekly", priority: 0.8 },
  { path: "/leaderboard", changeFrequency: "daily", priority: 0.8 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.7 },
  { path: "/docs", changeFrequency: "weekly", priority: 0.6 },
  { path: "/docs/first-backtest", changeFrequency: "weekly", priority: 0.5 },
  { path: "/docs/reading-results", changeFrequency: "weekly", priority: 0.5 },
  { path: "/docs/strategy-spec", changeFrequency: "weekly", priority: 0.5 },
  { path: "/docs/forward-testing", changeFrequency: "weekly", priority: 0.5 },
  { path: "/docs/markets-timeframes", changeFrequency: "weekly", priority: 0.5 },
  { path: "/docs/manual-trading", changeFrequency: "weekly", priority: 0.5 },
  { path: "/docs/chat", changeFrequency: "weekly", priority: 0.5 },
  { path: "/docs/credits", changeFrequency: "weekly", priority: 0.5 },
  { path: "/docs/export-python", changeFrequency: "weekly", priority: 0.5 },
  { path: "/docs/export-pine", changeFrequency: "weekly", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...STATIC_ROUTES.map((r) => ({
      url: `${SITE_URL}${r.path}`,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    })),
    // Stock pages refresh once per trading day (settled closes, 6h ISR).
    ...STOCK_UNIVERSE.map((symbol) => ({
      url: `${SITE_URL}/stocks/${symbol}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}
