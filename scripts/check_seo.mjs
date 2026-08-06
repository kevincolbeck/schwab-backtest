#!/usr/bin/env node
/**
 * P1-2 acceptance checker — crawls the site and enforces the spec's bar:
 *   "no two pages share a title or meta description; one H1 per page;
 *    OG tags render rich previews."
 *
 * Usage:
 *   node scripts/check_seo.mjs                      # http://127.0.0.1:3000
 *   node scripts/check_seo.mjs https://chatbacktest.com
 *
 * Exits non-zero on any violation so it can gate a deploy.
 */

const BASE = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/$/, "");

/** Representative routes — one per template, since dynamic routes share code. */
const ROUTES = [
  "/",
  "/playground",
  "/library",
  "/leaderboard",
  "/markets",
  "/pricing",
  "/blog",
  "/blog/category/strategy-tests",
  "/blog/category/how-to",
  "/blog/category/behind-the-ledger",
  "/blog/category/market-data-deep-dives",
  "/blog/does-the-golden-cross-work",
  "/blog/macd-strategy-backtest",
  "/blog/donchian-breakout-strategy",
  "/blog/vwap-strategy-backtest",
  "/blog/backtest-vs-forward-test",
  "/blog/how-to-backtest-a-trading-strategy-without-code",
  "/docs",
  "/docs/first-backtest",
  "/docs/reading-results",
  "/docs/strategy-spec",
  "/docs/forward-testing",
  "/docs/markets-timeframes",
  "/docs/chat",
  "/docs/credits",
  "/docs/export-python",
  "/docs/export-pine",
  "/docs/manual-trading",
  "/login",
];

const pick = (html, re) => {
  const m = html.match(re);
  return m ? m[1].trim() : null;
};
const decode = (s) =>
  s
    ?.replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<!--\s*-->/g, "");

const meta = (html, prop) =>
  pick(
    html,
    new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, "i"),
  ) ??
  pick(
    html,
    new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${prop}"`, "i"),
  );

const problems = [];
const seenTitle = new Map();
const seenDesc = new Map();
const rows = [];

for (const route of ROUTES) {
  const url = `${BASE}${route}`;
  let res;
  try {
    res = await fetch(url, { redirect: "follow" });
  } catch (e) {
    problems.push(`${route}: fetch failed (${e.message})`);
    continue;
  }
  if (!res.ok) {
    problems.push(`${route}: HTTP ${res.status}`);
    continue;
  }
  const html = await res.text();

  const title = decode(pick(html, /<title[^>]*>([\s\S]*?)<\/title>/i));
  const desc = decode(meta(html, "description"));
  const ogTitle = decode(meta(html, "og:title"));
  const ogDesc = decode(meta(html, "og:description"));
  const ogImage = meta(html, "og:image");
  const canonical = pick(html, /<link[^>]+rel="canonical"[^>]+href="([^"]*)"/i);
  const robots = meta(html, "robots") ?? "";
  const indexable = !/noindex/i.test(robots);
  const h1s = (html.match(/<h1[\s>]/gi) ?? []).length;

  rows.push({ route, title, indexable });

  if (!title) problems.push(`${route}: no <title>`);
  if (!desc) problems.push(`${route}: no meta description`);
  if (h1s !== 1) problems.push(`${route}: expected exactly 1 <h1>, found ${h1s}`);

  // OG must MATCH the page, not inherit the root's (Next merges shallowly).
  if (!ogTitle) problems.push(`${route}: no og:title`);
  else if (ogTitle !== title)
    problems.push(`${route}: og:title != title\n      title=${title}\n      og   =${ogTitle}`);
  if (!ogDesc) problems.push(`${route}: no og:description`);
  else if (desc && ogDesc !== desc)
    problems.push(`${route}: og:description != meta description`);
  if (!ogImage) problems.push(`${route}: no og:image (previews won't be rich)`);
  if (!canonical) problems.push(`${route}: no canonical link`);

  // Uniqueness is only required of pages we actually ask Google to index.
  if (indexable) {
    if (title && seenTitle.has(title))
      problems.push(`DUPLICATE title: ${route} and ${seenTitle.get(title)}\n      "${title}"`);
    else if (title) seenTitle.set(title, route);

    if (desc && seenDesc.has(desc))
      problems.push(`DUPLICATE description: ${route} and ${seenDesc.get(desc)}`);
    else if (desc) seenDesc.set(desc, route);
  }
}

// ── Sitemap consistency ─────────────────────────────────────────────────────
// Listing a noindex URL earns "Submitted URL marked 'noindex'" in Search
// Console; omitting an indexable page means Google may never find it.
let sitemapCount = 0;
try {
  const res = await fetch(`${BASE}/sitemap.xml`);
  if (!res.ok) {
    problems.push(`/sitemap.xml: HTTP ${res.status}`);
  } else {
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    sitemapCount = locs.length;
    if (!locs.length) problems.push("/sitemap.xml: no <loc> entries");

    const hosts = new Set(locs.map((u) => new URL(u).origin));
    if (hosts.size > 1)
      problems.push(`/sitemap.xml: mixed hosts ${[...hosts].join(", ")}`);

    if (new Set(locs).size !== locs.length)
      problems.push("/sitemap.xml: contains duplicate URLs");

    // Every crawled route we know is noindex must NOT be in the sitemap.
    for (const { route, indexable } of rows) {
      const inMap = locs.some((u) => new URL(u).pathname === route);
      if (!indexable && inMap)
        problems.push(`/sitemap.xml lists ${route}, but that page is noindex`);
      if (indexable && !inMap && route !== "/")
        problems.push(`${route} is indexable but missing from /sitemap.xml`);
    }
  }
} catch (e) {
  problems.push(`/sitemap.xml: fetch failed (${e.message})`);
}

console.log(`\nChecked ${rows.length}/${ROUTES.length} routes at ${BASE}`);
console.log(`  sitemap URLs: ${sitemapCount}`);
console.log(`  indexable: ${rows.filter((r) => r.indexable).length}`);
console.log(`  unique titles: ${seenTitle.size} · unique descriptions: ${seenDesc.size}`);

if (problems.length) {
  console.error(`\n${problems.length} PROBLEM(S):`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log("\nAll SEO acceptance checks passed.");
