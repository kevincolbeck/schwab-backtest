/** Shapes mirror service/markets.py trims exactly — the service is the source
 *  of truth; everything here is defensive-optional so an API hiccup can never
 *  blank the page. */

export type CalendarKind = "earnings" | "ipo";

/** One month-calendar row. Earnings and IPO rows share the shape (fields the
 *  other kind doesn't carry are simply absent). */
export type CalendarRow = {
  symbol?: string | null;
  date: string;
  // earnings
  epsEstimate?: number | null;
  epsActual?: number | null;
  revenueEstimate?: number | null;
  hour?: string | null;
  // ipo
  name?: string | null;
  exchange?: string | null;
  price?: string | number | null;
  status?: string | null;
  numberOfShares?: number | null;
  // /markets/day earnings enrichment only
  profile?: Profile | null;
};

/** Day-panel enrichment from Finnhub profile2 (marketCapitalization is in
 *  MILLIONS of USD — Finnhub's unit). */
export type Profile = {
  name?: string | null;
  logo?: string | null;
  marketCapitalization?: number | null;
};

export type MonthPayload = {
  kind: CalendarKind;
  year: number;
  month: number;
  configured: boolean;
  rows: CalendarRow[];
};

export type DayPayload = {
  date: string;
  kind: CalendarKind;
  configured: boolean;
  rows: CalendarRow[];
};

export type NewsArticle = {
  headline: string;
  image: string | null;
  source: string | null;
  /** Unix seconds. */
  datetime: number | null;
  url: string;
  /** Comma-separated related tickers, e.g. "AAPL,MSFT". */
  related: string | null;
};

export const EMPTY_MONTH = (
  kind: CalendarKind,
  year: number,
  month: number,
): MonthPayload => ({ kind, year, month, configured: false, rows: [] });

export function parseMonthPayload(
  body: Partial<MonthPayload> | null | undefined,
  kind: CalendarKind,
  year: number,
  month: number,
): MonthPayload {
  return {
    kind,
    year,
    month,
    configured: body?.configured ?? false,
    rows: Array.isArray(body?.rows) ? body.rows : [],
  };
}

// ── Date helpers (pure string math — no toISOString(), no TZ drift) ─────────

const pad2 = (n: number) => String(n).padStart(2, "0");

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function todayLocalISO(): string {
  const now = new Date();
  return isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const next = new Date(y, m - 1, d + days);
  return isoDate(next.getFullYear(), next.getMonth() + 1, next.getDate());
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 0 = Monday … 6 = Sunday (the grid is Monday-first, like the service's
 *  week window). */
export function mondayIndex(year: number, month: number, day: number): number {
  return (new Date(year, month - 1, day).getDay() + 6) % 7;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December",
];
const WEEKDAYS_LONG = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month - 1] ?? "—"} ${year}`;
}

/** "Tuesday, Aug 12" from an ISO date. */
export function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${WEEKDAYS_LONG[mondayIndex(y, m, d)]}, ${MONTHS[m - 1].slice(0, 3)} ${d}`;
}

// ── Formatting ──────────────────────────────────────────────────────────────

/** Finnhub market caps arrive in millions of USD. */
export function fmtMarketCap(millions: number | null | undefined): string {
  if (millions === null || millions === undefined || Number.isNaN(millions) || millions <= 0)
    return "—";
  if (millions >= 1_000_000) return `$${(millions / 1_000_000).toFixed(1)}T`;
  if (millions >= 1_000) return `$${(millions / 1_000).toFixed(1)}B`;
  return `$${Math.round(millions)}M`;
}

export function fmtRevenue(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function fmtShares(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value) || value <= 0) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M sh`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k sh`;
  return `${Math.round(value)} sh`;
}

/** "2h ago" style relative timestamps for news; falls back to the date. */
export function relTime(unixSeconds: number | null | undefined, now = Date.now()): string {
  if (!unixSeconds || Number.isNaN(unixSeconds)) return "";
  const s = Math.max(0, Math.floor(now / 1000 - unixSeconds));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString("en-CA"); // YYYY-MM-DD
}

export const HOUR_BADGES: Record<string, { label: string; title: string }> = {
  bmo: { label: "BMO", title: "Before market open" },
  amc: { label: "AMC", title: "After market close" },
  dmh: { label: "DMH", title: "During market hours" },
};

/** Best display handle for a row (IPO rows may lack a symbol). */
export function rowTicker(row: CalendarRow): string | null {
  const symbol = (row.symbol ?? "").trim();
  return symbol ? symbol.toUpperCase() : null;
}

const TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

/** "AAPL,MSFT" -> ["AAPL","MSFT"]; drops non-equity junk, dedupes, caps. */
export function relatedTickers(related: string | null | undefined, cap = 4): string[] {
  if (!related) return [];
  const out: string[] = [];
  for (const raw of related.split(",")) {
    const t = raw.trim().toUpperCase();
    if (t && TICKER_RE.test(t) && !out.includes(t)) out.push(t);
    if (out.length >= cap) break;
  }
  return out;
}
