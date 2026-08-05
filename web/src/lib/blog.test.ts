import { describe, expect, it } from "vitest";
import {
  BLOG_CATEGORIES,
  BLOG_POSTS,
  postBySlug,
  postForTemplate,
} from "./blog";

// The 14 shipped template ids (templates/*.json). If a template is renamed,
// this list and any article pointing at it must move together.
const TEMPLATE_IDS = [
  "52-week-high",
  "bollinger-reversion",
  "buy-the-dip",
  "donchian-breakout",
  "dual-momentum",
  "golden-cross",
  "macd-trend",
  "minervini-trend",
  "qullamaggie-breakout",
  "range-breakout-15m",
  "rsi2-mean-reversion",
  "sell-in-may",
  "turtle-breakout",
  "vwap-reversion-15m",
];

describe("blog registry", () => {
  it("has unique slugs and titles", () => {
    const slugs = BLOG_POSTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const titles = BLOG_POSTS.map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("ships at least the 6 launch articles (P1-1 acceptance)", () => {
    expect(BLOG_POSTS.length).toBeGreaterThanOrEqual(6);
  });

  it("uses only registered categories, and slugs are URL-safe", () => {
    const cats = new Set(BLOG_CATEGORIES.map((c) => c.slug));
    for (const p of BLOG_POSTS) {
      expect(cats.has(p.category)).toBe(true);
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("every article has exactly two existing, distinct, non-self siblings", () => {
    for (const p of BLOG_POSTS) {
      expect(p.siblings).toHaveLength(2);
      const [a, b] = p.siblings;
      expect(a).not.toBe(b);
      for (const s of p.siblings) {
        expect(s).not.toBe(p.slug);
        expect(postBySlug(s), `${p.slug} → missing sibling ${s}`).toBeDefined();
      }
    }
  });

  it("no article is an orphan — every post has ≥1 inbound sibling link", () => {
    const inbound = new Map<string, number>();
    for (const p of BLOG_POSTS) {
      for (const s of p.siblings) inbound.set(s, (inbound.get(s) ?? 0) + 1);
    }
    for (const p of BLOG_POSTS) {
      expect(inbound.get(p.slug) ?? 0, `${p.slug} has no inbound links`).toBeGreaterThan(0);
    }
  });

  it("template links point at real templates, one article per template max", () => {
    const seen = new Set<string>();
    for (const p of BLOG_POSTS) {
      if (!p.templateId) continue;
      expect(TEMPLATE_IDS, `${p.slug} → unknown template ${p.templateId}`).toContain(
        p.templateId,
      );
      expect(seen.has(p.templateId), `duplicate article for ${p.templateId}`).toBe(false);
      seen.add(p.templateId);
      expect(postForTemplate(p.templateId)?.slug).toBe(p.slug);
    }
  });

  it("descriptions fit a meta tag and dates parse", () => {
    for (const p of BLOG_POSTS) {
      expect(p.description.length, p.slug).toBeLessThanOrEqual(170);
      expect(p.description.length, p.slug).toBeGreaterThanOrEqual(70);
      expect(Number.isFinite(Date.parse(p.publishedAt)), p.slug).toBe(true);
      expect(p.targetKeyword.length).toBeGreaterThan(0);
      expect(p.readingMinutes).toBeGreaterThan(0);
    }
  });
});
