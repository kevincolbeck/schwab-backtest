import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SectionShell from "@/components/SectionShell";
import Card from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { DISCLAIMER } from "@/lib/constants";
import {
  COMPARE_AXES,
  COMPETITORS,
  LEDGER_SECTION,
  US_BY_AXIS,
  competitorBySlug,
} from "@/lib/compare";
import { pageMetadata } from "@/lib/seo";

/* Comparison pages (P1-5). The registry is the slug allowlist —
   dynamicParams:false means a slug that isn't in compare.ts 404s at the edge
   rather than rendering an empty table. */

export const dynamicParams = false;

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = competitorBySlug(slug);
  // Every branch goes through pageMetadata() — a bare return inherits the
  // ROOT's openGraph block and canonical (Next merges metadata shallowly).
  if (!c) {
    return pageMetadata({
      title: "Comparison not found — Chat·Backtest",
      description: "That comparison page doesn't exist.",
      path: `/compare/${slug}`,
      noIndex: true,
    });
  }
  return pageMetadata({
    title: `${c.name} vs Chat·Backtest — an honest comparison`,
    description: c.description,
    path: `/compare/${c.slug}`,
    keywords: [c.targetKeyword],
  });
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = competitorBySlug(slug);
  if (!c) notFound();

  const byAxis = new Map(c.rows.map((r) => [r.axis, r]));
  const others = COMPETITORS.filter((o) => o.slug !== c.slug);

  return (
    <main className="w-full">
      <SectionShell
        headingAs="h1"
        hero
        tight
        eyebrow="Compare · Differences, not disparagement"
        title={`${c.name} vs Chat·Backtest`}
        sub={c.positioning}
      >
        <div className="docs-prose max-w-[75ch]">
          <p className="text-caption text-faint">
            Everything below about {c.name} was read from{" "}
            <a href={c.site} rel="nofollow noopener" target="_blank">
              their own site
            </a>{" "}
            on{" "}
            {new Date(`${c.checkedOn}T00:00:00Z`).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "UTC",
            })}
            , and every row links its source. Pricing and features change — if
            you find something out of date here, tell us and we&rsquo;ll fix it.
          </p>

          <h2>Feature by feature</h2>
          <table>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Feature</span>
                </th>
                <th scope="col">{c.name}</th>
                <th scope="col">Chat·Backtest</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_AXES.map((axis) => {
                const row = byAxis.get(axis);
                return (
                  <tr key={axis}>
                    <th scope="row">{axis}</th>
                    <td>
                      {row?.them ?? "—"}
                      {row?.sourceUrl ? (
                        <>
                          {" "}
                          <a
                            href={row.sourceUrl}
                            rel="nofollow noopener"
                            target="_blank"
                            className="text-caption text-faint"
                          >
                            (source)
                          </a>
                        </>
                      ) : null}
                    </td>
                    <td>{row?.us ?? US_BY_AXIS[axis]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h2>Pricing</h2>
          <table>
            <thead>
              <tr>
                <th scope="col">
                  <a href={c.pricingSourceUrl} rel="nofollow noopener" target="_blank">
                    {c.name}
                  </a>
                </th>
                <th scope="col">Chat·Backtest</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <ul>
                    {c.pricing.map((p) => (
                      <li key={p.tier}>
                        {p.tier}: {p.price}
                      </li>
                    ))}
                  </ul>
                </td>
                <td>
                  <ul>
                    <li>Free: $0</li>
                    <li>Pro: $39/mo or $390/yr</li>
                    <li>Max: $99/mo or $990/yr</li>
                  </ul>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Required by compare.test.ts. A comparison page where we win every
              row is marketing, and readers can tell. */}
          <h2>What {c.name} does better</h2>
          <ul>
            {c.theirAdvantages.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>

          <h2>{LEDGER_SECTION.heading}</h2>
          {LEDGER_SECTION.body.map((p) => (
            <p key={p.slice(0, 40)}>{p}</p>
          ))}

          <h2>Which one you actually want</h2>
          <p>
            <strong>Pick {c.name} if:</strong>{" "}{c.pickThemIf}
          </p>
          <p>
            <strong>Pick Chat·Backtest if:</strong>{" "}{c.pickUsIf}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/playground">Run a backtest free</ButtonLink>
          <ButtonLink href="/leaderboard" variant="secondary">
            See the live records
          </ButtonLink>
        </div>

        {others.length > 0 ? (
          <section
            aria-label="Other comparisons"
            className="mt-12 border-t border-hairline pt-8"
          >
            <h2 className="text-caption uppercase tracking-widest text-muted">
              Other comparisons
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {others.map((o) => (
                <Card key={o.slug} pad="none" className="card-hover">
                  <Link
                    href={`/compare/${o.slug}`}
                    className="focus-ring block h-full p-5"
                  >
                    <p className="text-sm font-medium leading-snug text-ink">
                      {o.name} vs Chat·Backtest
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {o.description}
                    </p>
                  </Link>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        <Card className="mt-10 max-w-[75ch] text-caption leading-relaxed text-faint">
          {DISCLAIMER}
        </Card>
      </SectionShell>
    </main>
  );
}
