import Link from "next/link";
import { redirect } from "next/navigation";
import Sparkline from "@/components/Sparkline";
import { fmtPct, fmtSignedPct } from "@/lib/format";
import { BACKTEST_API_URL } from "@/lib/server/backend";
import { serverSession } from "@/lib/supabase/server";
import SignOutButton from "./signout";

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
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            {session.user.email} ·{" "}
            <span className="uppercase">{me?.plan ?? "free"}</span> plan ·{" "}
            <Link href="/account" className="text-accent hover:underline">
              manage account
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/playground"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Open playground
          </Link>
          <SignOutButton />
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          My forward deployments{" "}
          {me && (
            <span className="tnum normal-case">
              ({deployments.length}/{me.limits?.deployments ?? "—"} slots)
            </span>
          )}
        </h2>
        {deployments.length ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-hairline">
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
                  className="flex items-center gap-4 border-b border-hairline bg-panel px-4 py-3 last:border-0 hover:bg-panel-2"
                >
                  <span className="flex-1 text-sm font-medium">{d.name}</span>
                  <span className="hidden text-xs text-muted sm:block">
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
          <p className="mt-3 rounded-lg border border-hairline bg-panel p-4 text-sm text-muted">
            Nothing deployed yet. Run a backtest you like, then hit{" "}
            <span className="text-ink">Deploy to forward test</span> — the ledger does
            the rest, one honest day at a time.
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          My recent runs
        </h2>
        {runs.length ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-hairline">
            {runs.map(
              (r: {
                run_id: string;
                name?: string;
                stats: { cagr?: number; total_return_pct?: number; max_drawdown?: number; total_trades?: number };
                share_slug?: string;
              }) => (
                <div
                  key={r.run_id}
                  className="flex items-center gap-4 border-b border-hairline bg-panel px-4 py-3 last:border-0"
                >
                  <Link
                    href={`/runs/${r.run_id}`}
                    className="flex-1 text-sm font-medium hover:text-accent"
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
                      className="text-xs text-accent hover:underline"
                    >
                      shared
                    </Link>
                  )}
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-hairline bg-panel p-4 text-sm text-muted">
            No saved runs yet — runs you make while signed in land here automatically.
          </p>
        )}
      </section>
    </main>
  );
}
