import Link from "next/link";
import Sparkline from "@/components/Sparkline";
import { DISCLAIMER } from "@/lib/constants";
import { fmtPct, fmtSignedPct } from "@/lib/format";
import { BACKTEST_API_URL } from "@/lib/server/backend";
import type { LeaderboardEntry } from "@/lib/types";

export const metadata = {
  title: "Forward-Test Leaderboard — Chat to Backtest",
  description:
    "Public strategies ranked by live out-of-sample paper performance. Timestamped, append-only, no backfilled track records.",
};

async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(`${BACKTEST_API_URL}/leaderboard`, { cache: "no-store" });
    if (!res.ok) return [];
    const body = (await res.json()) as { entries: LeaderboardEntry[] };
    return body.entries ?? [];
  } catch {
    return [];
  }
}

function daysBadge(days: number): string | null {
  if (days >= 365) return "365d";
  if (days >= 180) return "180d";
  if (days >= 90) return "90d";
  if (days >= 30) return "30d";
  return null;
}

export default async function LeaderboardPage() {
  const entries = await getLeaderboard();

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
          No deployments have reached the minimum 20 trading days yet. Deploy a strategy
          from the playground and it will appear here as its record accrues.
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
                      <span>by {e.owner}</span>
                      <span>· since {e.deployed_at}</span>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-[11px] text-muted">
        Paper trading on end-of-day data with a slippage assumption — not real
        executions. {DISCLAIMER}
      </p>
    </main>
  );
}
