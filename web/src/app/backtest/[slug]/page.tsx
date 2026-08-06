import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import SectionShell from "@/components/SectionShell";
import Card from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { DISCLAIMER } from "@/lib/constants";
import { fmtPct, fmtSignedPct } from "@/lib/format";
import { plainRules } from "@/lib/plainRules";
import { postForTemplate } from "@/lib/blog";
import { pageMetadata } from "@/lib/seo";
import { STRATEGY_COPY } from "@/lib/strategyCopy";
import {
  getTemplateCurve,
  getTemplates,
  siblingTemplates,
  templateForwardRecord,
} from "@/lib/server/templatePages";
import type { Template } from "@/lib/types";
import EquityCurveFigure from "./EquityCurveFigure";

/* Section 4 — programmatic strategy pages.
 *
 * The registry that gates these is STRATEGY_COPY, NOT the template list: a
 * template without hand-written interpretation would be a thin page, and 14
 * thin pages is exactly the pattern Google penalises programmatic content
 * for. If a template ships without copy, it simply has no page.
 *
 * Every number on this page renders from the engine. The prose beside it
 * contains none — see strategyCopy.ts. */

export const revalidate = 21600; // 6h, matching TemplateStatsBlock
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(STRATEGY_COPY).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!STRATEGY_COPY[slug]) {
    return pageMetadata({
      title: "Strategy not found — Chat·Backtest",
      description: "That strategy page doesn't exist.",
      path: `/backtest/${slug}`,
      noIndex: true,
    });
  }
  const t = (await getTemplates()).find((x) => x.id === slug);
  if (!t) {
    // Service unreachable — the slug is real, the DATA isn't here yet. Keep
    // the URL, keep it out of the index until it can render properly.
    return pageMetadata({
      title: `${slug} backtest — Chat·Backtest`,
      description: "Live results for this strategy are loading.",
      path: `/backtest/${slug}`,
      noIndex: true,
    });
  }
  const name = t.meta?.display_name ?? slug;
  // Spec §P1-2 mandates "[Strategy] backtest — 10-year CAGR, drawdown &
  // Sharpe". That is right for the daily templates and FALSE for the intraday
  // ones: they run a ~45-day window, and the page itself refuses to show a
  // CAGR for them. A title must not promise a number the page won't print.
  const intraday = (t.cached_stats?.timeframe ?? "1d") !== "1d";
  return pageMetadata({
    title: intraday
      ? `${name} backtest — intraday results, drawdown & Sharpe`
      : `${name} backtest — 10-year CAGR, drawdown & Sharpe`,
    description:
      `${t.meta?.one_liner ?? `The ${name} strategy, backtested.`} Live engine results: CAGR, max drawdown, Sharpe and trade count, plus the exact rules and a public forward-test record.`.slice(
        0,
        160,
      ),
    path: `/backtest/${slug}`,
    keywords: [`${name.toLowerCase()} backtest`, `does ${name.toLowerCase()} work`],
  });
}

function Stat({
  label,
  value,
  hint,
  negative,
}: {
  label: string;
  value: string;
  hint?: string;
  negative?: boolean;
}) {
  return (
    <div>
      <dt className="text-caption uppercase tracking-widest text-muted">{label}</dt>
      <dd
        className={`tnum mt-0.5 text-xl font-medium ${negative ? "text-loss" : "text-ink"}`}
      >
        {value}
      </dd>
      {hint ? <p className="mt-0.5 text-caption text-faint">{hint}</p> : null}
    </div>
  );
}

function StatBlock({ t }: { t: Template }) {
  const c = t.cached_stats;
  const s = c?.stats;
  if (!s) {
    return (
      <Card className="mt-6 text-sm text-muted">
        Results for this strategy aren&rsquo;t cached right now. Open it in{" "}
        <Link href={`/playground?template=${t.id}`} className="text-accent hover:underline">
          the lab
        </Link>{" "}
        to run it yourself.
      </Card>
    );
  }
  const short = c.timeframe !== "1d";
  return (
    <>
      <Card className="mt-6">
        <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
          <Stat
            label="Total return"
            value={fmtSignedPct(s.total_return_pct)}
            negative={(s.total_return_pct ?? 0) < 0}
          />
          {/* An annualized figure computed off a ~45-day intraday window is
              arithmetic, not information — the rest of the site refuses to
              show it, and so does this page. */}
          <Stat
            label="CAGR"
            value={short ? "—" : fmtSignedPct(s.cagr)}
            hint={short ? "window too short" : undefined}
            negative={!short && (s.cagr ?? 0) < 0}
          />
          <Stat label="Max drawdown" value={fmtPct(s.max_drawdown)} negative />
          <Stat label="Sharpe" value={(s.sharpe ?? 0).toFixed(2)} />
          <Stat label="Win rate" value={fmtPct(s.win_rate)} />
          <Stat label="Trades" value={String(s.total_trades ?? 0)} />
        </dl>
      </Card>
      <p className="mt-2 text-caption text-faint">
        {c.timeframe} bars, {c.start_date} to {c.end_date}. Computed by the same
        engine the lab runs, refreshed on a schedule — not typed in by hand.
      </p>
    </>
  );
}

/** Shown when the service can't be reached. Deliberately still carries the
 *  interpretation copy — it is static, substantial, and the most useful thing
 *  we can show — but no numbers, because we have none. Marked noindex by
 *  generateMetadata. */
function UnavailableState({
  slug,
  copy,
}: {
  slug: string;
  copy: (typeof STRATEGY_COPY)[string];
}) {
  return (
    <main className="w-full">
      <SectionShell
        headingAs="h1"
        hero
        tight
        eyebrow="Strategy · Results loading"
        title={`${slug.replace(/-/g, " ")} backtest`}
        sub="Live results for this strategy aren't reachable right now. The analysis below doesn't depend on them."
      >
        <div className="docs-prose max-w-[75ch]">
          <h2>What the numbers mean</h2>
          {copy.whatTheNumbersMean.map((p) => (
            <p key={p.slice(0, 40)}>{p}</p>
          ))}
        </div>
        <div className="mt-8">
          <ButtonLink href={`/playground?template=${slug}`}>
            Run it yourself in the lab
          </ButtonLink>
        </div>
        <Card className="mt-10 max-w-[75ch] text-caption leading-relaxed text-faint">
          {DISCLAIMER}
        </Card>
      </SectionShell>
    </main>
  );
}

export default async function StrategyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const copy = STRATEGY_COPY[slug];
  if (!copy) notFound();

  const templates = await getTemplates();
  const t = templates.find((x) => x.id === slug);
  if (!t) {
    // NOT a 404. The slug is in the registry, so this URL is real and
    // indexed — the template data just isn't reachable this second. 404ing
    // here would deindex 14 live pages off one service blip, which is exactly
    // what /stocks did before it was fixed. noStore() keeps the degraded
    // render out of the ISR cache so the next request retries.
    noStore();
    return <UnavailableState slug={slug} copy={copy} />;
  }

  const name = t.meta?.display_name ?? slug;
  const rules = plainRules(t.spec);
  const [curve, record] = await Promise.all([
    getTemplateCurve(slug),
    templateForwardRecord(t),
  ]);
  const article = postForTemplate(slug);
  const siblings = siblingTemplates(templates, t, Object.keys(STRATEGY_COPY));

  return (
    <main className="w-full">
      <SectionShell
        headingAs="h1"
        hero
        tight
        eyebrow={`${t.meta?.category ?? "Strategy"} · Tested, not asserted`}
        title={`${name} backtest: does it actually work?`}
        sub={t.meta?.one_liner}
      >
        <div className="max-w-[75ch]">
          <StatBlock t={t} />
        </div>

        <div className="docs-prose max-w-[75ch]">
          <h2>The exact rules we tested</h2>
          {/* Rendered from the spec by a deterministic translator, so this
              can never describe rules other than the ones that ran. */}
          <ul>
            {rules.map((r) => (
              <li key={r.label}>
                <strong>{r.label}:</strong>{" "}{r.text}
              </li>
            ))}
          </ul>

          <h2>The equity curve</h2>
        </div>

        <div className="max-w-[75ch]">
          <EquityCurveFigure name={name} curve={curve} />
        </div>

        <div className="docs-prose max-w-[75ch]">
          <h2>What the numbers mean</h2>
          {copy.whatTheNumbersMean.map((p) => (
            <p key={p.slice(0, 40)}>{p}</p>
          ))}

          <Card className="not-prose my-6 border-l-2 border-l-accent p-5">
            <p className="text-caption uppercase tracking-widest text-muted">
              The honest caveat
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {copy.honestCaveat}
            </p>
          </Card>

          <h2>Forward-test record</h2>
          {record ? (
            <p>
              This strategy is deployed on the public ledger as{" "}
              <Link href={`/strategy/${record.slug}`}>{record.name}</Link>. Its
              rules were frozen and hashed on {record.deployed_at}, and from
              that day it has been scored on data that did not exist when it was
              written. The backtest above and that forward record are never
              merged — see{" "}
              <Link href="/leaderboard">the leaderboard</Link>{" "}for where it
              currently sits.
            </p>
          ) : (
            <p>
              This strategy doesn&rsquo;t have a live forward-test record yet.
              The backtest above is hypothetical by definition: it is graded on
              an exam whose answers already existed when the rules were written.{" "}
              <Link href="/leaderboard">The ledger</Link>{" "}is where that stops
              being true.
            </p>
          )}

          <h2>Test a variation</h2>
          <p>
            The rules above are a starting point, not an answer. Each of these
            is a sentence you can type into the chat in the lab — it rewrites
            the spec and reruns in seconds, no signup required.
          </p>
          <ul>
            {copy.editsWorthTrying.map((e) => (
              <li key={e.edit}>
                <strong>&ldquo;{e.edit}&rdquo;</strong>{" "}— {e.why}
              </li>
            ))}
          </ul>
          <p>
            <strong>Who this suits:</strong>{" "}{copy.whoItSuits}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={`/playground?template=${t.id}`}>
            Open {name} in the lab
          </ButtonLink>
          <ButtonLink href="/leaderboard" variant="secondary">
            See the live records
          </ButtonLink>
        </div>

        <section
          aria-label="Keep reading"
          className="mt-12 border-t border-hairline pt-8"
        >
          <h2 className="text-caption uppercase tracking-widest text-muted">
            Keep reading
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {article ? (
              <Card pad="none" className="card-hover">
                <Link href={`/blog/${article.slug}`} className="focus-ring block h-full p-5">
                  <p className="text-caption uppercase tracking-widest text-faint">
                    Article
                  </p>
                  <p className="mt-1.5 text-sm font-medium leading-snug text-ink">
                    {article.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {article.description}
                  </p>
                </Link>
              </Card>
            ) : null}
            {siblings.map((s) => (
              <Card key={s.id} pad="none" className="card-hover">
                <Link href={`/backtest/${s.id}`} className="focus-ring block h-full p-5">
                  <p className="text-caption uppercase tracking-widest text-faint">
                    {s.meta?.category ?? "Strategy"}
                  </p>
                  <p className="mt-1.5 text-sm font-medium leading-snug text-ink">
                    {s.meta?.display_name ?? s.id} backtest
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {s.meta?.one_liner}
                  </p>
                </Link>
              </Card>
            ))}
          </div>
        </section>

        <Card className="mt-10 max-w-[75ch] text-caption leading-relaxed text-faint">
          {DISCLAIMER}
        </Card>
      </SectionShell>
    </main>
  );
}
