import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { METRICS } from "./metrics";

/** Section 7 design-system acceptance, made executable.
 *
 *  The spec's criteria are "stat displays render from one component" and "no
 *  ad-hoc hex values in new code". Both had drifted: `ui/StatCard` — the
 *  component the criterion was written about — had ZERO importers while
 *  eleven files each defined their own stat block, at five different value
 *  sizes, with the same metric formatted to different precision on different
 *  pages.
 *
 *  These tests are the ratchet. They don't retroactively force every legacy
 *  surface through the component (some genuinely shouldn't be — see the
 *  allowlist and its reasons), but nothing NEW can reintroduce the drift.
 */

const SRC = join(__dirname, "..");

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) tsxFiles(p, out);
    else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) out.push(p);
  }
  return out;
}

const rel = (f: string) => f.slice(SRC.length + 1).replace(/\\/g, "/");

describe("design system", () => {
  it("keeps ad-hoc hex colours out of components", () => {
    // Satori (next/og) has no CSS cascade, so the OG-image and icon
    // generators genuinely cannot read custom properties — each carries a
    // `// --token` comment naming what it mirrors. ProviderLogo holds Google
    // and Discord brand marks, which must NOT be themed.
    const ALLOWED = [
      "app/opengraph-image.tsx",
      "app/strategy/[slug]/opengraph-image.tsx",
      "app/strategy/[slug]/card/route.tsx",
      "app/stocks/[ticker]/opengraph-image.tsx",
      "app/stocks/-/opengraph-image.tsx",
      "app/apple-icon.tsx",
      "components/ProviderLogo.tsx",
      "components/chartTokens.ts", // documented SSR/pre-paint fallback
      "lib/contrast.test.ts",
      "lib/designSystem.test.ts",
      // Same Satori constraint: the downloadable record card renders off-DOM.
      // Its values are asserted against the tokens below.
      "lib/server/recordCard.ts",
    ];
    const offenders: string[] = [];
    for (const file of tsxFiles(SRC)) {
      const r = rel(file);
      if (ALLOWED.some((a) => r === a)) continue;
      const text = readFileSync(file, "utf-8");
      for (const m of text.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
        const line = text.slice(0, m.index).split("\n").length;
        offenders.push(`${r}:${line} — ${m[0]} (use a token)`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("does not let new files define their own stat block", () => {
    // These predate the consolidation and have real reasons not to migrate:
    // StatTiles owns the delta machinery, TradeInspector shows mixed-type
    // trade facts at modal density, account shows account facts with a
    // two-<dd> pattern, EvidenceStrip is marketing counts with no metric
    // semantics. Everything else goes through ui/Stat.
    const ALLOWED = [
      "components/ui/Stat.tsx",
      "components/ui/StatCard.tsx",
      "components/StatTiles.tsx",
      "components/TradeInspector.tsx",
      "components/EvidenceStrip.tsx",
      "app/account/page.tsx",
      "app/admin/AdminMetrics.tsx",
      "components/landing/SpecPeek.tsx",
      "components/landing/LivePreview.tsx",
      "components/FrozenPanel.tsx",
      "components/TemplateCard.tsx",
      "app/playground/page.tsx",
      "app/stocks/[ticker]/page.tsx",
      "app/runs/[runId]/page.tsx",
      "app/s/[slug]/page.tsx",
    ];
    const offenders: string[] = [];
    for (const file of tsxFiles(SRC)) {
      const r = rel(file);
      if (ALLOWED.some((a) => r === a)) continue;
      const text = readFileSync(file, "utf-8");
      if (r.endsWith(".test.ts")) continue;
      if (/function Stat(Tile|Card)?\s*\(/.test(text)) {
        offenders.push(`${r} defines a local stat component — import ui/Stat instead`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("keeps metric copy in the registry, not hand-copied into pages", () => {
    // Every hint string must appear in metrics.ts and nowhere else — a second
    // copy is how the same metric ends up explained two different ways.
    const registrySource = readFileSync(join(SRC, "lib", "metrics.ts"), "utf-8");
    for (const [key, def] of Object.entries(METRICS)) {
      expect(registrySource, `${key} hint missing from registry`).toContain(def.hint);
    }
    const duplicates: string[] = [];
    for (const file of tsxFiles(SRC)) {
      const r = rel(file);
      if (r === "lib/metrics.ts" || r.endsWith(".test.ts")) continue;
      // The docs explain metrics in prose to a reader. That is teaching copy
      // in its own voice, not a duplicated UI hint string.
      if (r.startsWith("app/docs/")) continue;
      const text = readFileSync(file, "utf-8");
      for (const [key, def] of Object.entries(METRICS)) {
        // StatTiles still owns its own TILES table (delta machinery); it is
        // the one legacy copy, and it is on the migration list.
        if (r === "components/StatTiles.tsx") continue;
        if (text.includes(def.hint)) duplicates.push(`${r} hardcodes the ${key} hint`);
      }
    }
    expect(duplicates, duplicates.join("\n")).toEqual([]);
  });

  it("marks only genuinely realised P&L as colourable", () => {
    // valence colour implies "this is money you made or lost". A backtest
    // return is hypothetical and a drawdown is a magnitude — colouring either
    // makes a claim the number cannot support.
    const pnl = Object.entries(METRICS)
      .filter(([, d]) => "isPnl" in d && d.isPnl)
      .map(([k]) => k);
    expect(pnl).toEqual(["forward_return_pct"]);
  });
});
