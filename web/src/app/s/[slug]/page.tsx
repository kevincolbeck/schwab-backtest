import Link from "next/link";
import { notFound } from "next/navigation";
import EquityChart from "@/components/EquityChart";
import StatTiles from "@/components/StatTiles";
import { DISCLAIMER } from "@/lib/constants";
import { BACKTEST_API_URL } from "@/lib/server/backend";
import type { RunResult } from "@/lib/types";

type SharePayload = RunResult & { watermarked?: boolean; share_slug?: string };

async function getShare(slug: string): Promise<SharePayload | null> {
  try {
    const res = await fetch(`${BACKTEST_API_URL}/share/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as SharePayload;
  } catch {
    return null;
  }
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const run = await getShare(slug);
  if (!run) notFound();
  const p = run.params as { start_date?: string; end_date?: string } | undefined;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <div className="rounded-2xl border border-hairline bg-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent">
              Shared backtest · Historical simulation
            </p>
            <h1 className="mt-1 text-2xl font-semibold">{run.spec.name}</h1>
            <p className="tnum mt-1 text-xs text-muted">
              {p?.start_date} → {p?.end_date} · daily bars · slippage included
            </p>
          </div>
          {run.watermarked && (
            <span className="rounded-full border border-hairline px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted">
              made with chat·backtest
            </span>
          )}
        </div>

        <div className="mt-5">
          <StatTiles stats={run.stats} />
        </div>
        <div className="mt-4">
          <EquityChart curve={run.equity_curve} height={280} />
        </div>

        <details className="mt-4 rounded-lg border border-hairline bg-background px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium">
            The rules (readable, no black box)
          </summary>
          <pre className="tnum mt-3 overflow-x-auto p-1 text-xs leading-relaxed">
            {JSON.stringify(run.spec, null, 2)}
          </pre>
        </details>

        <p className="mt-4 text-[11px] leading-relaxed text-muted">{DISCLAIMER}</p>
      </div>

      <div className="mt-6 text-center">
        <Link
          href={run.run_id ? `/playground?run=${encodeURIComponent(run.run_id)}` : "/playground"}
          className="inline-block rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-background hover:opacity-90"
        >
          Fork this strategy — test your own “what if”
        </Link>
        <p className="mt-2 text-xs text-muted">Free, no login. Re-runs in seconds.</p>
      </div>
    </main>
  );
}
