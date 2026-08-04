import type { Template } from "@/lib/types";

/* ── Template presentation logic ─────────────────────────────────────────────
   Pure functions — shared by the homepage wall and TemplateCard so the number
   a card displays and the bucket the page sorts it into can never disagree. */

/** Windows shorter than this can't be annualized honestly — a CAGR computed
 *  from six weeks of data is a fabrication. Below this, the hero stat is the
 *  actual total return over the tested window. */
export const SHORT_WINDOW_DAYS = 365;

/** Calendar days spanned by a cached backtest window (UTC date math). */
export function windowDays(startIso: string, endIso: string): number {
  return Math.round(
    (Date.parse(`${endIso}T00:00:00Z`) - Date.parse(`${startIso}T00:00:00Z`)) /
      86_400_000,
  );
}

export type HeroStat =
  | { kind: "cagr"; value: number }
  | { kind: "total_return"; value: number }
  | null;

function num(value: unknown): number | null {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

/** THE hero stat for a template: CAGR when at least a year of data backs it,
 *  the window's total return otherwise. Null when no cached result exists. */
export function templateHero(t: Template): HeroStat {
  const cached = t.cached_stats;
  if (!cached) return null;
  const cagr = num(cached.stats?.cagr);
  const total = num(cached.stats?.total_return_pct);
  const short = windowDays(cached.start_date, cached.end_date) < SHORT_WINDOW_DAYS;
  if (!short && cagr !== null) return { kind: "cagr", value: cagr };
  if (total !== null) return { kind: "total_return", value: total };
  if (cagr !== null) return { kind: "cagr", value: cagr };
  return null;
}

export interface TemplatePartition {
  /** Hero ≥ 0, sorted hero desc (ties: id asc) — the winners-first wall pool. */
  flagship: Template[];
  /** Hero < 0, sorted worst-first — the transparency section. */
  failed: Template[];
  /** No usable hero stat — never on the wall, never called "failed". */
  unproven: Template[];
}

export function partitionTemplates(templates: Template[]): TemplatePartition {
  const flagship: Template[] = [];
  const failed: Template[] = [];
  const unproven: Template[] = [];
  for (const t of templates) {
    const hero = templateHero(t);
    if (hero === null) unproven.push(t);
    else if (hero.value < 0) failed.push(t);
    else flagship.push(t);
  }
  const heroValue = (t: Template) => templateHero(t)!.value;
  flagship.sort((a, b) => heroValue(b) - heroValue(a) || a.id.localeCompare(b.id));
  failed.sort((a, b) => heroValue(a) - heroValue(b) || a.id.localeCompare(b.id));
  unproven.sort((a, b) => a.id.localeCompare(b.id));
  return { flagship, failed, unproven };
}

/** The 6 cards for the homepage wall: flagship top 6, falling back to
 *  unproven ("Run it to see results" cards are honest). Never a failed one —
 *  those live in the transparency section below the fold. */
export function wallTemplates(p: TemplatePartition): Template[] {
  const pool = p.flagship.length > 0 ? p.flagship : p.unproven;
  return pool.slice(0, 6);
}
