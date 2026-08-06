import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { humanizeExpression, plainRules } from "./plainRules";
import type { Spec } from "./types";

const TEMPLATES = join(__dirname, "..", "..", "..", "templates");

function loadSpec(id: string): Spec {
  return JSON.parse(readFileSync(join(TEMPLATES, `${id}.json`), "utf-8")).spec;
}

function allTemplateIds(): string[] {
  return readdirSync(TEMPLATES)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => f.replace(/\.json$/, ""));
}

describe("plain-English rules", () => {
  it("names indicators rather than leaking their variable names", () => {
    const spec = loadSpec("golden-cross");
    const rules = plainRules(spec);
    const entry = rules.find((r) => r.label === "Entry")!;
    expect(entry.text).toContain("50-day average");
    expect(entry.text).toContain("200-day average");
    // The raw spec identifiers must not survive into prose a trader reads.
    expect(entry.text).not.toContain("sma_50");
    expect(entry.text).not.toContain("sma_200");
  });

  it("turns operators into words", () => {
    const spec = loadSpec("golden-cross");
    const text = humanizeExpression(String(spec.entry_rule_long), spec);
    expect(text).toContain("is above");
    expect(text).not.toMatch(/[<>&|]/);
  });

  it("renders lag() as an in-the-past phrase", () => {
    const spec = loadSpec("golden-cross");
    const text = humanizeExpression("lag(sma_50, 1) <= lag(sma_200, 1)", spec);
    expect(text).toContain("bar(s) ago");
    expect(text).not.toContain("lag(");
  });

  it("collects stop, target and time exits into one sentence", () => {
    const spec: Spec = {
      name: "t",
      symbols: ["AAPL"],
      indicators: [],
      entry_rule_long: "close > 1",
      exit_rule: "close < 1",
      stop_loss_pct: 8,
      take_profit_pct: 5,
      max_holding_days: 10,
    };
    const exit = plainRules(spec).find((r) => r.label === "Exit")!;
    expect(exit.text).toContain("8% stop-loss");
    expect(exit.text).toContain("5% profit target");
    expect(exit.text).toContain("10 bars");
    expect(exit.text).toContain("whichever comes first");
  });

  it("says out loud when a strategy has no protective exit", () => {
    // A reader deciding whether to trade this needs to know there is no stop.
    // Silence would read as "not applicable" rather than "there isn't one".
    const spec = loadSpec("golden-cross");
    const rules = plainRules(spec);
    expect(rules.some((r) => r.label === "No stop")).toBe(true);
  });

  it("produces usable rules for every shipped template", () => {
    for (const id of allTemplateIds()) {
      const rules = plainRules(loadSpec(id));
      expect(rules.length, `${id} produced no rules`).toBeGreaterThanOrEqual(3);
      for (const r of rules) {
        expect(r.text.length, `${id} / ${r.label} too short`).toBeGreaterThan(10);
        // Nothing may leak raw expression syntax into the reader's sentence.
        expect(r.text, `${id} / ${r.label} leaked syntax`).not.toMatch(/lag\(|&|\|\|/);
      }
      expect(rules.some((r) => r.label === "Universe")).toBe(true);
      expect(rules.some((r) => r.label === "Exit")).toBe(true);
    }
  });
});
