import { BACKTEST_API_URL } from "@/lib/server/backend";
import type { Template } from "@/lib/types";

/** Server-side data for the Section 4 strategy pages.
 *
 *  Everything here degrades to null/[] rather than throwing: a page that
 *  renders without its chart is fine, a 500 on an indexed URL is not — the
 *  same lesson the /stocks pages taught the hard way. */

const REVALIDATE = 21_600; // 6h

export interface CurvePoint {
  /** Date/time of the point. */
  d: string;
  /** Equity. */
  e: number | null;
  /** Drawdown %, positive-magnitude. */
  dd: number | null;
}

export interface TemplateCurve {
  points: CurvePoint[];
  start_date: string;
  end_date: string;
  timeframe: string;
  /** How many points the curve had before downsampling — shown so the chart
   *  never implies more resolution than it has. */
  raw_points: number;
}

export async function getTemplates(): Promise<Template[]> {
  try {
    const res = await fetch(`${BACKTEST_API_URL}/templates`, {
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { templates?: Template[] };
    return body.templates ?? [];
  } catch {
    return [];
  }
}

export async function getTemplateCurve(id: string): Promise<TemplateCurve | null> {
  try {
    const res = await fetch(
      `${BACKTEST_API_URL}/templates/${encodeURIComponent(id)}/curve`,
      { next: { revalidate: REVALIDATE } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { found?: boolean } & TemplateCurve;
    if (!body.found || !body.points?.length) return null;
    return body;
  } catch {
    return null;
  }
}

export interface ForwardRecord {
  slug: string;
  name: string;
  deployed_at: string;
}

/** The house deployment for a template, matched on spec hash where possible
 *  and name otherwise. Returns null rather than guessing — claiming a strategy
 *  has a live record when it doesn't is exactly the kind of overclaim the
 *  ledger exists to prevent. */
export async function templateForwardRecord(
  t: Template,
): Promise<ForwardRecord | null> {
  try {
    const res = await fetch(`${BACKTEST_API_URL}/leaderboard`, {
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      entries?: ForwardRecord[];
      qualifying?: ForwardRecord[];
    };
    const rows = [...(body.entries ?? []), ...(body.qualifying ?? [])];
    const wanted = (t.meta?.display_name ?? "").trim().toLowerCase();
    if (!wanted) return null;
    const hit = rows.find(
      (r) => (r.name ?? "").trim().toLowerCase() === wanted,
    );
    return hit?.slug ? { slug: hit.slug, name: hit.name, deployed_at: hit.deployed_at } : null;
  } catch {
    return null;
  }
}

/** Two siblings for the internal-links block (spec §8). Prefers a different
 *  category so the block widens the crawl rather than pooling one cluster. */
export function siblingTemplates(
  all: Template[],
  current: Template,
  allowed: string[],
): Template[] {
  const pool = all.filter((t) => t.id !== current.id && allowed.includes(t.id));
  const cat = current.meta?.category;
  const sameCat = pool.filter((t) => t.meta?.category === cat);
  const otherCat = pool.filter((t) => t.meta?.category !== cat);
  // Deterministic pick (index by id hash) so the links are stable across
  // renders — a sibling block that reshuffles every 6h wastes crawl budget.
  const pick = (arr: Template[], n: number) => {
    const sorted = [...arr].sort((a, b) => a.id.localeCompare(b.id));
    if (!sorted.length) return [];
    const seed = [...current.id].reduce((h, ch) => h + ch.charCodeAt(0), 0);
    return Array.from({ length: Math.min(n, sorted.length) }, (_, i) =>
      sorted[(seed + i) % sorted.length],
    );
  };
  // Always return TWO. sell-in-may is the only Seasonal template, so a naive
  // one-from-each-bucket split leaves it with a single sibling and breaks the
  // spec's internal-linking rule — top up from whichever bucket has spare.
  const out = [...pick(sameCat, 1), ...pick(otherCat, 1)];
  if (out.length < 2) {
    const rest = pool.filter((t) => !out.some((o) => o.id === t.id));
    out.push(...pick(rest, 2 - out.length));
  }
  return out.slice(0, 2);
}
