import Link from "next/link";
import { redirect } from "next/navigation";
import { TimestampMark } from "@/components/EvidenceMarks";
import Sparkline from "@/components/Sparkline";
import { ButtonLink } from "@/components/ui/Button";
import { fmtPct, fmtSignedPct } from "@/lib/format";
import { BACKTEST_API_URL } from "@/lib/server/backend";
import { serverSession } from "@/lib/supabase/server";
import SignOutButton from "./signout";

/** App-surface section label — SectionShell's eyebrow grammar (SYSTEM.md §7)
 *  applied to dashboard list headers: mono small-caps + the accent tick. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-xs uppercase tracking-widest text-muted">
      <span aria-hidden className="mr-2 inline-block h-2 w-0.5 bg-accent" />
      {children}
    </h2>
  );
}

export const metadata = { title: "Dashboard — Chat to Backtest" };

async function serviceGet(path: string, token: string) {
  try {
    const res = await fetch(`${BACKTEST_API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const session = await serverSession();
  if (!session) redirect("/login");

  const [me, myRuns, myDeployments] = await Promise.all([
    serviceGet("/me", session.accessToken),
    serviceGet("/me/runs", session.accessToken),
    serviceGet("/me/deployments", session.accessToken),
  ]);
  const runs = myRuns?.runs ?? [];
  const deployments = myDeployments?.deployments ?? [];

  return (
    <main className="mx-auto w-full max-w-(--container-max) px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline font-semibold text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            {session.user.email} ·{" "}
            <span className="uppercase">{me?.plan ?? "free"}</span> plan ·{" "}
            <Link
              href="/account"
              className="focus-ring rounded-(--radius-tag) text-accent hover:underline"
            >
              manage account
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ButtonLink href="/playground">Open playground</ButtonLink>
          <SignOutButton />
        </div>
      </div>

      <section className="mt-10">
        <SectionLabel>
          My forward deployments{" "}
          {me && (
            <span className="tnum normal-case tracking-normal">
              ({deployments.length}/{me.limits?.deployments ?? "—"} slots)
            </span>
          )}
        </SectionLabel>
        {deployments.length ? (
          <div className="card mt-3 overflow-hidden">
            {deployments.map(
              (d: {
                slug: string;
                name: string;
                deployed_at: string;
                summary: { forward_return_pct: number; max_drawdown_pct: number; days_live: number; sparkline: number[] };
              }) => (
                <Link
                  key={d.slug}
                  href={`/strategy/${d.slug}`}
                  className="focus-ring flex items-center gap-4 border-b border-hairline px-4 py-3 transition-colors duration-(--dur-micro) last:border-0 hover:bg-panel-2"
                >
                  <span className="flex-1 text-sm font-medium text-ink">{d.name}</span>
                  <TimestampMark
                    iso={d.deployed_at}
                    prefix="since"
                    className="hidden md:block"
                  />
                  <span className="tnum hidden text-xs text-muted sm:block">
                    {d.summary.days_live}d live · maxDD {fmtPct(d.summary.max_drawdown_pct)}
                  </span>
                  <Sparkline values={d.summary.sparkline} baseline={100000} width={90} height={22} />
                  <span
                    className={`tnum w-20 text-right text-sm ${
                      d.summary.forward_return_pct > 0
                        ? "text-gain"
                        : d.summary.forward_return_pct < 0
                          ? "text-loss"
                          : "text-muted"
                    }`}
                  >
                    {fmtSignedPct(d.summary.forward_return_pct, 2)}
                  </span>
                </Link>
              ),
            )}
          </div>
        ) : (
          <p className="card mt-3 border-dashed p-4 text-sm text-muted">
            Nothing deployed yet. Run a backtest you like, then hit{" "}
            <span className="text-ink">Deploy to forward test</span> — the ledger does
            the rest, one honest day at a time.
          </p>
        )}
      </section>

      <section className="mt-10">
        <SectionLabel>My recent runs</SectionLabel>
        {runs.length ? (
          <div className="card mt-3 overflow-hidden">
            {runs.map(
              (r: {
                run_id: string;
                name?: string;
                stats: { cagr?: number; total_return_pct?: number; max_drawdown?: number; total_trades?: number };
                share_slug?: string;
              }) => (
                <div
                  key={r.run_id}
                  className="flex items-center gap-4 border-b border-hairline px-4 py-3 last:border-0"
                >
                  <Link
                    href={`/runs/${r.run_id}`}
                    className="focus-ring flex-1 rounded-(--radius-tag) text-sm font-medium text-ink transition-colors duration-(--dur-micro) hover:text-accent"
                  >
                    {r.name ?? r.run_id}
                  </Link>
                  <span className="tnum hidden text-xs text-muted sm:block">
                    CAGR {fmtPct(r.stats.cagr ?? null, 2)} · DD{" "}
                    {fmtPct(r.stats.max_drawdown ?? null)} · {r.stats.total_trades ?? 0} trades
                  </span>
                  {r.share_slug && (
                    <Link
                      href={`/s/${r.share_slug}`}
                      className="focus-ring rounded-(--radius-tag) text-xs text-accent hover:underline"
                    >
                      shared
                    </Link>
                  )}
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="card mt-3 border-dashed p-4 text-sm text-muted">
            No saved runs yet — runs you make while signed in land here automatically.
          </p>
        )}
      </section>
    </main>
  );
}
