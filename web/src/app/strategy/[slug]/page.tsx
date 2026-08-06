import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import EquityChart from "@/components/EquityChart";
import { FrozenBadge, HashMark, TimestampMark } from "@/components/EvidenceMarks";
import Reveal from "@/components/Reveal";
import SectionShell from "@/components/SectionShell";
import ShareToX from "@/components/ShareToX";
import { Accordion, AccordionItem } from "@/components/ui/Accordion";
import { ButtonLink } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { fmtDate, fmtNum, fmtPct, fmtSignedPct } from "@/lib/format";
import { BACKTEST_API_URL } from "@/lib/server/backend";
import type { EquityPoint, StrategyPagePayload } from "@/lib/types";
import { pageMetadata } from "@/lib/seo";

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
  if (!data)
    // Bare returns inherit the root's openGraph/canonical — always use the helper.
    return pageMetadata({
      title: "Strategy not found — Chat·Backtest",
      description:
        "That strategy isn't on the public forward-test ledger. Browse the leaderboard for the records that are.",
      path: `/strategy/${slug}`,
      noIndex: true,
    });
  const title = `${data.deployment.name} — forward-test record`;
  const description = `${fmtSignedPct(data.summary.forward_return_pct, 2)} over ${data.summary.days_live} trading days on the public, append-only forward ledger. Simulated performance for research/education. Not financial advice.`;
  return pageMetadata({
    title: `${title} — Chat·Backtest`,
    description,
    path: `/strategy/${slug}`,
    ogImage: null, // this segment has its own opengraph-image.tsx
  });
}

const ACTION_LABEL: Record<string, string> = {
  entry: "Entry",
  exit: "Exit",
  stop: "Stop",
  time_exit: "Time exit",
};

/** Evidence-table head cell (mono small-caps — same recipe as the leaderboard). */
const TH = "px-4 py-2.5 text-left font-mono text-caption font-medium uppercase tracking-wider text-muted";

/** Whispering label over a hero number (SYSTEM.md §3). */
const DT = "text-caption uppercase tracking-widest text-muted";

/** Ledger-entrance stagger (row-in, globals.css), capped at ~12 rows. */
function rowStyle(i: number): CSSProperties {
  return { "--row-index": Math.min(i, 12) } as CSSProperties;
}

export default async function StrategyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getStrategy(slug);
  if (!data) notFound();

  const { deployment, summary, signals, backtest_stats } = data;

  // `timeframe` ships with the intraday-deploy service update — typed optional
  // so older payloads (and 1d-only deployments) render unchanged.
  const timeframe = (deployment as typeof deployment & { timeframe?: string | null })
    .timeframe;

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
    <main className="w-full">
      <SectionShell tight>
        {/* ── Evidence header: frozen badge, real hash, real timestamps, and
            the execution-model line — the instrument plate for this record. */}
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="font-mono text-xs uppercase tracking-widest text-muted">
                <span aria-hidden className="mr-2 inline-block h-2 w-0.5 bg-accent" />
                The Ledger · Public record
              </p>
              <h1 className="mt-4 text-headline font-semibold text-balance text-ink">
                {deployment.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <FrozenBadge />
                <span
                  className="inline-flex items-center gap-1 text-caption text-faint"
                  title="SHA-256 of the frozen strategy spec — the deployed rules cannot be changed without changing this hash"
                >
                  spec <HashMark hash={deployment.spec_hash} />
                </span>
                <TimestampMark iso={deployment.deployed_at} prefix="deployed" />
                <span className="text-caption text-muted">by {deployment.owner}</span>
                <span className="tnum rounded-(--radius-pill) border border-hairline bg-panel px-2.5 py-0.5 text-caption text-muted">
                  Forward-tested {summary.days_live} days
                </span>
                {timeframe && (
                  <span
                    className="tnum rounded-(--radius-pill) border border-hairline px-2 py-0.5 text-caption text-muted"
                    title="Bar timeframe this strategy trades on"
                  >
                    {timeframe}
                  </span>
                )}
              </div>
              <p className="mt-3 max-w-2xl text-caption leading-relaxed text-muted">
                <span className="font-medium text-ink">Execution model</span> ·{" "}
                {data.execution_model}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ShareToX
                name={deployment.name}
                path={`/strategy/${deployment.slug}`}
                forwardReturnPct={summary.forward_return_pct}
                daysLive={summary.days_live}
              />
              {data.source_run_id && (
                <ButtonLink
                  href={`/playground?run=${encodeURIComponent(data.source_run_id)}`}
                >
                  Fork this strategy
                </ButtonLink>
              )}
            </div>
          </div>
        </Reveal>

        {/* Side-by-side: backtest vs forward. NEVER merged into one curve. */}
        <Reveal>
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="text-sm font-medium text-ink">
                Original backtest{" "}
                <span className="text-xs font-normal text-muted">(in-sample, 2016 →)</span>
              </h2>
              {backtest_stats ? (
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <dt className={DT}>CAGR</dt>
                    <dd className="tnum mt-0.5 text-xl text-ink">
                      {fmtPct(backtest_stats.cagr as number, 2)}
                    </dd>
                  </div>
                  <div>
                    <dt className={DT}>Total return</dt>
                    <dd className="tnum mt-0.5 text-xl text-ink">
                      {fmtSignedPct(backtest_stats.total_return_pct as number, 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className={DT}>Max drawdown</dt>
                    <dd className="tnum mt-0.5 text-xl text-ink">
                      {fmtPct(backtest_stats.max_drawdown as number)}
                    </dd>
                  </div>
                  <div>
                    <dt className={DT}>Sharpe</dt>
                    <dd className="tnum mt-0.5 text-xl text-ink">
                      {fmtNum(backtest_stats.sharpe as number)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-4 text-sm text-muted">No backtest snapshot stored.</p>
              )}
            </Card>
            <Card>
              <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
                {/* Accent tick = the live/active panel (sanctioned active-state
                    accent, SYSTEM.md §1) — no colored card borders. */}
                <span aria-hidden className="inline-block h-3 w-0.5 bg-accent" />
                <span>
                  Live forward test{" "}
                  <span className="text-xs font-normal text-muted">
                    (out-of-sample, since {deployment.deployed_at})
                  </span>
                </span>
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <dt className={DT}>Forward return</dt>
                  <dd
                    className={`tnum mt-0.5 text-xl ${
                      fwd > 0 ? "text-gain" : fwd < 0 ? "text-loss" : "text-ink"
                    }`}
                  >
                    {fmtSignedPct(fwd, 2)}
                  </dd>
                </div>
                <div>
                  <dt className={DT}>Max drawdown</dt>
                  <dd className="tnum mt-0.5 text-xl text-ink">
                    {fmtPct(summary.max_drawdown_pct)}
                  </dd>
                </div>
                <div>
                  <dt className={DT}>Days live</dt>
                  <dd className="tnum mt-0.5 text-xl text-ink">{summary.days_live}</dd>
                </div>
                <div>
                  <dt className={DT}>Ledger signals</dt>
                  <dd className="tnum mt-0.5 text-xl text-ink">{summary.signal_count}</dd>
                </div>
              </dl>
            </Card>
          </div>
        </Reveal>

        <Reveal>
          <Card className="mt-4">
            <h2 className="mb-3 text-sm font-medium text-ink">Forward paper equity</h2>
            {forwardCurve.length > 1 ? (
              <EquityChart curve={forwardCurve} height={260} />
            ) : (
              <p className="text-sm text-muted">
                Not enough forward history to chart yet — check back after a few trading
                days.
              </p>
            )}
          </Card>
        </Reveal>

        {summary.open_positions.length > 0 && (
          <Reveal>
            <Card className="mt-4">
              <h2 className="mb-3 text-sm font-medium text-ink">Open paper positions</h2>
              <ul className="space-y-1 text-sm">
                {summary.open_positions.map((p) => (
                  <li key={`${p.symbol}-${p.entry_date}`} className="tnum text-muted">
                    <span className="font-medium text-ink">{p.symbol}</span> — {p.shares}{" "}
                    shares since {fmtDate(p.entry_date)} @ {fmtNum(p.entry_price)}
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        )}

        <div className="mt-10">
          <Reveal>
            <h2 className="text-xl font-medium text-ink">Signals ledger</h2>
            <p className="mt-1.5 text-sm text-muted">
              append-only — rows can never be edited or deleted
            </p>
          </Reveal>
          {signals.length ? (
            /* Rows carry their own load entrance (.row-in): the ledger
               visibly appends, once, reduced-motion guarded. */
            <Card pad="none" className="mt-4 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-hairline bg-panel-2">
                      <th className={TH}>Date</th>
                      <th className={TH}>Action</th>
                      <th className={TH}>Symbol</th>
                      <th className={`${TH} text-right`}>Price</th>
                      <th className={`${TH} text-right`}>Shares</th>
                      <th className={TH}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map((s, i) => (
                      <tr
                        key={i}
                        style={rowStyle(i)}
                        className="row-in border-b border-hairline last:border-0"
                      >
                        <td className="tnum px-4 py-2 text-faint">{s.signal_date}</td>
                        <td className="px-4 py-2">
                          <span
                            className={
                              s.action === "entry"
                                ? "font-medium text-ink"
                                : "text-muted"
                            }
                          >
                            {ACTION_LABEL[s.action] ?? s.action}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-medium text-ink">{s.symbol}</td>
                        <td className="tnum px-4 py-2 text-right">{fmtNum(s.price)}</td>
                        <td className="tnum px-4 py-2 text-right">{s.shares}</td>
                        <td className="px-4 py-2 text-muted">{s.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <Card pad="sm" className="mt-4 border-dashed text-sm text-muted">
              No signals yet — this strategy is waiting for its rules to fire on live
              end-of-day data. That&apos;s the ledger being honest.
            </Card>
          )}
        </div>

        <Reveal>
          <Accordion className="mt-4">
            <AccordionItem summary="Frozen strategy rules (immutable since deployment)">
              <pre className="tnum overflow-x-auto rounded-(--radius-card) border border-hairline bg-panel-2 p-4 text-xs leading-relaxed text-ink">
                {JSON.stringify(data.spec, null, 2)}
              </pre>
            </AccordionItem>
          </Accordion>
        </Reveal>

        <Reveal>
          <Card className="mt-6 text-caption leading-relaxed text-muted">
            <p>
              Forward testing has no survivorship bias — signals are recorded as they
              happen, on the symbols the strategy actually watches. {data.disclaimer}
            </p>
          </Card>
        </Reveal>
      </SectionShell>
    </main>
  );
}
