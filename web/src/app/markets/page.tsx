import type { CSSProperties } from "react";
import Link from "next/link";
import { DISCLAIMER } from "@/lib/constants";
import { fmtNum, fmtSignedPct } from "@/lib/format";
import { BACKTEST_API_URL } from "@/lib/server/backend";

export const metadata = {
  title: "Markets — Chat to Backtest",
  description:
    "Sector heatmap, top movers, and this week's earnings and IPO calendars — settled end-of-day closes, refreshed once per trading day.",
};

type Tile = { symbol: string; close: number; pct_change: number };
type Mover = Tile & { sector: string };

type Overview = {
  as_of: string | null;
  sectors: { sector: string; tiles: Tile[] }[];
  gainers: Mover[];
  losers: Mover[];
};

type EarningsRow = {
  symbol: string;
  date: string;
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  hour: string | null;
};

type Ipo = {
  symbol: string | null;
  name: string | null;
  date: string;
  exchange: string | null;
  price: string | number | null;
  status: string | null;
};

type MarketCalendar = {
  earnings: EarningsRow[];
  ipos: Ipo[];
  configured: boolean;
  week_start?: string;
  week_end?: string;
};

const EMPTY_OVERVIEW: Overview = { as_of: null, sectors: [], gainers: [], losers: [] };
const EMPTY_CALENDAR: MarketCalendar = { earnings: [], ipos: [], configured: false };

async function getOverview(): Promise<Overview> {
  try {
    const res = await fetch(`${BACKTEST_API_URL}/markets/overview`, { cache: "no-store" });
    if (!res.ok) return EMPTY_OVERVIEW;
    const body = (await res.json()) as Partial<Overview>;
    return {
      as_of: body.as_of ?? null,
      sectors: body.sectors ?? [],
      gainers: body.gainers ?? [],
      losers: body.losers ?? [],
    };
  } catch {
    return EMPTY_OVERVIEW;
  }
}

async function getCalendar(): Promise<MarketCalendar> {
  try {
    const res = await fetch(`${BACKTEST_API_URL}/markets/calendar`, { cache: "no-store" });
    if (!res.ok) return EMPTY_CALENDAR;
    const body = (await res.json()) as Partial<MarketCalendar>;
    return {
      earnings: body.earnings ?? [],
      ipos: body.ipos ?? [],
      configured: body.configured ?? false,
      week_start: body.week_start,
      week_end: body.week_end,
    };
  } catch {
    return EMPTY_CALENDAR;
  }
}

const SECTOR_LABELS: Record<string, string> = { RE: "Real Estate" };

/** Tile fill scales with |%change| using the P&L green/red tokens — the ONE
 *  place outside P&L they apply, because %change IS gain/loss semantics.
 *  ±3% saturates; alpha stays ≤55% so ink text keeps contrast in both themes. */
function tileStyle(pct: number): CSSProperties {
  if (pct === 0) return {};
  const token = pct > 0 ? "var(--gain)" : "var(--loss)";
  const alpha = Math.round(10 + Math.min(Math.abs(pct) / 3, 1) * 45);
  return { background: `color-mix(in srgb, ${token} ${alpha}%, transparent)` };
}

function pctClass(pct: number): string {
  return pct > 0 ? "text-gain" : pct < 0 ? "text-loss" : "text-muted";
}

const HOUR_LABELS: Record<string, string> = {
  bmo: "before open",
  amc: "after close",
  dmh: "during market",
};

function fmtRevenue(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function MoverList({ title, movers }: { title: string; movers: Mover[] }) {
  return (
    <div className="rounded-xl border border-hairline bg-panel p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <ol className="mt-3 space-y-1.5">
        {movers.map((m, i) => (
          <li key={m.symbol} className="flex items-baseline gap-2 text-sm">
            <span className="tnum w-5 text-xs text-faint">{i + 1}</span>
            <span className="font-medium">{m.symbol}</span>
            <span className="truncate text-[11px] text-muted">
              {SECTOR_LABELS[m.sector] ?? m.sector}
            </span>
            <span className={`tnum ml-auto ${pctClass(m.pct_change)}`}>
              {fmtSignedPct(m.pct_change, 2)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default async function MarketsPage() {
  const [overview, calendar] = await Promise.all([getOverview(), getCalendar()]);
  const hasHeatmap = overview.sectors.length > 0;
  const hasCalendars = calendar.earnings.length > 0 || calendar.ipos.length > 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <p className="text-xs uppercase tracking-widest text-accent">
        Markets · Settled daily
      </p>
      <h1 className="mt-2 text-3xl font-semibold">
        The market, settled — end-of-day closes, no flicker
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        One update per trading day, after the close. No streaming ticks, no intraday
        noise — the same settled data our backtests and the forward ledger run on.
        {overview.as_of && (
          <>
            {" "}
            <span className="tnum text-ink">As of {overview.as_of}.</span>
          </>
        )}
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Sector heatmap
        </h2>
        {!hasHeatmap ? (
          <p className="mt-4 rounded-lg border border-hairline bg-panel p-4 text-sm text-muted">
            The heatmap is warming up — settled closes appear here after the next
            end-of-day data refresh.
          </p>
        ) : (
          <div className="mt-4 space-y-5">
            {overview.sectors.map((group) => (
              <div key={group.sector}>
                <h3 className="text-xs font-medium uppercase tracking-wide text-faint">
                  {SECTOR_LABELS[group.sector] ?? group.sector}
                </h3>
                <div className="mt-1.5 grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-1.5">
                  {group.tiles.map((t) => (
                    <div
                      key={t.symbol}
                      style={tileStyle(t.pct_change)}
                      className="rounded-md border border-hairline px-2 py-1.5"
                      title={`${t.symbol} closed at ${t.close}`}
                    >
                      <div className="text-xs font-semibold">{t.symbol}</div>
                      <div className="tnum text-[11px]">{fmtSignedPct(t.pct_change, 2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {(overview.gainers.length > 0 || overview.losers.length > 0) && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Movers
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <MoverList title="Top gainers" movers={overview.gainers} />
            <MoverList title="Top losers" movers={overview.losers} />
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          This week
        </h2>
        {!calendar.configured ? (
          <p className="mt-4 rounded-lg border border-hairline bg-panel p-4 text-sm text-muted">
            Calendars warming up — this week&apos;s earnings and IPO schedule will
            appear here shortly.
          </p>
        ) : !hasCalendars ? (
          <p className="mt-4 rounded-lg border border-hairline bg-panel p-4 text-sm text-muted">
            Nothing on the calendar
            {calendar.week_start && calendar.week_end && (
              <span className="tnum">
                {" "}
                for {calendar.week_start} – {calendar.week_end}
              </span>
            )}
            {" "}yet — check back after the next refresh.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-faint">
                Earnings
              </h3>
              {calendar.earnings.length === 0 ? (
                <p className="mt-2 rounded-lg border border-hairline bg-panel p-4 text-sm text-muted">
                  No earnings scheduled this week.
                </p>
              ) : (
                <div className="mt-2 overflow-x-auto rounded-xl border border-hairline">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-hairline bg-panel text-left text-xs text-muted">
                        <th className="px-3 py-2.5 font-medium">Symbol</th>
                        <th className="px-3 py-2.5 font-medium">Date</th>
                        <th className="px-3 py-2.5 font-medium">Time</th>
                        <th className="px-3 py-2.5 text-right font-medium">EPS est.</th>
                        <th className="px-3 py-2.5 text-right font-medium">EPS actual</th>
                        <th className="px-3 py-2.5 text-right font-medium">Rev. est.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calendar.earnings.map((e) => (
                        <tr
                          key={`${e.symbol}-${e.date}`}
                          className="border-b border-hairline last:border-0 hover:bg-panel"
                        >
                          <td className="px-3 py-2 font-medium">{e.symbol}</td>
                          <td className="tnum px-3 py-2 text-muted">{e.date}</td>
                          <td className="px-3 py-2 text-muted">
                            {e.hour ? (HOUR_LABELS[e.hour] ?? e.hour) : "—"}
                          </td>
                          <td className="tnum px-3 py-2 text-right">{fmtNum(e.epsEstimate)}</td>
                          <td className="tnum px-3 py-2 text-right">{fmtNum(e.epsActual)}</td>
                          <td className="tnum px-3 py-2 text-right">
                            {fmtRevenue(e.revenueEstimate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-faint">
                IPOs
              </h3>
              {calendar.ipos.length === 0 ? (
                <p className="mt-2 rounded-lg border border-hairline bg-panel p-4 text-sm text-muted">
                  No IPOs scheduled this week.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {calendar.ipos.map((ipo) => (
                    <li
                      key={`${ipo.symbol ?? ipo.name}-${ipo.date}`}
                      className="rounded-lg border border-hairline bg-panel px-4 py-3"
                    >
                      <div className="flex items-baseline gap-2 text-sm">
                        <span className="font-medium">{ipo.symbol ?? "—"}</span>
                        <span className="truncate text-xs text-muted">{ipo.name}</span>
                        {ipo.status && (
                          <span className="ml-auto shrink-0 rounded-full border border-hairline px-1.5 py-0 text-[10px] uppercase tracking-wide text-muted">
                            {ipo.status}
                          </span>
                        )}
                      </div>
                      <div className="tnum mt-1 text-[11px] text-muted">
                        {ipo.date}
                        {ipo.exchange && <> · {ipo.exchange}</>}
                        {ipo.price !== null && ipo.price !== undefined && ipo.price !== "" && (
                          <> · ${String(ipo.price)}</>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="mt-12 rounded-xl border border-hairline bg-panel p-6 text-center">
        <h2 className="text-lg font-semibold">Seen a name worth studying?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
          Every symbol on this page is in the lab&apos;s data cache — describe a
          strategy in plain English and prove it on years of history in seconds.
        </p>
        <Link
          href="/playground"
          className="focus-ring mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Backtest any of these names
        </Link>
      </section>

      <p className="mt-6 text-[11px] text-muted">
        Prices are cached end-of-day closes for research — not live quotes, and
        nothing here is a recommendation to buy or sell anything. {DISCLAIMER}
      </p>
    </main>
  );
}
