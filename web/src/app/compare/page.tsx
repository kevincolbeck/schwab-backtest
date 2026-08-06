import Link from "next/link";
import SectionShell from "@/components/SectionShell";
import Card from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { DISCLAIMER } from "@/lib/constants";
import { COMPETITORS } from "@/lib/compare";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Chat·Backtest compared to six trading platforms",
  description:
    "Honest, sourced comparisons against Composer, TradingView, TrendSpider, QuantConnect, Trade Ideas and NexusTrade — including what each of them does better than us.",
  path: "/compare",
});

export default function CompareIndexPage() {
  return (
    <main className="w-full">
      <SectionShell
        headingAs="h1"
        hero
        tight
        eyebrow="Compare · Differences, not disparagement"
        title="How this compares to the tools you're already using"
        sub={
          <>
            Six comparisons, every claim read from the vendor&rsquo;s own site
            and linked. Each page has a section on what the other product does
            better, because most of them do things we deliberately don&rsquo;t.
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {COMPETITORS.map((c) => (
            <Card key={c.slug} pad="none" className="card-hover">
              <Link
                href={`/compare/${c.slug}`}
                className="focus-ring block h-full p-5"
              >
                <p className="text-sm font-medium leading-snug text-ink">
                  {c.name} vs Chat·Backtest
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {c.description}
                </p>
              </Link>
            </Card>
          ))}
        </div>

        <div className="docs-prose mt-10 max-w-[70ch]">
          <h2>How we write these</h2>
          <p>
            Every factual claim about another product was read from that
            company&rsquo;s own pages, is quoted or linked, and carries the date
            it was checked. Where a vendor&rsquo;s pricing page is ambiguous we
            quote the ambiguity rather than resolving it in our favour. Where we
            couldn&rsquo;t confirm something, it isn&rsquo;t on the page at all.
          </p>
          <p>
            Every comparison uses the same rows in the same order, including{" "}
            <strong>Markets &amp; data</strong>, which we lose to all six. A
            table that only shows the rows we win isn&rsquo;t a comparison.
          </p>
          <p>
            Prices and features change. If something here is out of date, tell
            us at{" "}
            <a href="mailto:kevin@chatbacktest.com">kevin@chatbacktest.com</a>{" "}
            and we&rsquo;ll correct it.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/playground">Run a backtest free</ButtonLink>
          <ButtonLink href="/leaderboard" variant="secondary">
            See the live records
          </ButtonLink>
        </div>

        <Card className="mt-10 max-w-[70ch] text-caption leading-relaxed text-faint">
          {DISCLAIMER}
        </Card>
      </SectionShell>
    </main>
  );
}
