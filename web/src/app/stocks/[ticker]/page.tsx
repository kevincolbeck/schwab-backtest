import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import Reveal from "@/components/Reveal";
import SectionShell from "@/components/SectionShell";
import { TimestampMark } from "@/components/EvidenceMarks";
import { ButtonLink } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { DISCLAIMER } from "@/lib/constants";
import { fmtSignedPct } from "@/lib/format";
import {
  dayChange,
  getStockBundle,
  type StockBundle,
  type StockNewsItem,
} from "@/lib/server/stocks";
import {
  CompanyDescription,
  CompanyLogo,
  NewsThumb,
  PriceRangeChart,
} from "./StockPageParts";

/* ── ISR: every ticker renders on demand, then caches for 6h. Must stay a
   literal (statically analyzable) — mirrors STOCKS_REVALIDATE. ── */
export const revalidate = 21600;
export const dynamicParams = true;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://chatbacktest.com";

const HOUR_LABELS: Record<string, string> = {
  bmo: "before open",
  amc: "after close",
  dmh: "during market",
};

/* ── Formatters (informational display only) ─────────────────────────────── */

function fmtPrice(v: number): string {
  return `$${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Finnhub market cap arrives in millions of USD. */
function fmtMarketCapMillions(millions: number): string {
  if (millions >= 1_000_000) return `$${(millions / 1_000_000).toFixed(2)}T`;
  if (millions >= 1_000) return `$${(millions / 1_000).toFixed(1)}B`;
  return `$${Math.round(millions)}M`;
}

function fmtShares(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return `${Math.round(v)}`;
}

function fmtNewsDate(unix: number | null): string | null {
  if (!unix || !Number.isFinite(unix)) return null;
  try {
    return new Date(unix * 1000).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

/* ── SEO ─────────────────────────────────────────────────────────────────── */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const { ticker } = await params;
  const result = await getStockBundle(ticker);

  if (result.status === "not_found") {
    return {
      title: `${result.symbol || "Ticker"} — not found · Chat·Backtest`,
      robots: { index: false },
    };
  }
  if (result.status === "unavailable") {
    return {
      title: `${result.symbol} stock: settled-close chart & stats`,
      description: `Settled end-of-day price history and company stats for ${result.symbol}. Research and education only — not financial advice.`,
    };
  }

  const { bundle } = result;
  const name = bundle.profile?.name?.trim();
  const title = name
    ? `${bundle.symbol} — ${name} stock: settled-close chart & stats`
    : `${bundle.symbol} stock: settled-close chart & stats`;
  const close = bundle.stats?.last_close;
  const asOf = bundle.stats?.as_of;
  const priceBit =
    close != null && asOf
      ? `Last settled close ${fmtPrice(close)} on ${asOf}.`
      : "Settled end-of-day price history.";
  const description = `${name ? `${name} (${bundle.symbol})` : bundle.symbol}: ${priceBit} Daily chart up to 5 years, 52-week range, volume, market cap${
    bundle.profile?.industry ? `, ${bundle.profile.industry.toLowerCase()} industry` : ""
  } and recent company news. Informational only — no ratings, no recommendations. Not financial advice.`;
  const canonical = `${SITE_URL}/stocks/${bundle.symbol}`;

  return {
    title,
    description,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

/* ── Evidence stat tile (SYSTEM.md §3: value hero, label whispers). Tiles are
   OMITTED when data is missing — never an em-dash soup. ── */
function StatTile({
  label,
  value,
  sub,
  className = "",
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <Card pad="sm" className={className}>
      <p className="text-caption uppercase tracking-widest text-muted">{label}</p>
      <p className="tnum mt-1 text-lg text-ink">{value}</p>
      {sub && <p className="tnum mt-0.5 text-caption text-faint">{sub}</p>}
    </Card>
  );
}

function ComplianceFooter() {
  return (
    <div className="mx-auto w-full max-w-(--container-max) px-4 pb-12 sm:px-6">
      <p className="max-w-prose text-caption leading-relaxed text-muted">
        Informational page built on cached, settled end-of-day closes — not live
        quotes. Nothing here is a rating, a price target, or a recommendation to
        buy or sell any security. {DISCLAIMER}
      </p>
    </div>
  );
}

function ConversionCta({ symbol }: { symbol: string }) {
  return (
    <Card className="text-center">
      <h2 className="text-xl font-medium text-ink">
        Put {symbol} under the microscope
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
        Describe an entry and an exit in plain English and test it against years
        of {symbol}&apos;s settled closes — evidence in seconds, no code.
      </p>
      <ButtonLink href="/playground" className="mt-5">
        Backtest {symbol} in the lab →
      </ButtonLink>
    </Card>
  );
}

/** API hiccup — the page renders branded and useful, never blank, never 404. */
function UnavailableState({ symbol }: { symbol: string }) {
  return (
    <main className="w-full">
      <SectionShell
        tight
        hero
        headingAs="h1"
        eyebrow="Stocks · Settled daily"
        title={symbol}
        sub="Settled-close chart, key stats, and company news — one update per trading day, after the close."
      >
        <div className="space-y-10">
          <Card pad="sm" className="border-dashed text-sm text-muted">
            The data service is catching its breath — {symbol}&apos;s settled-close
            bundle is temporarily unavailable. This page refreshes itself; check
            back shortly.
          </Card>
          <ConversionCta symbol={symbol} />
        </div>
      </SectionShell>
      <ComplianceFooter />
    </main>
  );
}

function NewsList({ news }: { news: StockNewsItem[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {news.map((n) => {
        const date = fmtNewsDate(n.datetime);
        return (
          <li key={n.url} className="card flex items-start gap-3 p-4">
            <NewsThumb src={n.image} />
            <div className="min-w-0">
              <a
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring block rounded-(--radius-tag) text-sm font-medium text-ink hover:underline"
              >
                {n.headline}
              </a>
              <p className="mt-1 text-caption text-faint">
                {n.source}
                {n.source && date && " · "}
                {date && <span className="tnum">{date}</span>}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ── The page ────────────────────────────────────────────────────────────── */

export default async function StockPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const result = await getStockBundle(ticker);
  if (result.status === "not_found") notFound();
  if (result.status === "unavailable") {
    // Degraded renders opt OUT of the 6h ISR cache — a service blip must not
    // poison an indexed page until the next revalidation; the next request
    // simply retries the service.
    noStore();
    return <UnavailableState symbol={result.symbol} />;
  }

  const bundle: StockBundle = result.bundle;
  const { symbol, profile, bars, stats, next_earnings: nextEarnings, news } = bundle;
  const name = profile?.name?.trim() || null;
  const change = dayChange(bars);
  const lastClose = stats?.last_close ?? (bars.length ? bars[bars.length - 1].close : null);
  const asOf = stats?.as_of ?? (bars.length ? bars[bars.length - 1].time : null);
  const lastVolume = bars.length ? bars[bars.length - 1].volume : null;

  // Key stats: build only the tiles whose data exists (no em-dash soup).
  // P/E is intentionally absent — the service bundle doesn't carry it yet.
  const tiles: { label: string; value: string; sub?: ReactNode; wide?: boolean }[] = [];
  if (profile?.marketCapitalization != null && profile.marketCapitalization > 0) {
    tiles.push({
      label: "Market cap",
      value: fmtMarketCapMillions(profile.marketCapitalization),
    });
  }
  if (stats?.low_52w != null && stats?.high_52w != null) {
    tiles.push({
      label: "52-week range",
      value: `${fmtPrice(stats.low_52w)} – ${fmtPrice(stats.high_52w)}`,
      wide: true,
    });
  }
  if (lastVolume != null && lastVolume > 0) {
    tiles.push({
      label: "Volume",
      value: fmtShares(lastVolume),
      sub: asOf ? `settled ${asOf}` : undefined,
    });
  }
  if (stats?.avg_volume != null && stats.avg_volume > 0) {
    tiles.push({ label: "Avg volume", value: fmtShares(stats.avg_volume), sub: "1y daily" });
  }
  if (bars.length > 1) {
    tiles.push({
      label: "Cached history",
      value: `${bars.length.toLocaleString("en-US")} sessions`,
      sub: `${bars[0].time} → ${bars[bars.length - 1].time}`,
      wide: true,
    });
  }

  return (
    <main className="w-full">
      <SectionShell tight>
        {/* ── Header: identity plate + last settled close ── */}
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            <span aria-hidden className="mr-2 inline-block h-2 w-0.5 bg-accent" />
            Stocks · Settled daily
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
            <CompanyLogo src={profile?.logo ?? null} symbol={symbol} />
            <div className="min-w-0">
              <h1 className="text-headline font-semibold text-balance text-ink">
                {name ?? symbol}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                <span className="tnum rounded-(--radius-pill) border border-hairline bg-panel px-2.5 py-0.5 font-mono text-caption text-muted">
                  {symbol}
                </span>
                {profile?.industry && (
                  <span className="rounded-(--radius-pill) border border-hairline px-2.5 py-0.5 text-caption text-muted">
                    {profile.industry}
                  </span>
                )}
                {nextEarnings && (
                  <span
                    className="tnum rounded-(--radius-pill) border border-hairline px-2.5 py-0.5 text-caption text-muted"
                    title="Next scheduled earnings report (from the earnings calendar)"
                  >
                    Next earnings · {nextEarnings.date}
                    {nextEarnings.hour && HOUR_LABELS[nextEarnings.hour]
                      ? ` · ${HOUR_LABELS[nextEarnings.hour]}`
                      : ""}
                  </span>
                )}
              </div>
            </div>
          </div>

          {lastClose != null ? (
            <div className="mt-7">
              <p className="text-caption uppercase tracking-widest text-muted">
                Last settled close
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="tnum text-display text-ink">{fmtPrice(lastClose)}</span>
                {change && (
                  <span
                    className={`tnum text-lg ${
                      change.pct > 0
                        ? "text-gain"
                        : change.pct < 0
                          ? "text-loss"
                          : "text-muted"
                    }`}
                    title="Change vs the prior settled close"
                  >
                    <span aria-hidden>{change.pct > 0 ? "▲" : change.pct < 0 ? "▼" : ""} </span>
                    {fmtSignedPct(change.pct, 2)}
                    <span className="sr-only">
                      {change.pct >= 0 ? " up" : " down"} versus the prior settled close
                    </span>
                  </span>
                )}
                <TimestampMark iso={asOf} prefix="as of" />
              </div>
              <p className="mt-1.5 text-caption text-muted">
                One update per trading day, after the close — settled data, not a
                live quote.
              </p>
            </div>
          ) : (
            <Card pad="sm" className="mt-7 border-dashed text-sm text-muted">
              Settled-close price history for {symbol} is warming up — it appears
              here after the next end-of-day data refresh.
            </Card>
          )}
        </Reveal>

        <div className="mt-10 space-y-10">
          {/* ── Price chart: one payload, client-side range slicing ── */}
          {bars.length > 1 && (
            <Reveal>
              <Card>
                <h2 className="mb-3 text-sm font-medium text-ink">
                  Daily settled closes
                </h2>
                <PriceRangeChart bars={bars} />
              </Card>
            </Reveal>
          )}

          {/* ── Key stats (evidence grid; missing data = no tile) ── */}
          {tiles.length > 0 && (
            <section aria-labelledby="stats-heading">
              <Reveal>
                <h2 id="stats-heading" className="text-xl font-medium text-ink">
                  Key stats
                </h2>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                  {tiles.map((t) => (
                    <StatTile
                      key={t.label}
                      label={t.label}
                      value={t.value}
                      sub={t.sub}
                      className={t.wide ? "col-span-2 sm:col-span-1" : ""}
                    />
                  ))}
                </div>
              </Reveal>
            </section>
          )}

          {/* ── About ── */}
          {profile?.description && (
            <section aria-labelledby="about-heading">
              <Reveal>
                <h2 id="about-heading" className="text-xl font-medium text-ink">
                  About {name ?? symbol}
                </h2>
                <div className="mt-3">
                  <CompanyDescription text={profile.description} />
                </div>
                {profile.website && (
                  <p className="mt-3 text-xs">
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-ring rounded-(--radius-tag) text-accent hover:underline"
                    >
                      Company website ↗
                    </a>
                  </p>
                )}
              </Reveal>
            </section>
          )}

          {/* ── Company news ── */}
          {news.length > 0 && (
            <section aria-labelledby="news-heading">
              <Reveal>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h2 id="news-heading" className="text-xl font-medium text-ink">
                    Recent company news
                  </h2>
                  <span className="text-caption text-faint">
                    headlines only — reporting, not signals
                  </span>
                </div>
                <div className="mt-4">
                  <NewsList news={news} />
                </div>
              </Reveal>
            </section>
          )}

          {/* ── The conversion: this page exists to feed the lab ── */}
          <Reveal>
            <ConversionCta symbol={symbol} />
          </Reveal>
        </div>
      </SectionShell>
      <ComplianceFooter />
    </main>
  );
}
