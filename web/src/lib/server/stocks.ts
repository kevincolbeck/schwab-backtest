/** Server-side helper for the informational stock pages (SEO surface).
 *
 * Mirrors service `GET /stocks/{ticker}` (service/markets.py `company_bundle`):
 * the endpoint NEVER errors — an unknown ticker returns `found: false`. This
 * helper never throws either, and it distinguishes a definitive miss (404 the
 * page) from an API hiccup (degrade gracefully — a hiccup must never blank or
 * 404 an indexed page).
 *
 * Fetches use `next.revalidate` (NOT `cache: "no-store"`) so the route stays
 * ISR-cacheable under the page's `export const revalidate = 21600`. */
import { BACKTEST_API_URL } from "@/lib/server/backend";

/** 6h — matches the stock route's `export const revalidate = 21600`. */
export const STOCKS_REVALIDATE = 21600;

export type StockProfile = {
  name: string | null;
  logo: string | null;
  /** Finnhub convention: millions of USD. */
  marketCapitalization: number | null;
  industry: string | null;
  website: string | null;
  description: string | null;
};

export type StockBar = {
  time: string; // YYYY-MM-DD
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
};

export type StockStats = {
  last_close: number | null;
  as_of: string | null;
  high_52w: number | null;
  low_52w: number | null;
  avg_volume: number | null;
};

export type StockNewsItem = {
  headline: string;
  image: string | null;
  source: string | null;
  /** Unix seconds. */
  datetime: number | null;
  url: string;
  related: string | null;
};

export type StockBundle = {
  symbol: string;
  configured: boolean;
  profile: StockProfile | null;
  bars: StockBar[];
  stats: StockStats | null;
  next_earnings: { date: string; hour: string | null } | null;
  news: StockNewsItem[];
  disclaimer: string | null;
};

export type StockBundleResult =
  | { status: "found"; bundle: StockBundle }
  /** The service definitively said found:false — a real 404. */
  | { status: "not_found"; symbol: string }
  /** Network/5xx hiccup — render a degraded page, NEVER a 404. */
  | { status: "unavailable"; symbol: string };

export async function getStockBundle(ticker: string): Promise<StockBundleResult> {
  const symbol = decodeURIComponent(ticker ?? "").trim().toUpperCase();
  try {
    const res = await fetch(
      `${BACKTEST_API_URL}/stocks/${encodeURIComponent(symbol)}`,
      { next: { revalidate: STOCKS_REVALIDATE } },
    );
    if (!res.ok) return { status: "unavailable", symbol };
    const body = (await res.json()) as Partial<StockBundle> & { found?: boolean };
    if (!body.found) return { status: "not_found", symbol };
    return {
      status: "found",
      bundle: {
        symbol: body.symbol ?? symbol,
        configured: body.configured ?? false,
        profile: body.profile ?? null,
        bars: body.bars ?? [],
        stats: body.stats ?? null,
        next_earnings: body.next_earnings ?? null,
        news: body.news ?? [],
        disclaimer: body.disclaimer ?? null,
      },
    };
  } catch {
    return { status: "unavailable", symbol };
  }
}

/** Change between the last two SETTLED closes (the day change we can honestly
 *  show — this is an EOD surface, never a live quote). */
export function dayChange(
  bars: StockBar[],
): { abs: number; pct: number; prevClose: number } | null {
  if (bars.length < 2) return null;
  const prev = bars[bars.length - 2].close;
  const last = bars[bars.length - 1].close;
  if (!Number.isFinite(prev) || prev <= 0 || !Number.isFinite(last)) return null;
  return { abs: last - prev, pct: ((last - prev) / prev) * 100, prevClose: prev };
}

/** The stock-page universe emitted in the sitemap. Mirrors the fixed liquid
 *  universe in service/markets.py `SECTORS` (S&P-100-ish + majors) — keep in
 *  sync when that list changes. Follow-up: swap for the engine's full 5k+
 *  symbol cache once the service exposes a cheap symbol-list endpoint. */
export const STOCK_UNIVERSE: string[] = [
  // Tech
  "AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "CRM", "AMD", "ADBE", "CSCO",
  "ACN", "INTC", "IBM", "QCOM", "TXN", "NOW", "INTU", "PLTR", "PANW",
  // Comms
  "GOOGL", "META", "NFLX", "DIS", "TMUS", "VZ", "T", "CMCSA",
  // Consumer
  "AMZN", "TSLA", "HD", "MCD", "NKE", "SBUX", "LOW", "BKNG", "TJX", "F", "ABNB",
  // Financials
  "JPM", "V", "MA", "BAC", "WFC", "GS", "MS", "SCHW", "AXP", "C",
  "BLK", "SPGI", "BX", "KKR",
  // Health
  "LLY", "UNH", "JNJ", "ABBV", "MRK", "TMO", "ABT", "AMGN", "PFE",
  "ISRG", "DHR", "VRTX", "BMY", "GILD", "MDT",
  // Energy
  "XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "OXY",
  // Industrial
  "CAT", "GE", "HON", "UNP", "BA", "DE", "LMT", "RTX", "UPS", "ETN", "ADP", "EMR",
  // Staples
  "PG", "KO", "PEP", "COST", "WMT", "PM", "MO", "CL", "KMB", "MDLZ", "TGT",
  // Materials
  "LIN", "SHW", "APD", "FCX", "NEM",
  // Utilities
  "NEE", "DUK", "SO", "CEG", "AEP",
  // Real estate
  "PLD", "AMT", "EQIX", "SPG", "O",
];
