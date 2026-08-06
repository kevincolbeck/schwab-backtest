import Link from "next/link";
import type { CSSProperties } from "react";
import {
  FrozenBadge,
  HashMark,
  HypotheticalBadge,
  TimestampMark,
} from "@/components/EvidenceMarks";
import SectionShell from "@/components/SectionShell";
import ShareToX from "@/components/ShareToX";
import Sparkline from "@/components/Sparkline";
import Card from "@/components/ui/Card";
import { DISCLAIMER } from "@/lib/constants";
import { fmtNum, fmtPct, fmtSignedPct } from "@/lib/format";
import {
  defaultSortKey,
  parseSortKey,
  projectedUnlockDate,
  SORT_LABELS,
  sortRows,
  type SortKey,
} from "@/lib/leaderboard";
import { BACKTEST_API_URL } from "@/lib/server/backend";
import type { LeaderboardEntry } from "@/lib/types";
import { pageMetadata } from "@/lib/seo";

/** Social identity fields ship with the Phase G service deploy, and `timeframe`
 *  with the intraday-deploy update — typed optional so the page renders
 *  gracefully before (and without) them. */
type LeaderboardRow = LeaderboardEntry & {
  owner_display?: string | null;
  owner_avatar?: string | null;
  timeframe?: string | null;
};

export const metadata = pageMetadata({
  title: "Forward-Test Leaderboard — verified live strategy track records",
  description:
    "Every deployed strategy's hypothetical backtest beside its live verified forward record — timestamped, append-only, and losers stay listed.",
  path: "/leaderboard",
});

type LeaderboardPayload = {
  entries: LeaderboardRow[];
  qualifying: LeaderboardRow[];
  minDays: number;
  /** False when the service could not be reached. An empty board and a
   *  BROKEN board must never look the same — to a reader or to Googlebot.
   *  The strategy pages are this site's differentiator and the leaderboard is
   *  their main internal link source; silently rendering zero links on a 200
   *  tells a crawler the records are gone. */
  ok: boolean;
};

async function getLeaderboard(): Promise<LeaderboardPayload> {
  try {
    const res = await fetch(`${BACKTEST_API_URL}/leaderboard`, { cache: "no-store" });
    if (!res.ok) {
      console.error(`leaderboard fetch failed: HTTP ${res.status}`);
      return { entries: [], qualifying: [], minDays: 20, ok: false };
    }
    const body = (await res.json()) as {
      entries: LeaderboardRow[];
      qualifying?: LeaderboardRow[];
      min_days?: number;
    };
    return {
      ok: true,
      entries: body.entries ?? [],
      qualifying: body.qualifying ?? [],
      minDays: body.min_days ?? 20,
    };
  } catch (e) {
    console.error("leaderboard unreachable", e);
    return { entries: [], qualifying: [], minDays: 20, ok: false };
  }
}

function ownerLabel(e: LeaderboardRow): string {
  if (e.owner_display) return e.owner_display;
  if (e.owner === "house") return "Chat·Backtest";
  // Raw owner ids are opaque UUIDs — shorten until the service sends a display name.
  return e.owner.length > 12 ? `${e.owner.slice(0, 8)}…` : e.owner;
}

/** Ledger-entrance stagger (row-in, globals.css). Capped so deep rows don't
 *  wait out a long queue — everything past ~12 lands together. */
function rowStyle(i: number): CSSProperties {
  return { "--row-index": Math.min(i, 12) } as CSSProperties;
}

/** Owner identity + evidence marks under the strategy name. Every mark is
 *  real data from the payload (truth rule, SYSTEM.md §3). */
function RowMeta({ e }: { e: LeaderboardRow }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted">
      <span className="flex items-center gap-1.5">
        {e.owner_avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- OAuth avatars come from arbitrary hosts; next/image needs remotePatterns config
          <img
            src={e.owner_avatar}
            alt=""
            className="h-4 w-4 rounded-(--radius-pill) border border-hairline object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-4 w-4 items-center justify-center rounded-(--radius-pill) border border-hairline bg-panel-2 text-caption leading-none text-muted"
          >
            {ownerLabel(e).charAt(0)}
          </span>
        )}
        <span>{ownerLabel(e)}</span>
      </span>
      {e.owner === "house" && (
        <span className="rounded-(--radius-pill) border border-hairline px-1.5 py-0 text-caption uppercase tracking-wide">
          House
        </span>
      )}
      <TimestampMark iso={e.deployed_at} prefix="since" />
      <HashMark hash={e.spec_hash_short} />
      {e.timeframe && (
        <span
          className="tnum rounded-(--radius-pill) border border-hairline px-1.5 py-0 text-caption"
          title="Bar timeframe this strategy trades on"
        >
          {e.timeframe}
        </span>
      )}
    </div>
  );
}

/** Sort chip — server-rendered link, so sorting works without JS. Accent marks
 *  the ACTIVE chip only (SYSTEM.md §1: active states are a sanctioned accent
 *  use); resting chips stay hairline + muted. */
function SortChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`focus-ring inline-flex items-center rounded-(--radius-control) border tap-target px-3 py-1.5 text-xs transition-colors duration-(--dur-micro) ${
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-hairline text-muted hover:border-hairline-strong hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

/** Plain-English metric tooltip so jargon is never unexplained (CLAUDE.md
 *  Phase A). Deliberately an <abbr>, not a <button>: it performs no action,
 *  and a focusable no-op that does nothing on Enter is worse than no control
 *  at all. Mirrors StatTiles. */
function InfoHint({ label, hint }: { label: string; hint: string }) {
  return (
    <abbr className="cursor-help no-underline" aria-label={`${label}: ${hint}`} title={hint}>
      ⓘ
    </abbr>
  );
}

/* Hint wording matches StatTiles.tsx so the same metric reads the same
   everywhere. */
const SHARPE_HINT = "Return per unit of volatility. Above 1 is generally considered good.";
const CAGR_HINT = "Compound annual growth rate — the smoothed per-year return.";
const MAX_DD_HINT = "The worst peak-to-bottom drop. How much pain you'd have sat through.";

const TH = "px-4 py-2.5 text-left font-mono text-caption font-medium uppercase tracking-wider text-muted";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string | string[] }>;
}) {
  const [{ entries, qualifying, minDays, ok }, params] = await Promise.all([
    getLeaderboard(),
    searchParams,
  ]);

  const all: LeaderboardRow[] = [...entries, ...qualifying];
  const verifiedSlugs = new Set(entries.map((e) => e.slug));
  const anyVerified = entries.length > 0;
  const sortKey = parseSortKey(params.sort) ?? defaultSortKey(anyVerified);
  const rows = sortRows(all, sortKey);
  /* Canonical rank = position among VERIFIED entries by forward return (the
     service's order), independent of display sort — the only rank ShareToX
     may claim. Warming rows get no rank (truth rule: a hypothetical rank is
     not a rank). */
  const canonicalRank = new Map(entries.map((e, i) => [e.slug, i + 1]));
  const unlockDate = projectedUnlockDate(all, minDays);

  return (
    <main className="w-full">
      <SectionShell
        headingAs="h1"
        hero
        tight
        eyebrow="The Ledger · The receipts"
        title="Forward-test leaderboard"
        sub={
          <>
            Every strategy here was frozen at deployment and evaluated on fresh
            closed candles ever since — timestamped, append-only, out-of-sample.
            Losers stay on the board on purpose: a track record you can&apos;t rewrite
            is the whole point. Backtest numbers are hypothetical (in-sample);
            forward records are verified out-of-sample from the day of deployment.
          </>
        }
      >
        {!ok ? (
          /* A broken board must not look like an empty one. Saying "no
             strategies" when the service is simply unreachable is a lie to
             the reader and, worse, tells a crawler our records are gone. */
          <Card pad="sm" className="text-sm text-muted" role="alert">
            <span className="font-medium text-ink">
              The ledger is temporarily unreachable.
            </span>{" "}
            The records themselves are intact and append-only — this page just
            can&rsquo;t read them right now. Please refresh in a moment.
          </Card>
        ) : all.length === 0 ? (
          <Card pad="sm" className="border-dashed text-sm text-muted">
            The ledger is live. Strategies deploy with frozen specs and start
            accruing verified out-of-sample records the same day. Deploy one from
            the playground and its clock starts today.
          </Card>
        ) : (
          <>
            <p className="max-w-prose text-sm text-muted">
              {anyVerified ? (
                <>
                  <span className="tnum">{entries.length}</span>{" "}verified record
                  {entries.length === 1 ? "" : "s"} on the board
                  {qualifying.length > 0 && (
                    <>
                      {" "}
                      · <span className="tnum">{qualifying.length}</span>{" "}more
                      accruing
                    </>
                  )}
                  .
                </>
              ) : (
                <>
                  <span className="tnum">{all.length}</span>{" "}
                  {all.length === 1 ? "strategy" : "strategies"} live and accruing
                  out-of-sample records.
                  {unlockDate && (
                    <>
                      {" "}
                      First verified <span className="tnum">{minDays}</span>-day
                      records expected{" "}
                      <TimestampMark iso={unlockDate} />.
                    </>
                  )}
                </>
              )}
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <nav aria-label="Sort strategies" className="flex flex-wrap items-center gap-2">
                <span className="text-caption text-muted">Sort</span>
                {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(
                  ([key, label]) => (
                    <SortChip
                      key={key}
                      href={`/leaderboard?sort=${key}`}
                      active={key === sortKey}
                      label={label}
                    />
                  ),
                )}
              </nav>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-caption text-muted">
                <span className="flex items-center gap-1.5">
                  <HypotheticalBadge />
                  <span>backtest on historical data</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <FrozenBadge label="Verified" />
                  <span>live out-of-sample record</span>
                </span>
              </div>
            </div>

            {/* Rows carry their own load entrance (.row-in) — no Reveal wrapper,
               so the append-only ledger visibly appends, once, on load. */}
            <Card pad="none" className="mt-4 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-hairline bg-panel-2">
                      <th rowSpan={2} className={TH}>
                        #
                      </th>
                      <th rowSpan={2} className={TH}>
                        Strategy
                      </th>
                      <th colSpan={3} scope="colgroup" className={TH}>
                        <span aria-hidden>≈ </span>Backtest · hypothetical
                      </th>
                      <th
                        colSpan={3}
                        scope="colgroup"
                        className={`${TH} border-l border-hairline`}
                      >
                        <span aria-hidden>✓ </span>Forward · verified
                      </th>
                      <th rowSpan={2} className={TH}>
                        Trend
                      </th>
                      <th rowSpan={2} className="px-2 py-2.5">
                        <span className="sr-only">Share</span>
                      </th>
                    </tr>
                    <tr className="border-b border-hairline bg-panel-2">
                      <th className={`${TH} text-right`}>
                        Sharpe <InfoHint label="Sharpe" hint={SHARPE_HINT} />
                      </th>
                      <th className={`${TH} text-right`}>
                        CAGR <InfoHint label="CAGR" hint={CAGR_HINT} />
                      </th>
                      <th className={`${TH} text-right`}>
                        Max DD <InfoHint label="Max drawdown" hint={MAX_DD_HINT} />
                      </th>
                      <th className={`${TH} border-l border-hairline text-right`}>
                        Return
                      </th>
                      <th className={`${TH} text-right`}>
                        Max DD <InfoHint label="Max drawdown" hint={MAX_DD_HINT} />
                      </th>
                      <th className={TH}>Record</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e, i) => (
                      <tr
                        key={e.slug}
                        style={rowStyle(i)}
                        className="row-in border-b border-hairline transition-colors duration-(--dur-micro) last:border-0 hover:bg-panel-2"
                      >
                        <td className="tnum px-4 py-3 text-muted">{i + 1}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/strategy/${e.slug}`}
                            className="focus-ring rounded-(--radius-tag) font-medium text-ink transition-colors duration-(--dur-micro) hover:text-accent"
                          >
                            {e.name}
                          </Link>
                          <RowMeta e={e} />
                        </td>
                        {/* Backtest cells stay neutral — gain/loss color is for
                           live P&L only, and these are hypothetical numbers. */}
                        <td className="tnum whitespace-nowrap px-4 py-3 text-right">
                          {fmtNum(e.backtest_stats?.sharpe)}
                        </td>
                        <td className="tnum whitespace-nowrap px-4 py-3 text-right">
                          {fmtPct(e.backtest_stats?.cagr)}
                        </td>
                        <td className="tnum whitespace-nowrap px-4 py-3 text-right">
                          {fmtPct(e.backtest_stats?.max_drawdown)}
                        </td>
                        <td
                          className={`tnum whitespace-nowrap border-l border-hairline px-4 py-3 text-right ${
                            e.forward_return_pct > 0
                              ? "text-gain"
                              : e.forward_return_pct < 0
                                ? "text-loss"
                                : ""
                          }`}
                        >
                          {fmtSignedPct(e.forward_return_pct, 2)}
                        </td>
                        <td className="tnum whitespace-nowrap px-4 py-3 text-right">
                          {fmtPct(e.max_drawdown_pct)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {verifiedSlugs.has(e.slug) ? (
                            <span
                              className="tnum inline-flex items-center gap-1 rounded-(--radius-pill) border border-hairline px-2.5 py-1 text-caption text-muted"
                              title={`${e.days_live} trading days of live out-of-sample record`}
                            >
                              <span aria-hidden>✓</span>
                              {e.days_live} days
                              <span className="sr-only">verified record</span>
                            </span>
                          ) : (
                            <span
                              className="tnum inline-flex items-center rounded-(--radius-pill) border border-hairline px-2.5 py-1 text-caption text-muted"
                              title={`${minDays - e.days_live} trading days until this record is verified`}
                            >
                              day {e.days_live} of {minDays}
                              <span className="sr-only"> — not yet verified</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Sparkline
                            values={e.sparkline}
                            baseline={e.starting_capital ?? 100000}
                          />
                        </td>
                        <td className="px-2 py-3 text-right">
                          <ShareToX
                            iconOnly
                            name={e.name}
                            path={`/strategy/${e.slug}`}
                            rank={canonicalRank.get(e.slug)}
                            forwardReturnPct={e.forward_return_pct}
                            daysLive={e.days_live}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </SectionShell>

      <div className="mx-auto w-full max-w-(--container-max) px-4 pb-12 sm:px-6">
        <p className="max-w-prose text-caption leading-relaxed text-muted">
          Paper trading on closed-candle data with a slippage assumption — not
          real executions. {DISCLAIMER}
        </p>
      </div>
    </main>
  );
}
