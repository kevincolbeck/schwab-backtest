/** Blog registry (P1-1) — pure data, no components, so vitest can pin its
 * invariants without a JSX pipeline. Article BODIES live in
 * web/src/components/blog/articles/ and are mapped to slugs in the
 * /blog/[slug] route; generateStaticParams + dynamicParams:false means a
 * registry entry without a body component fails the BUILD, not a visitor.
 *
 * Internal-linking rule (spec §P1-1): every article links (a) its template in
 * the lab, (b) exactly two sibling articles, (c) the leaderboard. The article
 * layout renders (b) and (c) from this registry; (a) renders wherever
 * `templateId` is set, via the live TemplateStatsBlock.
 *
 * Truth rule carried over from the rest of the site: articles NEVER hardcode
 * performance numbers in prose — every stat renders live from the engine's
 * template stats, so a data refresh can't strand stale claims in an article.
 */

export const BLOG_CATEGORIES = [
  {
    slug: "strategy-tests",
    name: "Strategy Tests",
    tagline:
      "Famous setups from trading Twitter and YouTube, run through a real engine on decades of data — winners and losers published alike.",
  },
  {
    slug: "how-to",
    name: "How-To",
    tagline:
      "Using the lab well: building strategies in plain English, reading results honestly, and avoiding the classic backtesting traps.",
  },
  {
    slug: "behind-the-ledger",
    name: "Behind the Ledger",
    tagline:
      "Why forward testing is the only unfakeable proof — and what our own public track records are teaching us.",
  },
  {
    slug: "market-data-deep-dives",
    name: "Market Data Deep-Dives",
    tagline:
      "Questions you can only answer with a lot of bars: seasonality, pullbacks, breadth, and what the data actually supports.",
  },
] as const;

export type BlogCategorySlug = (typeof BLOG_CATEGORIES)[number]["slug"];

export interface BlogPost {
  slug: string;
  title: string;
  /** Meta description — also the index-card teaser. Keep ≤ 160 chars. */
  description: string;
  category: BlogCategorySlug;
  /** The search phrase this article exists to answer (spec §P1-1 briefs). */
  targetKeyword: string;
  publishedAt: string; // ISO date
  /** Library template id — set when the article tests a shipped strategy;
   * renders the live stats block + "open in the lab" CTA. */
  templateId?: string;
  /** Exactly two sibling slugs (spec's internal-linking rule). */
  siblings: [string, string];
  readingMinutes: number;
}

export const BLOG_POSTS: readonly BlogPost[] = [
  {
    slug: "does-the-golden-cross-work",
    title: "Does the Golden Cross actually work? We backtested 10 years",
    description:
      "The 50/200-day moving-average cross is the most famous signal in retail trading. We ran it through a real engine on a decade of daily bars — live results inside.",
    category: "strategy-tests",
    targetKeyword: "does the golden cross work",
    publishedAt: "2026-08-05",
    templateId: "golden-cross",
    // The no-code guide's inbound link lives here — the flagship article is
    // the right patron for it (review: every post needs ≥1 inbound sibling).
    siblings: ["macd-strategy-backtest", "how-to-backtest-a-trading-strategy-without-code"],
    readingMinutes: 7,
  },
  {
    slug: "macd-strategy-backtest",
    title: "MACD crossover strategy: a decade of results, no cherry-picking",
    description:
      "Every MACD tutorial shows the same three perfect trades. We backtested the crossover on a decade of daily bars instead — here's what the full record looks like.",
    category: "strategy-tests",
    targetKeyword: "macd strategy backtest",
    publishedAt: "2026-08-05",
    templateId: "macd-trend",
    siblings: ["does-the-golden-cross-work", "donchian-breakout-strategy"],
    readingMinutes: 7,
  },
  {
    slug: "donchian-breakout-strategy",
    title: "Donchian channel breakout on megacaps: the full backtest",
    description:
      "Buy 20-day highs, exit 10-day lows — the rule set behind the Turtles, applied to today's largest stocks. Live backtest results, drawdowns included.",
    category: "strategy-tests",
    targetKeyword: "donchian breakout strategy",
    publishedAt: "2026-08-05",
    templateId: "donchian-breakout",
    siblings: ["macd-strategy-backtest", "does-the-golden-cross-work"],
    readingMinutes: 6,
  },
  {
    slug: "vwap-strategy-backtest",
    title: "VWAP reversion intraday: the backtest that lost — published anyway",
    description:
      "We backtested a 15-minute VWAP reversion strategy and it lost. We published it anyway and put it on our live forward-test ledger. Here's the whole record.",
    category: "behind-the-ledger",
    targetKeyword: "vwap strategy backtest",
    publishedAt: "2026-08-05",
    templateId: "vwap-reversion-15m",
    siblings: ["backtest-vs-forward-test", "donchian-breakout-strategy"],
    readingMinutes: 6,
  },
  {
    slug: "backtest-vs-forward-test",
    title: "Backtest vs forward test: why edges disappear when they go live",
    description:
      "A backtest can be accidentally (or deliberately) flattering. A forward test on frozen rules can't. The difference explains most vanishing edges.",
    category: "behind-the-ledger",
    targetKeyword: "backtest vs forward test",
    publishedAt: "2026-08-05",
    siblings: ["vwap-strategy-backtest", "does-the-golden-cross-work"],
    readingMinutes: 8,
  },
  {
    slug: "how-to-backtest-a-trading-strategy-without-code",
    title: "How to backtest a trading strategy without writing code",
    description:
      "A practical walkthrough: turning a setup you saw online into exact rules, running it on 20 years of data, and reading the results without fooling yourself.",
    category: "how-to",
    targetKeyword: "backtest strategy no code",
    publishedAt: "2026-08-05",
    siblings: ["does-the-golden-cross-work", "backtest-vs-forward-test"],
    readingMinutes: 8,
  },
] as const;

export function postBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function postsInCategory(category: BlogCategorySlug): BlogPost[] {
  return BLOG_POSTS.filter((p) => p.category === category);
}

export function categoryBySlug(slug: string) {
  return BLOG_CATEGORIES.find((c) => c.slug === slug);
}

/** Library backlink (spec: "every template page links back to its article"). */
export function postForTemplate(templateId: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.templateId === templateId);
}
