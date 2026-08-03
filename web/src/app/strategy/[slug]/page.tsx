import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import EquityChart from "@/components/EquityChart";
import ShareToX from "@/components/ShareToX";
import StatTiles from "@/components/StatTiles";
import { fmtDate, fmtNum, fmtPct, fmtSignedPct } from "@/lib/format";
import { BACKTEST_API_URL } from "@/lib/server/backend";
import type { EquityPoint, StrategyPagePayload } from "@/lib/types";

async function getStrategy(slug: string): Promise<StrategyPagePayload | null> {
  try {
    const res = await fetch(
      `${BACKTEST_API_URL}/strategy/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as StrategyPagePayload;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStrategy(slug);
  if (!data) return { title: "Strategy not found — Chat·Backtest" };
  const title = `${data.deployment.name} — forward-test record`;
  const description = `${fmtSignedPct(data.summary.forward_return_pct, 2)} over ${data.summary.days_live} trading days on the public, append-only forward ledger. Simulated performance for research/education. Not financial advice.`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

const ACTION_LABEL: Record<string, string> = {
  entry: "Entry",
  exit: "Exit",
  stop: "Stop",
  time_exit: "Time exit",
};

export default async function StrategyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getStrategy(slug);
  if (!data) notFound();

  const { deployment, summary, signals, backtest_stats } = data;

  // Forward curve with drawdown computed for the chart's sub-panel.
  let peak = -Infinity;
  const forwardCurve: EquityPoint[] = data.equity.map((p) => {
    peak = Math.max(peak, p.equity);
    return {
      date: p.date,
      equity: p.equity,
      drawdown_pct: peak > 0 ? ((peak - p.equity) / peak) * 100 : 0,
    };
  });

  const fwd = summary.forward_return_pct;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent">
            The Ledger · Public record
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{deployment.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="rounded-full border border-hairline bg-panel px-2.5 py-0.5">
              Forward-tested {summary.days_live} days
            </span>
            <span>by {deployment.owner}</span>
            <span>· deployed {deployment.deployed_at}</span>
            <span
              className="tnum rounded-full border border-hairline px-2 py-0.5"
              title="SHA-256 of the frozen strategy spec — the deployed rules cannot be changed without changing this hash"
            >
              spec {deployment.spec_hash.slice(0, 12)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ShareToX
            name={deployment.name}
            path={`/strategy/${deployment.slug}`}
            forwardReturnPct={summary.forward_return_pct}
            daysLive={summary.days_live}
          />
          {data.source_run_id && (
            <Link
              href={`/playground?run=${encodeURIComponent(data.source_run_id)}`}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Fork this strategy
            </Link>
          )}
        </div>
      </div>

      {/* Side-by-side: backtest vs forward. NEVER merged into one curve. */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-hairline bg-panel p-4">
          <h2 className="text-sm font-medium">
            Original backtest <span className="text-xs text-muted">(in-sample, 2016 →)</span>
          </h2>
          {backtest_stats ? (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">CAGR</dt>
                <dd className="tnum">{fmtPct(backtest_stats.cagr as number, 2)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">Total return</dt>
                <dd className="tnum">{fmtSignedPct(backtest_stats.total_return_pct as number, 0)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">Max drawdown</dt>
                <dd className="tnum">{fmtPct(backtest_stats.max_drawdown as number)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted">Sharpe</dt>
                <dd className="tnum">{fmtNum(backtest_stats.sharpe as number)}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted">No backtest snapshot stored.</p>
          )}
        </div>
        <div className="rounded-xl border border-accent/40 bg-panel p-4">
          <h2 className="text-sm font-medium">
            Live forward test{" "}
            <span className="text-xs text-muted">(out-of-sample, since {deployment.deployed_at})</span>
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted">Forward return</dt>
              <dd className={`tnum ${fwd > 0 ? "text-gain" : fwd < 0 ? "text-loss" : ""}`}>
                {fmtSignedPct(fwd, 2)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted">Max drawdown</dt>
              <dd className="tnum">{fmtPct(summary.max_drawdown_pct)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted">Days live</dt>
              <dd className="tnum">{summary.days_live}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted">Ledger signals</dt>
              <dd className="tnum">{summary.signal_count}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-hairline bg-panel p-4">
        <h2 className="mb-2 text-sm font-medium">Forward paper equity</h2>
        {forwardCurve.length > 1 ? (
          <EquityChart curve={forwardCurve} height={260} />
        ) : (
          <p className="text-sm text-muted">
            Not enough forward history to chart yet — check back after a few trading days.
          </p>
        )}
      </div>

      {summary.open_positions.length > 0 && (
        <div className="mt-4 rounded-xl border border-hairline bg-panel p-4">
          <h2 className="mb-2 text-sm font-medium">Open paper positions</h2>
          <ul className="space-y-1 text-sm">
            {summary.open_positions.map((p) => (
              <li key={`${p.symbol}-${p.entry_date}`} className="tnum text-muted">
                <span className="font-medium text-ink">{p.symbol}</span> — {p.shares} shares
                since {fmtDate(p.entry_date)} @ {fmtNum(p.entry_price)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <h2 className="mb-2 text-sm font-medium">
          Signals ledger{" "}
          <span className="text-xs text-muted">(append-only — rows can never be edited or deleted)</span>
        </h2>
        {signals.length ? (
          <div className="overflow-x-auto rounded-xl border border-hairline">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-hairline bg-panel text-left text-muted">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Symbol</th>
                  <th className="px-3 py-2 font-medium text-right">Price</th>
                  <th className="px-3 py-2 font-medium text-right">Shares</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((s, i) => (
                  <tr key={i} className="border-b border-hairline last:border-0">
                    <td className="tnum px-3 py-1.5">{s.signal_date}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className={
                          s.action === "entry" ? "text-accent" : "text-muted"
                        }
                      >
                        {ACTION_LABEL[s.action] ?? s.action}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-medium">{s.symbol}</td>
                    <td className="tnum px-3 py-1.5 text-right">{fmtNum(s.price)}</td>
                    <td className="tnum px-3 py-1.5 text-right">{s.shares}</td>
                    <td className="px-3 py-1.5 text-muted">{s.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-lg border border-hairline bg-panel p-4 text-sm text-muted">
            No signals yet — this strategy is waiting for its rules to fire on live
            end-of-day data. That&apos;s the ledger being honest.
          </p>
        )}
      </div>

      <details className="mt-4 rounded-xl border border-hairline bg-panel px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">
          Frozen strategy rules (immutable since deployment)
        </summary>
        <pre className="tnum mt-3 overflow-x-auto rounded-md bg-background p-3 text-xs leading-relaxed">
          {JSON.stringify(data.spec, null, 2)}
        </pre>
      </details>

      <div className="mt-6 rounded-xl border border-hairline bg-panel p-4 text-xs leading-relaxed text-muted">
        <p className="font-medium text-ink">Execution model</p>
        <p className="mt-1">{data.execution_model}</p>
        <p className="mt-2">
          Forward testing has no survivorship bias — signals are recorded as they
          happen, on the symbols the strategy actually watches. {data.disclaimer}
        </p>
      </div>
    </main>
  );
}
