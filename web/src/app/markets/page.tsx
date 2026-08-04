import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { TimestampMark } from "@/components/EvidenceMarks";
import Reveal from "@/components/Reveal";
import SectionShell from "@/components/SectionShell";
import CalendarSection from "@/components/markets/CalendarSection";
import NewsGrid from "@/components/markets/NewsGrid";
import {
  type CalendarKind,
  type MonthPayload,
  type NewsArticle,
  parseMonthPayload,
  todayLocalISO,
} from "@/components/markets/types";
import { ButtonLink } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { DISCLAIMER } from "@/lib/constants";
import { fmtSignedPct } from "@/lib/format";
import { BACKTEST_API_URL } from "@/lib/server/backend";

export const metadata = {
  title: "Markets — Chat to Backtest",
  description:
    "Sector heatmap, top movers, earnings and IPO calendars, and market headlines — settled end-of-day closes, refreshed once per trading day.",
};

type Tile = { symbol: string; close: number; pct_change: number };
type Mover = Tile & { sector: string };

type Overview = {
  as_of: string | null;
  sectors: { sector: string; tiles: Tile[] }[];
  gainers: Mover[];
  losers: Mover[];
};

const EMPTY_OVERVIEW: Overview = { as_of: null, sectors: [], gainers: [], losers: [] };

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

/** Current-month calendar for the SSR first paint. `null` on failure so the
 *  client widget refetches instead of caching a transient outage. */
async function getMonth(
  kind: CalendarKind,
  year: number,
  month: number,
): Promise<MonthPayload | null> {
  try {
    const res = await fetch(
      `${BACKTEST_API_URL}/markets/calendar-month?kind=${kind}&year=${year}&month=${month}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return parseMonthPayload(
      (await res.json()) as Partial<MonthPayload>,
      kind,
      year,
      month,
    );
  } catch {
    return null;
  }
}

type News = { configured: boolean; articles: NewsArticle[] };

async function getNews(): Promise<News> {
  try {
    const res = await fetch(`${BACKTEST_API_URL}/markets/news`, { cache: "no-store" });
    if (!res.ok) return { configured: true, articles: [] };
    const body = (await res.json()) as Partial<News>;
    return {
      configured: body.configured ?? false,
      articles: Array.isArray(body.articles) ? body.articles : [],
    };
  } catch {
    return { configured: true, articles: [] };
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
  const todayIso = todayLocalISO();
  const [calYear, calMonth] = todayIso.split("-").map(Number);
  const [overview, monthEarnings, monthIpo, news, params] = await Promise.all([
    getOverview(),
    getMonth("earnings", calYear, calMonth),
    getMonth("ipo", calYear, calMonth),
    getNews(),
    searchParams,
  ]);
  const hasHeatmap = overview.sectors.length > 0;

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

          <section aria-labelledby="calendar-heading">
            <Reveal>
              <SectionHead id="calendar-heading" title="Earnings & IPO calendar" />
            </Reveal>
            {/* Not wrapped in Reveal: the widget hosts a fixed-position day
                panel, which must never sit under an ancestor transform. */}
            <div className="mt-4">
              <CalendarSection
                initialEarnings={monthEarnings}
                initialIpo={monthIpo}
                initialYear={calYear}
                initialMonth={calMonth}
                initialTodayIso={todayIso}
              />
            </div>
          </section>

          <section aria-labelledby="news-heading">
            <Reveal>
              <SectionHead id="news-heading" title="Latest market news" />
            </Reveal>
            <Reveal>
              <div className="mt-4">
                <NewsGrid
                  initialConfigured={news.configured}
                  initialArticles={news.articles}
                />
              </div>
            </Reveal>
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
