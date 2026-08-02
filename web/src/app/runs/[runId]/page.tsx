import Link from "next/link";
import { notFound } from "next/navigation";
import EquityChart from "@/components/EquityChart";
import StatTiles from "@/components/StatTiles";
import { DISCLAIMER } from "@/lib/constants";
import { BACKTEST_API_URL } from "@/lib/server/backend";
import type { RunResult } from "@/lib/types";

async function getRun(runId: string): Promise<RunResult | null> {
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
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{run.spec.name}</h1>
          <p className="tnum mt-1 text-xs text-muted">
            {p?.start_date} → {p?.end_date} · slippage {p?.slippage_pct ?? 0.05}% · run{" "}
            {run.run_id}
          </p>
        </div>
        <Link
          href={`/playground?run=${encodeURIComponent(runId)}`}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Fork this strategy
        </Link>
      </div>

      <StatTiles stats={run.stats} />

      <div className="mt-4 rounded-lg border border-hairline bg-panel p-3">
        <EquityChart curve={run.equity_curve} />
      </div>

      <details className="mt-4 rounded-lg border border-hairline bg-panel px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">
          Strategy rules (readable, no black box)
        </summary>
        <pre className="tnum mt-3 overflow-x-auto rounded-md bg-background p-3 text-xs leading-relaxed">
          {JSON.stringify(run.spec, null, 2)}
        </pre>
      </details>

      <p className="mt-6 text-[11px] text-muted">{DISCLAIMER}</p>
    </main>
  );
}
