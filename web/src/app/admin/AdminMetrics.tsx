"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

interface CohortRow {
  week: string;
  signups: number;
  activated: number;
  deployed: number;
  activation_rate: number | null;
  deployment_rate: number | null;
}

interface MetricsPayload {
  generated_at: string;
  auth_configured: boolean;
  signups_partial?: boolean;
  cohorts: CohortRow[];
  totals: CohortRow;
}

const TOKEN_KEY = "cb_admin_token"; // sessionStorage only — dies with the tab

function pct(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

export default function AdminMetrics() {
  const [token, setToken] = useState("");
  const [data, setData] = useState<MetricsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (adminToken: string, force = false) => {
    if (!adminToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/metrics${force ? "?force=1" : ""}`, {
        headers: { "x-admin-token": adminToken },
      });
      if (!res.ok) {
        setData(null);
        setError(
          res.status === 403
            ? "Bad admin token."
            : res.status === 404
              ? "Admin endpoints are disabled (no ADMIN_TOKEN on the service)."
              : `Metrics fetch failed (${res.status}).`,
        );
        return;
      }
      setData((await res.json()) as MetricsPayload);
      try {
        window.sessionStorage.setItem(TOKEN_KEY, adminToken);
      } catch {
        /* private mode — token just won't persist */
      }
    } catch {
      setError("Metrics fetch failed — is the service up?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(TOKEN_KEY);
      if (stored) {
        // A lazy useState initializer would read sessionStorage during SSR
        // hydration and mismatch — post-mount is the correct place here.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setToken(stored);
        load(stored);
      }
    } catch {
      /* ignore */
    }
  }, [load]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-headline font-semibold text-ink">Operator metrics</h1>
      <p className="mt-2 max-w-prose text-sm text-muted">
        Activation and deployment rate by weekly signup cohort, computed from
        first-party data (Supabase signups · runs store · forward ledger).
        Activation = ran ≥1 backtest. Deployment rate is over activated users.
      </p>

      {/* Outside the !data block: a failed REFRESH must be loud too — silently
          stale numbers are the wrong failure mode on a decision dashboard. */}
      {error && (
        <p role="alert" className="mt-4 text-sm text-loss">
          {error}
          {data && " Showing the previous snapshot below."}
        </p>
      )}

      {!data && (
        <Card className="mt-6">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              load(token);
            }}
          >
            <label className="flex-1">
              <span className="text-caption uppercase tracking-widest text-muted">
                Admin token
              </span>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                className="focus-ring mt-1 w-full rounded-(--radius-control) border border-hairline bg-background px-3 py-2 text-sm"
              />
            </label>
            <Button type="submit" disabled={!token || loading}>
              {loading ? "Loading…" : "Load metrics"}
            </Button>
          </form>
        </Card>
      )}

      {data && (
        <>
          {data.signups_partial && (
            <p
              role="alert"
              className="mt-4 rounded-(--radius-control) border border-hairline bg-panel-2 p-3 text-sm text-loss"
            >
              Signup data is INCOMPLETE — Supabase failed mid-fetch, so every
              rate below is unreliable. This snapshot was not cached; refresh
              once Supabase recovers.
            </p>
          )}
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Card>
              <p className="text-caption uppercase tracking-widest text-muted">Signups</p>
              <p className="tnum mt-1 text-headline text-ink">{data.totals.signups}</p>
            </Card>
            <Card>
              <p className="text-caption uppercase tracking-widest text-muted">
                Activation (target &gt;60%)
              </p>
              <p className="tnum mt-1 text-headline text-ink">
                {pct(data.totals.activation_rate)}
              </p>
            </Card>
            <Card>
              <p className="text-caption uppercase tracking-widest text-muted">
                Deployment (target &gt;20%)
              </p>
              <p className="tnum mt-1 text-headline text-ink">
                {pct(data.totals.deployment_rate)}
              </p>
            </Card>
          </div>

          <Card className="mt-4 overflow-x-auto" pad="none">
            <table className="w-full min-w-[540px] text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-caption uppercase tracking-widest text-muted">
                  <th className="px-4 py-2.5">Signup week</th>
                  <th className="px-4 py-2.5 text-right">Signups</th>
                  <th className="px-4 py-2.5 text-right">Activated</th>
                  <th className="px-4 py-2.5 text-right">Activation</th>
                  <th className="px-4 py-2.5 text-right">Deployed</th>
                  <th className="px-4 py-2.5 text-right">Deploy rate</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {data.cohorts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted">
                      No signups yet{data.auth_configured ? "" : " (auth not configured)"}.
                    </td>
                  </tr>
                )}
                {data.cohorts.map((row) => (
                  <tr key={row.week} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-2.5">{row.week}</td>
                    <td className="px-4 py-2.5 text-right">{row.signups}</td>
                    <td className="px-4 py-2.5 text-right">{row.activated}</td>
                    <td className="px-4 py-2.5 text-right">{pct(row.activation_rate)}</td>
                    <td className="px-4 py-2.5 text-right">{row.deployed}</td>
                    <td className="px-4 py-2.5 text-right">{pct(row.deployment_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="mt-4 flex items-center gap-3">
            <Button variant="secondary" onClick={() => load(token, true)} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh (bypass cache)"}
            </Button>
            <span className="text-caption text-faint">
              Snapshot {new Date(data.generated_at).toLocaleString()} · cached 10 min
              server-side
            </span>
          </div>

          <p className="mt-6 max-w-prose text-caption leading-relaxed text-faint">
            Event-level funnels (result_viewed, upgrade flow, D7/D30 return)
            live in PostHog once POSTHOG_KEY is set on Railway and Vercel —
            this table needs no key and is the source of truth for the two
            Section 1 headline rates.
          </p>
        </>
      )}
    </main>
  );
}
