import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import EquityChart from "@/components/EquityChart";
import Reveal from "@/components/Reveal";
import SectionShell from "@/components/SectionShell";
import StatTiles from "@/components/StatTiles";
import { Accordion, AccordionItem } from "@/components/ui/Accordion";
import { ButtonLink } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { DISCLAIMER } from "@/lib/constants";
import { BACKTEST_API_URL } from "@/lib/server/backend";
import { pageMetadata } from "@/lib/seo";
import type { RunResult } from "@/lib/types";

// cache() so generateMetadata and the page share ONE backend fetch
// (no-store opts out of Next's fetch memoization).
const getRun = cache(async function getRun(runId: string): Promise<RunResult | null> {
  try {
    const res = await fetch(
      `${BACKTEST_API_URL}/runs/${encodeURIComponent(runId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as RunResult;
  } catch {
    return null;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ runId: string }>;
}): Promise<Metadata> {
  const { runId } = await params;
  const run = await getRun(runId);
  const name = run?.spec?.name;
  // noIndex: a single run is an ephemeral, user-specific result — indexing
  // them would flood the index with near-duplicate thin pages. OG tags still
  // render, so pasting the link in Slack or Discord previews properly.
  return pageMetadata({
    title: name
      ? `${name} — backtest result — Chat·Backtest`
      : "Backtest result — Chat·Backtest",
    description: name
      ? `Full simulated results for ${name}: equity curve, drawdown, and every trade. Historical simulation for research and education — not financial advice.`
      : "Full simulated results for a single backtest run — equity curve, drawdown, and every trade. Research and education only.",
    path: `/runs/${runId}`,
    noIndex: true,
  });
}

export default async function RunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const run = await getRun(runId);
  if (!run) notFound();

  const p = run.params as
    | { start_date?: string; end_date?: string; slippage_pct?: number }
    | undefined;

  return (
    <main className="w-full">
      <SectionShell tight>
        <div className="mx-auto w-full max-w-4xl">
          <Reveal>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-2xl">
                <p className="font-mono text-xs uppercase tracking-widest text-muted">
                  <span aria-hidden className="mr-2 inline-block h-2 w-0.5 bg-accent" />
                  Backtest run · Historical simulation
                </p>
                <h1 className="mt-4 text-headline font-semibold text-balance text-ink">
                  {run.spec.name}
                </h1>
                <p className="tnum mt-2 text-caption text-faint">
                  {p?.start_date} → {p?.end_date} · slippage {p?.slippage_pct ?? 0.05}%
                  · run {run.run_id}
                </p>
              </div>
              <ButtonLink href={`/playground?run=${encodeURIComponent(runId)}`}>
                Fork this strategy
              </ButtonLink>
            </div>
          </Reveal>

          <Reveal>
            <div className="mt-8">
              <StatTiles stats={run.stats} />
            </div>
          </Reveal>

          <Reveal>
            <Card className="mt-4">
              <EquityChart curve={run.equity_curve} />
            </Card>
          </Reveal>

          <Reveal>
            <Accordion className="mt-4">
              <AccordionItem summary="Strategy rules (readable, no black box)">
                <pre className="tnum overflow-x-auto rounded-(--radius-card) border border-hairline bg-panel-2 p-4 text-xs leading-relaxed text-ink">
                  {JSON.stringify(run.spec, null, 2)}
                </pre>
              </AccordionItem>
            </Accordion>
          </Reveal>

          <Reveal>
            <p className="mt-4 max-w-prose text-caption leading-relaxed text-muted">
              {DISCLAIMER}
            </p>
          </Reveal>
        </div>
      </SectionShell>
    </main>
  );
}
