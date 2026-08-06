import type { MetadataRoute } from "next";
import { BLOG_CATEGORIES, BLOG_POSTS, postsInCategory } from "@/lib/blog";
import { COMPETITORS } from "@/lib/compare";
import { STRATEGY_COPY } from "@/lib/strategyCopy";
import { BACKTEST_API_URL } from "@/lib/server/backend";
import { SITE_URL } from "@/lib/seo";

/** Sitemap for the public, INDEXABLE surfaces.
 *
 * Invariant (P1-2): every URL here must be indexable. Routes that carry
 * `noIndex` — /login, /account, /dashboard, /admin, /runs/{id}, /s/{slug} —
 * are deliberately absent; listing a noindex URL earns a "Submitted URL
 * marked noindex" error in Search Console. `npm run seo` cross-checks this.
 *
 * `lastModified` is only set where we know a REAL date (article publication,
 * strategy deployment, the day the site copy last changed). Stamping
 * everything with "now" on each request would be a freshness lie that Google
 * learns to ignore.
 *
 * /stocks/{symbol} entries come from the service's /stocks index — the sector
 * symbols it holds cached bars for, so every one is guaranteed to render. See
 * stockEntries() for why hardcoding the universe was actively harmful. */

/** Bump when site copy/metadata changes materially. Last: P1-2 rewrote every
 *  page title and meta description. */
const COPY_LAST_CHANGED = new Date("2026-08-06");

/** Re-generate hourly so newly deployed strategies enter the sitemap without
 *  waiting for a redeploy. */
export const revalidate = 3600;

const STATIC_ROUTES: { path: string; changeFrequency: "daily" | "weekly"; priority: number }[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  // The lab is the product — spec §P1-2 gives it its own title, so it belongs
  // in the index (it was missing before P1-2).
  { path: "/playground", changeFrequency: "weekly", priority: 0.9 },
  { path: "/markets", changeFrequency: "daily", priority: 0.9 },
  { path: "/library", changeFrequency: "weekly", priority: 0.8 },
  { path: "/leaderboard", changeFrequency: "daily", priority: 0.8 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.7 },
  // /about carries the expertise + accountability signal Google looks for on
  // "Your Money or Your Life" topics, and it's the target of every article
  // byline — so it has to be crawlable in its own right, not just via links.
  { path: "/about", changeFrequency: "weekly", priority: 0.6 },
  { path: "/compare", changeFrequency: "weekly", priority: 0.7 },
  { path: "/docs", changeFrequency: "weekly", priority: 0.6 },
  { path: "/docs/first-backtest", changeFrequency: "weekly", priority: 0.5 },
  { path: "/docs/reading-results", changeFrequency: "weekly", priority: 0.5 },
  { path: "/docs/strategy-spec", changeFrequency: "weekly", priority: 0.5 },
  { path: "/docs/forward-testing", changeFrequency: "weekly", priority: 0.5 },
  { path: "/docs/markets-timeframes", changeFrequency: "weekly", priority: 0.5 },
  { path: "/docs/manual-trading", changeFrequency: "weekly", priority: 0.5 },
  { path: "/docs/chat", changeFrequency: "weekly", priority: 0.5 },
  { path: "/docs/credits", changeFrequency: "weekly", priority: 0.5 },
  { path: "/docs/export-python", changeFrequency: "weekly", priority: 0.5 },
  { path: "/docs/export-pine", changeFrequency: "weekly", priority: 0.5 },
];

/** Stock pages we can PROVE render: the service returns the sector symbols it
 *  holds cached daily bars for, which is the one path through company_bundle()
 *  that needs no Finnhub call.
 *
 *  This used to be STOCK_UNIVERSE verbatim, and 80 of the 110 URLs it
 *  advertised were serving a hard 404: symbols with no cached bars depend on a
 *  Finnhub profile, a crawl of this very sitemap spends the 50/min budget in
 *  seconds, and the starved lookup came back as found:false → notFound() →
 *  a 404 frozen into the 6h ISR cache. The service now flags those misses
 *  retryable so they degrade instead of 404ing, and the sitemap no longer
 *  submits URLs whose indexability depends on a rate budget.
 *
 *  Degrades to an empty list if the service is unreachable — dropping stock
 *  URLs for one revalidation is cheap; submitting broken ones is not. */
async function stockEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    const res = await fetch(`${BACKTEST_API_URL}/stocks`, { next: { revalidate } });
    if (!res.ok) return [];
    const body = (await res.json()) as { symbols?: string[] };
    return (body.symbols ?? []).map((symbol) => ({
      url: `${SITE_URL}/stocks/${symbol}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
    }));
  } catch {
    return [];
  }
}

/** Public strategy pages (the forward-test records). Fetched rather than
 *  hardcoded so a newly deployed strategy is discoverable within the hour.
 *  Degrades to an empty list if the service is unreachable — a partial
 *  sitemap is far better than a failed one. */
async function strategyEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    const res = await fetch(`${BACKTEST_API_URL}/leaderboard`, {
      next: { revalidate },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      entries?: Array<{ slug?: string; deployed_at?: string }>;
      qualifying?: Array<{ slug?: string; deployed_at?: string }>;
    };
    const rows = [...(body.entries ?? []), ...(body.qualifying ?? [])];
    const seen = new Set<string>();
    const out: MetadataRoute.Sitemap = [];
    for (const row of rows) {
      if (!row.slug || seen.has(row.slug)) continue;
      seen.add(row.slug);
      const deployed = row.deployed_at ? new Date(row.deployed_at) : null;
      out.push({
        url: `${SITE_URL}/strategy/${row.slug}`,
        // A live record gains a new day of data every trading day.
        changeFrequency: "daily" as const,
        priority: 0.7,
        ...(deployed && !Number.isNaN(deployed.valueOf())
          ? { lastModified: deployed }
          : {}),
      });
    }
    return out;
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    ...STATIC_ROUTES.map((r) => ({
      url: `${SITE_URL}${r.path}`,
      lastModified: COPY_LAST_CHANGED,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    })),
    // Blog (P1-1): index + category hubs + every article in the registry.
    {
      url: `${SITE_URL}/blog`,
      lastModified: COPY_LAST_CHANGED,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    // Don't submit a hub with nothing in it (market-data-deep-dives has no
    // articles yet) — an empty page invites a thin-content assessment on a
    // domain that has no authority to spend.
    ...BLOG_CATEGORIES.filter((c) => postsInCategory(c.slug).length > 0).map((c) => ({
      url: `${SITE_URL}/blog/category/${c.slug}`,
      lastModified: COPY_LAST_CHANGED,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    // Strategy pages (Section 4). One per template that has hand-written
    // interpretation copy — the registry, not the template list, so a
    // template shipped without copy never becomes a thin indexed page.
    ...Object.keys(STRATEGY_COPY).map((slug) => ({
      url: `${SITE_URL}/backtest/${slug}`,
      lastModified: COPY_LAST_CHANGED,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    // Comparison pages (P1-5). Commercial-intent surface; the copy changes
    // only when a vendor's own pricing or features do.
    ...COMPETITORS.map((c) => ({
      url: `${SITE_URL}/compare/${c.slug}`,
      lastModified: new Date(`${c.checkedOn}T00:00:00Z`),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...BLOG_POSTS.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: new Date(`${p.publishedAt}T00:00:00Z`),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...(await strategyEntries()),
    // Stock pages refresh once per trading day (settled closes, 6h ISR).
    ...(await stockEntries()),
  ];
}
