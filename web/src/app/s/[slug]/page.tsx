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

type SharePayload = RunResult & { watermarked?: boolean; share_slug?: string };

// cache() so generateMetadata and the page share ONE backend fetch.
const getShare = cache(async function getShare(slug: string): Promise<SharePayload | null> {
  try {
    const res = await fetch(`${BACKTEST_API_URL}/share/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as SharePayload;
  } catch {
    return null;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const shared = await getShare(slug);
  const name = shared?.spec?.name;
  // Shared links exist to be pasted into chats and timelines, so OG tags
  // matter here — but they stay out of the search index: they are ephemeral
  // user results, not content that should compete with the library or blog.
  return pageMetadata({
    title: name
      ? `${name} — shared backtest — Chat·Backtest`
      : "Shared backtest — Chat·Backtest",
    description: name
      ? `A shared simulation of ${name} — equity curve, drawdown, and the full trade list. Historical simulation for research and education, not financial advice.`
      : "A shared backtest simulation — equity curve, drawdown, and the full trade list. Research and education only.",
    path: `/s/${slug}`,
    noIndex: true,
  });
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
