import Link from "next/link";
import ShareToX from "@/components/ShareToX";
import Sparkline from "@/components/Sparkline";
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

function daysBadge(days: number): string | null {
  if (days >= 365) return "365d";
  if (days >= 180) return "180d";
  if (days >= 90) return "90d";
  if (days >= 30) return "30d";
  return null;
}

export default async function LeaderboardPage() {
  const { entries, qualifying, minDays } = await getLeaderboard();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <p className="text-xs uppercase tracking-widest text-accent">
        The Ledger · The receipts
      </p>
      <h1 className="mt-2 text-3xl font-semibold">Forward-test leaderboard</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Every strategy here was frozen at deployment and evaluated on fresh end-of-day
        data ever since — timestamped, append-only, out-of-sample. Losers stay on the
        board on purpose: a track record you can&apos;t rewrite is the whole point.
      </p>

      {entries.length === 0 ? (
        <p className="mt-8 rounded-lg border border-hairline bg-panel p-4 text-sm text-muted">
          No deployments have reached the minimum {minDays} trading days yet. Deploy a
          strategy from the playground and it will appear here as its record accrues.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl border border-hairline">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline bg-panel text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Strategy</th>
                <th className="px-4 py-3 font-medium text-right">Forward return</th>
                <th className="px-4 py-3 font-medium text-right">Max DD</th>
                <th className="px-4 py-3 font-medium text-right">Days live</th>
                <th className="px-4 py-3 font-medium text-right">Signals</th>
                <th className="px-4 py-3 font-medium">Trend</th>
                <th className="px-2 py-3 font-medium">
                  <span className="sr-only">Share</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.slug} className="border-b border-hairline last:border-0 hover:bg-panel">
                  <td className="tnum px-4 py-3 text-muted">{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/strategy/${e.slug}`}
                      className="font-medium hover:text-accent focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
                    >
                      {e.name}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                      <span className="flex items-center gap-1.5">
                        {e.owner_avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element -- OAuth avatars come from arbitrary hosts; next/image needs remotePatterns config
                          <img
                            src={e.owner_avatar}
                            alt=""
                            className="h-4 w-4 rounded-full border border-hairline object-cover"
                          />
                        ) : (
                          <span
                            aria-hidden
                            className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-soft text-[9px] font-semibold uppercase text-accent"
                          >
                            {ownerLabel(e).charAt(0)}
                          </span>
                        )}
                        <span>{ownerLabel(e)}</span>
                      </span>
                      {e.owner === "house" && (
                        <span className="rounded-full border border-hairline px-1.5 py-0 text-[10px] uppercase tracking-wide">
                          House
                        </span>
                      )}
                      <span>· since {e.deployed_at}</span>
                      {e.timeframe && (
                        <span
                          className="tnum rounded-full border border-hairline px-1.5 py-0 text-[10px]"
                          title="Bar timeframe this strategy trades on"
                        >
                          {e.timeframe}
                        </span>
                      )}
                      {daysBadge(e.days_live) && (
                        <span className="rounded-full border border-hairline px-1.5 py-0 text-[10px]">
                          {daysBadge(e.days_live)}
                        </span>
                      )}
                    </div>
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
                  <td className="tnum px-4 py-3 text-right">{fmtPct(e.max_drawdown_pct)}</td>
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
      )}

      {qualifying.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Warming up
          </h2>
          <p className="mt-1 text-xs text-muted">
            Deployed and tracking, but not yet at the {minDays} trading days required to
            rank. Their clocks — and their records — are already running.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {qualifying.map((e) => (
              <li
                key={e.slug}
                className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-panel px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/strategy/${e.slug}`}
                    className="truncate text-sm font-medium hover:text-accent focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
                  >
                    {e.name}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                    <span>{ownerLabel(e)}</span>
                    {e.owner === "house" && (
                      <span className="rounded-full border border-hairline px-1.5 py-0 text-[10px] uppercase tracking-wide">
                        House
                      </span>
                    )}
                    <span>· since {e.deployed_at}</span>
                    {e.timeframe && (
                      <span
                        className="tnum rounded-full border border-hairline px-1.5 py-0 text-[10px]"
                        title="Bar timeframe this strategy trades on"
                      >
                        {e.timeframe}
                      </span>
                    )}
                  </div>
                </div>
                <span className="tnum shrink-0 rounded-full border border-hairline px-2 py-0.5 text-[11px] text-muted">
                  day {e.days_live} of {minDays}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-6 text-[11px] text-muted">
        Paper trading on end-of-day data with a slippage assumption — not real
        executions. {DISCLAIMER}
      </p>
    </main>
  );
}
