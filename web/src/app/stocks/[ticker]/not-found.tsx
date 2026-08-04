import Link from "next/link";
import SectionShell from "@/components/SectionShell";
import { ButtonLink } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { DISCLAIMER } from "@/lib/constants";

/** Branded 404 for /stocks/{ticker} — rendered with a real 404 status when the
 *  service definitively answers found:false (unknown or malformed ticker). */
export default function StockNotFound() {
  return (
    <main className="w-full">
      <SectionShell
        tight
        hero
        headingAs="h1"
        eyebrow="Stocks · Settled daily"
        title="That ticker isn't on the shelf"
        sub="We couldn't find that symbol in the lab's data cache — it may be misspelled, delisted, or outside the US stocks and ETFs this surface covers."
      >
        <div className="space-y-6">
          <Card pad="sm" className="text-sm text-muted">
            <p>Try one of these instead:</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>
                <Link
                  href="/markets"
                  className="focus-ring rounded-(--radius-tag) text-accent hover:underline"
                >
                  Browse the markets page
                </Link>{" "}
                — sector heatmap and movers, every name links back here.
              </li>
              <li>
                <Link
                  href="/library"
                  className="focus-ring rounded-(--radius-tag) text-accent hover:underline"
                >
                  Explore the strategy library
                </Link>{" "}
                — ready-made strategies you can fork and test.
              </li>
              <li>
                Press <kbd className="rounded-(--radius-tag) border border-hairline bg-panel-2 px-1.5 py-0.5 font-mono text-caption text-muted">⌘K</kbd>{" "}
                anywhere to search the site.
              </li>
            </ul>
          </Card>
          <Card className="text-center">
            <h2 className="text-xl font-medium text-ink">
              Rather test an idea than look one up?
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
              Describe a strategy in plain English and prove it on years of
              settled daily data in seconds.
            </p>
            <ButtonLink href="/playground" className="mt-5">
              Open the lab →
            </ButtonLink>
          </Card>
        </div>
      </SectionShell>
      <div className="mx-auto w-full max-w-(--container-max) px-4 pb-12 sm:px-6">
        <p className="max-w-prose text-caption leading-relaxed text-muted">{DISCLAIMER}</p>
      </div>
    </main>
  );
}
