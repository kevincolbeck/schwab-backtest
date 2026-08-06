import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { STRATEGY_COPY } from "./strategyCopy";

const TEMPLATES = join(__dirname, "..", "..", "..", "templates");

function templateIds(): string[] {
  return readdirSync(TEMPLATES)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => f.replace(/\.json$/, ""));
}

const entries = Object.entries(STRATEGY_COPY);
const proseOf = (c: (typeof entries)[number][1]) =>
  [
    ...c.whatTheNumbersMean,
    c.honestCaveat,
    c.whoItSuits,
    ...c.editsWorthTrying.flatMap((e) => [e.edit, e.why]),
  ].join("\n");

describe("Section 4 strategy copy", () => {
  it("covers every shipped template", () => {
    // A template with no copy gets no page (generateStaticParams reads this
    // registry, not the template list) — so a miss here is a silently missing
    // page, not a broken one. Catch it in CI instead.
    expect(Object.keys(STRATEGY_COPY).sort()).toEqual(templateIds().sort());
  });

  it("meets the spec's >=150 words of unique interpretation", () => {
    for (const [id, c] of entries) {
      const words = c.whatTheNumbersMean.join(" ").split(/\s+/).filter(Boolean).length;
      expect(words, `${id} interpretation is ${words} words`).toBeGreaterThanOrEqual(150);
    }
  });

  it("is actually unique per strategy, not one template stamped 14 times", () => {
    // Google's bar for programmatic pages. Compare first paragraphs pairwise
    // on shared 6-word shingles — near-duplicates are the failure mode.
    const shingles = (s: string) => {
      const w = s.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
      return new Set(Array.from({ length: Math.max(0, w.length - 5) }, (_, i) =>
        w.slice(i, i + 6).join(" "),
      ));
    };
    const sets = entries.map(([id, c]) => [id, shingles(proseOf(c))] as const);
    for (let i = 0; i < sets.length; i++) {
      for (let j = i + 1; j < sets.length; j++) {
        const [idA, a] = sets[i];
        const [idB, b] = sets[j];
        const shared = [...a].filter((s) => b.has(s)).length;
        const overlap = shared / Math.max(1, Math.min(a.size, b.size));
        expect(overlap, `${idA} and ${idB} overlap ${(overlap * 100).toFixed(1)}%`).toBeLessThan(
          0.12,
        );
      }
    }
  });

  // THE TRUTH RULE. Numbers live in the engine-rendered block beside this
  // prose; a figure typed into a sentence here survives the next data refresh
  // and becomes a lie. Rule parameters (an 8% stop, a 20-day lookback) are
  // fixed properties of the spec and are fine — measured OUTCOMES are not.
  it("never hardcodes a performance figure in prose", () => {
    const OUTCOME = /\b\d+(?:\.\d+)?%\s*(?:cagr|return|annual|drawdown|win rate|gain|loss)|\b(?:cagr|sharpe|return|drawdown|win rate)\s+(?:of|was|is|at)\s+-?\d/i;
    const MONEY = /\$\s?\d[\d,]*/;
    for (const [id, c] of entries) {
      const prose = proseOf(c);
      expect(prose, `${id} states an outcome figure`).not.toMatch(OUTCOME);
      expect(prose, `${id} states a dollar figure`).not.toMatch(MONEY);
    }
  });

  it("carries no buy/sell advice, prediction or hype vocabulary", () => {
    const BANNED =
      /\b(autopilot|guaranteed|risk-?free|get rich|you should buy|you should sell|will (?:win|profit|beat|continue)|sure thing|can't lose|hurry|act now|limited time)\b/i;
    for (const [id, c] of entries) {
      expect(proseOf(c), `${id} banned vocabulary`).not.toMatch(BANNED);
    }
  });

  it("gives every strategy a caveat and exactly three edits", () => {
    for (const [id, c] of entries) {
      expect(c.honestCaveat.split(/\s+/).length, `${id} caveat too thin`).toBeGreaterThan(20);
      expect(c.editsWorthTrying.length, `${id} edits`).toBe(3);
      for (const e of c.editsWorthTrying) {
        expect(e.edit.length, `${id} edit too short`).toBeGreaterThan(15);
        expect(e.why.length, `${id} rationale too short`).toBeGreaterThan(25);
      }
      expect(c.whoItSuits.length, `${id} whoItSuits`).toBeGreaterThan(40);
    }
  });
});
