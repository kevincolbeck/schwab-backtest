import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Next 16's JSX transform DROPS the whitespace between a closing inline tag
 *  and the text that follows it, so this source:
 *
 *      <strong>Entry:</strong> buy on the day the 50-day crosses
 *
 *  renders as "Entry:buy on the day…". It shipped that way across the blog and
 *  every /docs page before it was caught — 125 sites, all of them user-visible
 *  prose. Babel preserved that space, which is why it reads as correct and why
 *  it will keep getting reintroduced by anyone writing JSX from memory.
 *
 *  The immune form is an explicit `{" "}`, which is a separate expression the
 *  transform can't fold away. This test is the guard: whitespace between a
 *  closing inline tag and following text is a bug, so fail the build on it.
 *
 *  Block-level tags (</p>, </li>, </div>) are exempt — they force a line box,
 *  so a missing space between them is invisible.
 */

const INLINE = "strong|em|a|code|span|b|i|abbr|small|sup|sub|mark|Link";
const GLUE = new RegExp(`</(?:${INLINE})>\\s+(?=[A-Za-z0-9$])`, "g");

const SRC = join(__dirname, "..");

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) tsxFiles(p, out);
    else if (entry.endsWith(".tsx")) out.push(p);
  }
  return out;
}

describe("JSX inline spacing", () => {
  it("never relies on the transform preserving space after a closing inline tag", () => {
    const offenders: string[] = [];
    for (const file of tsxFiles(SRC)) {
      const text = readFileSync(file, "utf-8");
      for (const m of text.matchAll(GLUE)) {
        const line = text.slice(0, m.index).split("\n").length;
        const rel = file.slice(SRC.length + 1).replace(/\\/g, "/");
        offenders.push(`${rel}:${line} — ${m[0].trim()} … use {" "} instead`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
