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
    <main className="w-full">
      <SectionShell tight>
        <div className="mx-auto w-full max-w-4xl">
          <Reveal>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-2xl">
                <p className="font-mono text-xs uppercase tracking-widest text-muted">
                  <span aria-hidden className="mr-2 inline-block h-2 w-0.5 bg-accent" />
                  Shared backtest · Historical simulation
                </p>
                <h1 className="mt-4 text-headline font-semibold text-balance text-ink">
                  {run.spec.name}
                </h1>
                <p className="tnum mt-2 text-caption text-faint">
                  {p?.start_date} → {p?.end_date} · daily bars · slippage included
                </p>
              </div>
              {run.watermarked && (
                <span className="rounded-(--radius-pill) border border-hairline bg-panel px-2.5 py-1 font-mono text-caption uppercase tracking-wide text-muted">
                  made with chat·backtest
                </span>
              )}
            </div>
          </Reveal>

          <Reveal>
            <div className="mt-8">
              <StatTiles stats={run.stats} />
            </div>
          </Reveal>

          <Reveal>
            <Card className="mt-4">
              <EquityChart curve={run.equity_curve} height={280} />
            </Card>
          </Reveal>

          <Reveal>
            <Accordion className="mt-4">
              <AccordionItem summary="The rules (readable, no black box)">
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

          <Reveal>
            <div className="mt-10 text-center">
              <ButtonLink
                size="lg"
                href={
                  run.run_id
                    ? `/playground?run=${encodeURIComponent(run.run_id)}`
                    : "/playground"
                }
              >
                Fork this strategy — test your own “what if”
              </ButtonLink>
              <p className="mt-2 text-xs text-muted">
                Free to start — no card. Re-runs in seconds.
              </p>
            </div>
          </Reveal>
        </div>
      </SectionShell>
    </main>
  );
}
