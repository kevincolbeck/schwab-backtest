import { describe, expect, it } from "vitest";
import {
  COMPARE_AXES,
  COMPETITORS,
  LEDGER_SECTION,
  US_BY_AXIS,
  competitorBySlug,
} from "./compare";

/** These tests exist because comparison pages rot in one specific direction:
 *  toward flattering us. The spec's requirement is "factual and neutral in
 *  tone — differences, not disparagement", and that is not something a code
 *  review catches six months from now when someone adds a seventh competitor.
 */

describe("comparison registry", () => {
  it("meets the spec's acceptance criterion of at least five pages", () => {
    expect(COMPETITORS.length).toBeGreaterThanOrEqual(5);
  });

  it("has unique slugs, and each resolves", () => {
    const slugs = COMPETITORS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(competitorBySlug(s)?.slug).toBe(s);
  });

  it("gives every page a unique title-worthy name and description", () => {
    const names = COMPETITORS.map((c) => c.name);
    const descs = COMPETITORS.map((c) => c.description);
    expect(new Set(names).size).toBe(names.length);
    // Duplicate meta descriptions are the single most common way a set of
    // near-identical pages gets treated as thin content.
    expect(new Set(descs).size).toBe(descs.length);
  });

  it("keeps descriptions inside the ~160 char meta budget", () => {
    for (const c of COMPETITORS) {
      expect(c.description.length, `${c.slug} description`).toBeLessThanOrEqual(165);
    }
  });

  // RULE 1 — identical axes everywhere. Dropping the row you lose is the
  // easiest and least visible way to make one of these pages dishonest.
  it("uses the SAME axes, in the same order, on every page", () => {
    for (const c of COMPETITORS) {
      expect(c.rows.map((r) => r.axis), `${c.slug} axes`).toEqual([
        ...COMPARE_AXES,
      ]);
    }
  });

  it("covers every axis in the shared US_BY_AXIS copy", () => {
    for (const axis of COMPARE_AXES) {
      expect(US_BY_AXIS[axis], `US_BY_AXIS[${axis}]`).toBeTruthy();
    }
  });

  // RULE 2 — every page must concede something real.
  it("names things each competitor does better than us", () => {
    for (const c of COMPETITORS) {
      expect(c.theirAdvantages.length, `${c.slug} theirAdvantages`).toBeGreaterThan(0);
      for (const a of c.theirAdvantages) {
        expect(a.length, `${c.slug} advantage too short to be real`).toBeGreaterThan(30);
      }
    }
  });

  it("keeps the Markets & data row conceding that we lose it", () => {
    // The one row we lose to all six. If someone ever softens this, the whole
    // table stops being credible — so pin the concession, not just the row.
    expect(US_BY_AXIS["Markets & data"].toLowerCase()).toMatch(
      /narrowest|beats us|lose/,
    );
  });

  // RULE 3 — sourcing.
  it("cites a vendor URL for every competitor claim", () => {
    for (const c of COMPETITORS) {
      expect(c.site).toMatch(/^https:\/\//);
      expect(c.pricingSourceUrl, `${c.slug} pricingSourceUrl`).toMatch(/^https:\/\//);
      for (const r of c.rows) {
        expect(r.sourceUrl, `${c.slug} / ${r.axis} has no source`).toMatch(
          /^https:\/\//,
        );
      }
    }
  });

  it("records when each competitor's pages were last read", () => {
    for (const c of COMPETITORS) {
      expect(c.checkedOn, `${c.slug} checkedOn`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(c.checkedOn))).toBe(false);
    }
  });

  it("lists real pricing tiers for every competitor", () => {
    for (const c of COMPETITORS) {
      expect(c.pricing.length, `${c.slug} pricing`).toBeGreaterThan(0);
    }
  });

  // Compliance — CLAUDE.md's non-negotiables and the anti-sleaze ban list.
  // These pages are the most marketing-adjacent surface on the site, which is
  // exactly where that vocabulary creeps back in.
  it("never uses banned or advice-flavoured vocabulary in our own voice", () => {
    const BANNED =
      /\b(autopilot|guaranteed|risk-?free|will (?:win|profit|beat)|get rich|hurry|act now|limited time)\b/i;
    const ourVoice: string[] = [
      ...Object.values(US_BY_AXIS),
      ...LEDGER_SECTION.body,
      LEDGER_SECTION.heading,
      ...COMPETITORS.flatMap((c) => [c.description, c.pickUsIf, c.pickThemIf]),
    ];
    for (const s of ourVoice) {
      expect(s, `banned vocabulary: ${s.slice(0, 70)}`).not.toMatch(BANNED);
    }
  });

  it("never overstates the ledger as audited or third-party verified", () => {
    // It is our own append-only database with a spec hash. "Verified" in the
    // product means "has enough live days", not "attested by anyone".
    const OVERCLAIM = /\b(audited|independently verified|third-party (?:verified|attested)|notarized)\b/i;
    for (const s of [...LEDGER_SECTION.body, US_BY_AXIS["Public track record"]]) {
      expect(s, `ledger overclaim: ${s.slice(0, 70)}`).not.toMatch(OVERCLAIM);
    }
  });

  it("does not claim we are the only platform that freezes rules", () => {
    // TrendSpider locks a strategy when you create a bot — confirmed on their
    // own docs, and conceded on their page. Any "only we do this" phrasing is
    // factually wrong and checkable in one click.
    const ONLY = /\bonly (?:platform|product|place|one|tool)\b/i;
    for (const s of [...LEDGER_SECTION.body, ...Object.values(US_BY_AXIS)]) {
      expect(s, `uniqueness overclaim: ${s.slice(0, 70)}`).not.toMatch(ONLY);
    }
    const ts = competitorBySlug("trendspider");
    expect(ts).toBeDefined();
    expect(
      ts!.theirAdvantages.some((a) => /clone and lock|freezes forward tests/i.test(a)),
      "TrendSpider's own freeze must stay conceded on its page",
    ).toBe(true);
  });
});
