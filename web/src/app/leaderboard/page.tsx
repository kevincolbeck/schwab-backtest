import Link from "next/link";
import type { CSSProperties } from "react";
import { HashMark, TimestampMark } from "@/components/EvidenceMarks";
import Reveal from "@/components/Reveal";
import SectionShell from "@/components/SectionShell";
import ShareToX from "@/components/ShareToX";
import Sparkline from "@/components/Sparkline";
import Card from "@/components/ui/Card";
import { DISCLAIMER } from "@/lib/constants";
import { fmtPct, fmtSignedPct } from "@/lib/format";
import { BACKTEST_API_URL } from "@/lib/server/backend";
import type { LeaderboardEntry } from "@/lib/types";

/** Social identity fields ship with the Phase G service deploy, and `timeframe`
 *  with the intraday-deploy update — typed optional so the page renders
 *  gracefully before (and without) them. */
type LeaderboardRow = LeaderboardEntry & {
  owner_display?: string | null;
  owner_avatar?: string | null;
  timeframe?: string | null;
};

export const metadata = {
  title: "Forward-Test Leaderboard — Chat to Backtest",
  description:
    "Public strategies ranked by live out-of-sample paper performance. Timestamped, append-only, no backfilled track records.",
};

type LeaderboardPayload = {
  entries: LeaderboardRow[];
  qualifying: LeaderboardRow[];
  minDays: number;
};

async function getLeaderboard(): Promise<LeaderboardPayload> {
  try {
    const res = await fetch(`${BACKTEST_API_URL}/leaderboard`, { cache: "no-store" });
    if (!res.ok) return { entries: [], qualifying: [], minDays: 20 };
    const body = (await res.json()) as {
      entries: LeaderboardRow[];
      qualifying?: LeaderboardRow[];
      min_days?: number;
    };
    return {
      entries: body.entries ?? [],
      qualifying: body.qualifying ?? [],
      minDays: body.min_days ?? 20,
    };
  } catch {
    return { entries: [], qualifying: [], minDays: 20 };
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

const TH = "px-4 py-2.5 text-left font-mono text-caption font-medium uppercase tracking-wider text-muted";

export default async function LeaderboardPage() {
  const { entries, qualifying, minDays } = await getLeaderboard();

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
            end-of-day data ever since — timestamped, append-only, out-of-sample.
            Losers stay on the board on purpose: a track record you can&apos;t rewrite
            is the whole point.
          </>
        }
      >
        {entries.length === 0 ? (
          <Card pad="sm" className="border-dashed text-sm text-muted">
            No deployments have reached the minimum {minDays} trading days yet. Deploy a
            strategy from the playground and it will appear here as its record accrues.
          </Card>
        ) : (
          /* Rows carry their own load entrance (.row-in) — no Reveal wrapper,
             so the append-only ledger visibly appends, once, on load. */
          <Card pad="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hairline bg-panel-2">
                    <th className={TH}>#</th>
                    <th className={TH}>Strategy</th>
                    <th className={`${TH} text-right`}>Forward return</th>
                    <th className={`${TH} text-right`}>Max DD</th>
                    <th className={`${TH} text-right`}>Days live</th>
                    <th className={`${TH} text-right`}>Signals</th>
                    <th className={TH}>Trend</th>
                    <th className="px-2 py-2.5">
                      <span className="sr-only">Share</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
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
                      <td
                        className={`tnum px-4 py-3 text-right ${
                          e.forward_return_pct > 0
                            ? "text-gain"
                            : e.forward_return_pct < 0
                              ? "text-loss"
                              : ""
                        }`}
                      >
                        {fmtSignedPct(e.forward_return_pct, 2)}
                      </td>
                      <td className="tnum px-4 py-3 text-right">
                        {fmtPct(e.max_drawdown_pct)}
                      </td>
                      <td className="tnum px-4 py-3 text-right">{e.days_live}</td>
                      <td className="tnum px-4 py-3 text-right">{e.signal_count}</td>
                      <td className="px-4 py-3">
                        <Sparkline values={e.sparkline} baseline={100000} />
                      </td>
                      <td className="px-2 py-3 text-right">
                        <ShareToX
                          iconOnly
                          name={e.name}
                          path={`/strategy/${e.slug}`}
                          rank={i + 1}
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
        )}

        {qualifying.length > 0 && (
          <section className="mt-14" aria-labelledby="warming-up">
            <Reveal>
              <h2 id="warming-up" className="text-xl font-medium text-ink">
                Warming up
              </h2>
              <p className="mt-1.5 max-w-prose text-sm text-muted">
                Deployed and tracking, but not yet at the {minDays} trading days
                required to rank. Their clocks — and their records — are already
                running.
              </p>
            </Reveal>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {qualifying.map((e, i) => (
                <li
                  key={e.slug}
                  style={rowStyle(i)}
                  className="row-in card flex items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/strategy/${e.slug}`}
                      className="focus-ring block truncate rounded-(--radius-tag) text-sm font-medium text-ink transition-colors duration-(--dur-micro) hover:text-accent"
                    >
                      {e.name}
                    </Link>
                    <RowMeta e={e} />
                  </div>
                  <span className="tnum shrink-0 rounded-(--radius-pill) border border-hairline px-2.5 py-1 text-caption text-muted">
                    day {e.days_live} of {minDays}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </SectionShell>

      <div className="mx-auto w-full max-w-(--container-max) px-4 pb-12 sm:px-6">
        <p className="max-w-prose text-caption leading-relaxed text-muted">
          Paper trading on end-of-day data with a slippage assumption — not real
          executions. {DISCLAIMER}
        </p>
      </div>
    </main>
  );
}
