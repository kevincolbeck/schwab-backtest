import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** WCAG 2.1 AA contrast, recomputed from tokens.css itself (Section 7).
 *
 *  This is a real audit, not a rubber stamp: before it existed, `--faint`
 *  sat at 4.1:1 on the canvas and 3.4:1 on control fills while carrying
 *  captions, timestamps and legal text across the whole site, and the light
 *  theme's `--accent`, `--warn` and `--prev-run` all failed on three of the
 *  four surfaces. Section 7's checklist asked for exactly this audit.
 *
 *  Parsing the CSS rather than hardcoding a table is the point — a future
 *  "just a touch dimmer" tweak to a token fails here instead of shipping.
 */

const CSS = readFileSync(join(__dirname, "..", "styles", "tokens.css"), "utf-8");

function block(selector: string): Record<string, string> {
  const i = CSS.indexOf(selector);
  if (i === -1) throw new Error(`missing block: ${selector}`);
  const open = CSS.indexOf("{", i);
  // Token blocks contain no nested braces, so the next } closes it.
  const close = CSS.indexOf("}", open);
  const out: Record<string, string> = {};
  for (const m of CSS.slice(open, close).matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

const dark = block(":root");
const light = { ...dark, ...block('[data-theme="light"]') };

function luminance(hex: string): number {
  const v = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

export function contrast(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Tokens used for TEXT. These need 4.5:1. */
const TEXT_TOKENS = [
  "--ink",
  "--muted",
  "--faint",
  "--accent",
  "--gain",
  "--loss",
  "--warn",
  "--prev-run",
];

/** Surfaces text is rendered on. bg-3 is a control fill, but labels sit on
 *  controls, so it counts. */
const SURFACES = ["--bg-0", "--bg-1", "--bg-2", "--bg-3"];

/** Data-visualisation colours: WCAG's bar for non-text graphical objects is
 *  3:1, not 4.5:1. Held to that, and no lower. */
const GRAPHIC_TOKENS = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--accent-2"];

describe.each([
  ["dark", dark],
  ["light", light],
])("%s theme contrast", (themeName, theme) => {
  it("has every token the audit depends on", () => {
    for (const t of [...TEXT_TOKENS, ...GRAPHIC_TOKENS, ...SURFACES]) {
      expect(theme[t], `${themeName} is missing ${t}`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("clears AA (4.5:1) for text on every surface", () => {
    const failures: string[] = [];
    for (const fg of TEXT_TOKENS) {
      for (const bg of SURFACES) {
        const r = contrast(theme[fg], theme[bg]);
        if (r < 4.5) {
          failures.push(`${themeName}: ${fg} (${theme[fg]}) on ${bg} = ${r.toFixed(2)}:1`);
        }
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("clears 3:1 for chart colours on every surface", () => {
    const failures: string[] = [];
    for (const fg of GRAPHIC_TOKENS) {
      for (const bg of SURFACES) {
        const r = contrast(theme[fg], theme[bg]);
        if (r < 3) {
          failures.push(`${themeName}: ${fg} (${theme[fg]}) on ${bg} = ${r.toFixed(2)}:1`);
        }
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("separates gain and loss by HUE, not by brightness", () => {
    // Their luminance is deliberately close (~1.1:1) so neither shouts louder
    // than the other in a table of numbers — that is correct, and it means a
    // luminance-contrast check is the wrong instrument here. What has to hold
    // is hue separation, and red-vs-teal survives the common red/green
    // deficiencies in a way red-vs-green would not.
    //
    // Note this is a backstop, not the accessibility guarantee: colour is
    // never the only signal on this site (gain/loss and verified/hypothetical
    // both carry a glyph and a word). See EvidenceMarks.
    const hue = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max === min) return 0;
      const d = max - min;
      const h =
        max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return ((h * 60) % 360 + 360) % 360;
    };
    const diff = Math.abs(hue(theme["--gain"]) - hue(theme["--loss"]));
    const separation = Math.min(diff, 360 - diff);
    expect(separation, `gain/loss are only ${separation.toFixed(0)}° apart`).toBeGreaterThan(
      90,
    );
  });
});

describe("chartTokens fallback", () => {
  it("mirrors the dark theme, as its comment promises", () => {
    // These render before first paint and in non-DOM environments, so a drift
    // here ships colours that exist nowhere in the design system.
    const ts = readFileSync(
      join(__dirname, "..", "components", "chartTokens.ts"),
      "utf-8",
    );
    const fallback = ts.slice(ts.indexOf("const FALLBACK"));
    for (const [token, key] of [
      ["--accent", "accent"],
      ["--gain", "gain"],
      ["--loss", "loss"],
      ["--muted", "muted"],
      ["--prev-run", "prev"],
    ] as const) {
      const m = fallback.match(new RegExp(`${key}:\\s*"(#[0-9a-fA-F]{6})"`));
      expect(m?.[1]?.toLowerCase(), `FALLBACK.${key} drifted from ${token}`).toBe(
        dark[token].toLowerCase(),
      );
    }
  });
});
