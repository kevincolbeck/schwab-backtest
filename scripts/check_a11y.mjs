#!/usr/bin/env node
/**
 * Section 7 acceptance checker — "axe scan shows no critical issues".
 *
 * Usage:
 *   node scripts/check_a11y.mjs                      # http://127.0.0.1:3000
 *   node scripts/check_a11y.mjs https://chatbacktest.com
 *
 * Runs axe-core against each page's SERVER-RENDERED HTML in jsdom. Exits
 * non-zero on any critical or serious violation, so it can gate a deploy.
 *
 * WHAT THIS CATCHES, AND WHAT IT DOESN'T — read before trusting a green run:
 *
 * jsdom has no layout engine and does not apply Tailwind's stylesheet, so
 * axe's colour-contrast rule cannot run here and is explicitly disabled. That
 * is NOT a gap: web/src/lib/contrast.test.ts computes every text-token /
 * surface pair from tokens.css directly, in both themes, which is stronger
 * than sampling whatever colours happen to be on screen.
 *
 * Equally, this sees only the first server render — not menus, modals, the
 * command palette, or anything the lab draws after hydration. Those are
 * covered by their own unit-level guarantees and by the keyboard pass in
 * docs/A11Y.md. Treat a green run here as "the markup shipped to every
 * crawler and screen reader is sound", not as "the app is accessible".
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// This script sits at the repo root but its dependencies live in web/, so
// resolution has to be anchored there — ESM resolves from the importing
// FILE's location, not the working directory.
const require = createRequire(new URL("../web/package.json", import.meta.url));
const { JSDOM, VirtualConsole } = require("jsdom");
const AXE_SOURCE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf-8");

const BASE = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/$/, "");

/** One page per template — dynamic routes share code. */
const ROUTES = [
  "/",
  "/playground",
  "/library",
  "/leaderboard",
  "/markets",
  "/pricing",
  "/about",
  "/compare",
  "/compare/tradingview",
  "/blog",
  "/blog/does-the-golden-cross-work",
  "/backtest/golden-cross",
  "/docs",
  "/docs/reading-results",
  "/login",
];

/** Rules that cannot be evaluated without a layout engine or a stylesheet. */
const DISABLED = {
  "color-contrast": { enabled: false }, // see header — contrast.test.ts owns this
  "target-size": { enabled: false }, // needs layout; .tap-target owns this
};

const FAIL_ON = new Set(["critical", "serious"]);

let scanned = 0;
const problems = [];
const noted = [];

for (const route of ROUTES) {
  let html;
  try {
    const res = await fetch(`${BASE}${route}`, { redirect: "follow" });
    if (!res.ok) {
      problems.push(`${route}: HTTP ${res.status}`);
      continue;
    }
    html = await res.text();
  } catch (e) {
    problems.push(`${route}: fetch failed (${e.message})`);
    continue;
  }

  // Silence jsdom's CSS parser — Tailwind v4 syntax it can't parse is noise,
  // not a finding, and it would bury the real output.
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole,
  });

  try {
    dom.window.eval(AXE_SOURCE);
    const results = await dom.window.axe.run(dom.window.document, {
      rules: DISABLED,
      resultTypes: ["violations"],
    });
    scanned += 1;
    for (const v of results.violations) {
      const line = `${route}: [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"})`;
      const sample = v.nodes[0]?.html?.slice(0, 140) ?? "";
      if (FAIL_ON.has(v.impact)) problems.push(`${line}\n      ${sample}`);
      else noted.push(line);
    }
  } catch (e) {
    problems.push(`${route}: axe failed (${e.message})`);
  } finally {
    dom.window.close();
  }
}

console.log(`\nScanned ${scanned}/${ROUTES.length} routes at ${BASE}`);
console.log(`  rules disabled (no layout engine): ${Object.keys(DISABLED).join(", ")}`);
if (noted.length) {
  console.log(`\n  ${noted.length} minor/moderate note${noted.length === 1 ? "" : "s"}:`);
  for (const n of noted) console.log(`    - ${n}`);
}

if (problems.length) {
  console.error(`\n${problems.length} critical/serious issue(s):\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log("\nNo critical or serious axe violations.");
