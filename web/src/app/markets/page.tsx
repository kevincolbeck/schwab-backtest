import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { TimestampMark } from "@/components/EvidenceMarks";
import Reveal from "@/components/Reveal";
import SectionShell from "@/components/SectionShell";
import { ButtonLink } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
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

/** Collapsed heatmap shows each sector's N biggest absolute moves; the rest
 *  sit behind one "Show all" toggle (progressive disclosure — brief §0.2). */
const TRIM_PER_SECTOR = 6;

/** Tile fill scales with |%change| using the P&L green/red tokens — the ONE
 *  place outside P&L they apply, because %change IS gain/loss semantics
 *  (SYSTEM.md §2). ±3% saturates; alpha stays ≤55% so ink text keeps
 *  contrast in both themes. */
function tileStyle(pct: number): CSSProperties {
  if (pct === 0) return {};
  const token = pct > 0 ? "var(--gain)" : "var(--loss)";
  const alpha = Math.round(10 + Math.min(Math.abs(pct) / 3, 1) * 45);
  return { background: `color-mix(in srgb, ${token} ${alpha}%, transparent)` };
}

function pctClass(pct: number): string {
  return pct > 0 ? "text-gain" : pct < 0 ? "text-loss" : "text-muted";
}

function topMoves(tiles: Tile[], n: number): Tile[] {
  return [...tiles]
    .sort((a, b) => Math.abs(b.pct_change) - Math.abs(a.pct_change))
    .slice(0, n);
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

/** Consistent inner-section header: quiet title + optional evidence mark on
 *  the right — same grammar as the library's category headers. */
function SectionHead({
  id,
  title,
  mark,
}: {
  id: string;
  title: string;
  mark?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 id={id} className="text-xl font-medium text-ink">
        {title}
      </h2>
      {mark}
    </div>
  );
}

/** Server-rendered toggle link (no JS needed), styled like the library's
 *  filter chips. Accent marks the ACTIVE state only (SYSTEM.md §1). */
function ToggleChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={`focus-ring inline-flex items-center gap-1.5 rounded-(--radius-control) border px-3 py-1.5 text-xs transition-colors duration-(--dur-micro) ${
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-hairline text-muted hover:border-hairline-strong hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

function MoverList({ title, movers }: { title: string; movers: Mover[] }) {
  return (
    <Card pad="sm">
      <h3 className="text-sm font-medium text-ink">{title}</h3>
      <ol className="mt-3 space-y-1.5">
        {movers.map((m, i) => (
          <li key={m.symbol} className="flex items-baseline gap-2 text-sm">
            <span className="tnum w-5 text-caption text-faint">{i + 1}</span>
            <span className="font-medium text-ink">{m.symbol}</span>
            <span className="truncate text-caption text-muted">
              {SECTOR_LABELS[m.sector] ?? m.sector}
            </span>
            <span className={`tnum ml-auto ${pctClass(m.pct_change)}`}>
              {fmtSignedPct(m.pct_change, 2)}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const [overview, calendar, params] = await Promise.all([
    getOverview(),
    getCalendar(),
    searchParams,
  ]);
  const hasHeatmap = overview.sectors.length > 0;
  const hasCalendars = calendar.earnings.length > 0 || calendar.ipos.length > 0;

  const rawView = Array.isArray(params.view) ? params.view[0] : params.view;
  const showAll = rawView === "all";
  const totalSymbols = overview.sectors.reduce((n, g) => n + g.tiles.length, 0);
  const canTrim = overview.sectors.some((g) => g.tiles.length > TRIM_PER_SECTOR);

  return (
    <main className="w-full">
      <SectionShell
        headingAs="h1"
        hero
        tight
        eyebrow="Markets · Settled daily"
        title="The market, settled — end-of-day closes, no flicker"
        sub={
          <>
            One update per trading day, after the close. No streaming ticks, no
            intraday noise — the same settled data our backtests and the forward
            ledger run on.
            {overview.as_of && (
              <>
                {" "}
                <span className="tnum text-ink">As of {overview.as_of}.</span>
              </>
            )}
          </>
        }
      >
        <div className="space-y-14">
          <section aria-labelledby="heatmap-heading">
            <Reveal>
              <SectionHead
                id="heatmap-heading"
                title="Sector heatmap"
                mark={
                  hasHeatmap ? (
                    <TimestampMark iso={overview.as_of} prefix="as of" />
                  ) : undefined
                }
              />
            </Reveal>
            {!hasHeatmap ? (
              <Reveal>
                <Card pad="sm" className="mt-4 border-dashed text-sm text-muted">
                  The heatmap is warming up — settled closes appear here after the
                  next end-of-day data refresh.
                </Card>
              </Reveal>
            ) : (
              <>
                <Reveal>
                  <div className="mt-4 space-y-5">
                    {overview.sectors.map((group) => {
                      const tiles = showAll
                        ? group.tiles
                        : topMoves(group.tiles, TRIM_PER_SECTOR);
                      const hidden = group.tiles.length - tiles.length;
                      return (
                        <div key={group.sector}>
                          <div className="flex items-baseline gap-2">
                            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                              {SECTOR_LABELS[group.sector] ?? group.sector}
                            </h3>
                            {hidden > 0 && (
                              <span className="tnum text-caption text-faint">
                                +{hidden} more
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-1.5">
                            {tiles.map((t) => (
                              <div
                                key={t.symbol}
                                style={tileStyle(t.pct_change)}
                                className="rounded-(--radius-tag) border border-hairline px-2 py-1.5"
                                title={`${t.symbol} closed at ${t.close}`}
                              >
                                <div className="text-xs font-medium text-ink">
                                  {t.symbol}
                                </div>
                                <div className="tnum text-caption">
                                  {fmtSignedPct(t.pct_change, 2)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Reveal>
                {canTrim && (
                  <div className="mt-5">
                    <ToggleChip
                      href={showAll ? "/markets" : "/markets?view=all"}
                      active={showAll}
                    >
                      {showAll ? (
                        <>Show each sector&apos;s biggest moves only</>
                      ) : (
                        <>
                          Show all{" "}
                          <span className="tnum text-caption">{totalSymbols}</span>{" "}
                          symbols
                        </>
                      )}
                    </ToggleChip>
                  </div>
                )}
              </>
            )}
          </section>

          {(overview.gainers.length > 0 || overview.losers.length > 0) && (
            <section aria-labelledby="movers-heading">
              <Reveal>
                <SectionHead
                  id="movers-heading"
                  title="Movers"
                  mark={<TimestampMark iso={overview.as_of} prefix="as of" />}
                />
              </Reveal>
              <Reveal>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <MoverList title="Top gainers" movers={overview.gainers} />
                  <MoverList title="Top losers" movers={overview.losers} />
                </div>
              </Reveal>
            </section>
          )}

          <section aria-labelledby="week-heading">
            <Reveal>
              <SectionHead
                id="week-heading"
                title="This week"
                mark={
                  calendar.week_start && calendar.week_end ? (
                    <span className="tnum text-caption text-faint">
                      {calendar.week_start} – {calendar.week_end}
                    </span>
                  ) : undefined
                }
              />
            </Reveal>
            {!calendar.configured ? (
              <Reveal>
                <Card pad="sm" className="mt-4 border-dashed text-sm text-muted">
                  Calendars warming up — this week&apos;s earnings and IPO schedule
                  will appear here shortly.
                </Card>
              </Reveal>
            ) : !hasCalendars ? (
              <Reveal>
                <Card pad="sm" className="mt-4 border-dashed text-sm text-muted">
                  Nothing on the calendar
                  {calendar.week_start && calendar.week_end && (
                    <span className="tnum">
                      {" "}
                      for {calendar.week_start} – {calendar.week_end}
                    </span>
                  )}{" "}
                  yet — check back after the next refresh.
                </Card>
              </Reveal>
            ) : (
              <Reveal>
                <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                      Earnings
                    </h3>
                    {calendar.earnings.length === 0 ? (
                      <Card pad="sm" className="mt-2 border-dashed text-sm text-muted">
                        No earnings scheduled this week.
                      </Card>
                    ) : (
                      <Card pad="none" className="mt-2 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-hairline bg-panel-2 text-left text-xs text-muted">
                                <th className="px-4 py-2.5 font-medium">Symbol</th>
                                <th className="px-4 py-2.5 font-medium">Date</th>
                                <th className="px-4 py-2.5 font-medium">Time</th>
                                <th className="px-4 py-2.5 text-right font-medium">
                                  EPS est.
                                </th>
                                <th className="px-4 py-2.5 text-right font-medium">
                                  EPS actual
                                </th>
                                <th className="px-4 py-2.5 text-right font-medium">
                                  Rev. est.
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {calendar.earnings.map((e) => (
                                <tr
                                  key={`${e.symbol}-${e.date}`}
                                  className="border-b border-hairline last:border-0"
                                >
                                  <td className="px-4 py-2.5 font-medium text-ink">
                                    {e.symbol}
                                  </td>
                                  <td className="tnum px-4 py-2.5 text-muted">
                                    {e.date}
                                  </td>
                                  <td className="px-4 py-2.5 text-muted">
                                    {e.hour ? (HOUR_LABELS[e.hour] ?? e.hour) : "—"}
                                  </td>
                                  <td className="tnum px-4 py-2.5 text-right">
                                    {fmtNum(e.epsEstimate)}
                                  </td>
                                  <td className="tnum px-4 py-2.5 text-right">
                                    {fmtNum(e.epsActual)}
                                  </td>
                                  <td className="tnum px-4 py-2.5 text-right">
                                    {fmtRevenue(e.revenueEstimate)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                      IPOs
                    </h3>
                    {calendar.ipos.length === 0 ? (
                      <Card pad="sm" className="mt-2 border-dashed text-sm text-muted">
                        No IPOs scheduled this week.
                      </Card>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {calendar.ipos.map((ipo) => (
                          <li
                            key={`${ipo.symbol ?? ipo.name}-${ipo.date}`}
                            className="card px-4 py-3"
                          >
                            <div className="flex items-baseline gap-2 text-sm">
                              <span className="font-medium text-ink">
                                {ipo.symbol ?? "—"}
                              </span>
                              <span className="truncate text-xs text-muted">
                                {ipo.name}
                              </span>
                              {ipo.status && (
                                <span className="ml-auto shrink-0 rounded-(--radius-pill) border border-hairline px-2 py-0.5 text-caption uppercase tracking-wide text-muted">
                                  {ipo.status}
                                </span>
                              )}
                            </div>
                            <div className="tnum mt-1 text-caption text-muted">
                              {ipo.date}
                              {ipo.exchange && <> · {ipo.exchange}</>}
                              {ipo.price !== null &&
                                ipo.price !== undefined &&
                                ipo.price !== "" && <> · ${String(ipo.price)}</>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </Reveal>
            )}
          </section>

          <Reveal>
            <Card className="text-center">
              <h2 className="text-xl font-medium text-ink">
                Seen a name worth studying?
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
                Every symbol on this page is in the lab&apos;s data cache — describe
                a strategy in plain English and prove it on years of history in
                seconds.
              </p>
              <ButtonLink href="/playground" className="mt-5">
                Backtest any of these names
              </ButtonLink>
            </Card>
          </Reveal>
        </div>
      </SectionShell>

      <div className="mx-auto w-full max-w-(--container-max) px-4 pb-12 sm:px-6">
        <p className="max-w-prose text-caption text-muted">
          Prices are cached end-of-day closes for research — not live quotes, and
          nothing here is a recommendation to buy or sell anything. {DISCLAIMER}
        </p>
      </div>
    </main>
  );
}
