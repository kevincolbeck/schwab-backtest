import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pageMetadata } from "./seo";

/* Guards the P1-2 invariant that a crawler CANNOT check.
 *
 * Next merges metadata shallowly, so any hand-rolled `return { title, ... }`
 * inside generateMetadata inherits the ROOT's whole openGraph block — the
 * page's social preview silently shows the homepage's title, and its
 * canonical points at "/". A crawl only catches this on the branch that
 * happens to run: three such bugs shipped in early-return branches
 * (stocks "not_found"/"unavailable", strategy not-found) that only fire when
 * the backend degrades. So we assert it statically instead. */

const APP = join(process.cwd(), "src", "app");

function pageFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) pageFiles(full, out);
    else if (entry === "page.tsx" || entry === "layout.tsx") out.push(full);
  }
  return out;
}

describe("metadata never bypasses pageMetadata()", () => {
  it("has no hand-rolled metadata object literals", () => {
    const offenders: string[] = [];
    for (const file of pageFiles(APP)) {
      const src = readFileSync(file, "utf8");
      if (!/export (const metadata|async function generateMetadata)/.test(src)) continue;

      // `return { ... title: ... }` / `= { ... title: ... }` without nested
      // braces — the exact shape of a bypass. pageMetadata({...}) never matches.
      const bypass = /(?:return|=)\s*\{[^{}]*\btitle\s*:/g;
      if (bypass.test(src)) {
        offenders.push(file.replace(process.cwd(), "").replace(/\\/g, "/"));
      }
    }
    expect(
      offenders,
      `These build metadata by hand and will inherit the root's openGraph ` +
        `block (homepage og:title) plus the root canonical. Route them ` +
        `through pageMetadata() from @/lib/seo:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("every metadata-exporting route imports the helper", () => {
    const missing: string[] = [];
    for (const file of pageFiles(APP)) {
      const src = readFileSync(file, "utf8");
      if (!/export (const metadata|async function generateMetadata)/.test(src)) continue;
      if (!src.includes("@/lib/seo")) {
        missing.push(file.replace(process.cwd(), "").replace(/\\/g, "/"));
      }
    }
    expect(missing, `Missing pageMetadata() import:\n  ${missing.join("\n  ")}`).toEqual([]);
  });
});

describe("pageMetadata output", () => {
  const md = pageMetadata({
    title: "T",
    description: "D",
    path: "/x",
  });

  it("keeps title, og:title and twitter:title identical", () => {
    expect(md.title).toBe("T");
    expect(md.openGraph?.title).toBe("T");
    expect(md.twitter?.title).toBe("T");
  });

  it("keeps description consistent across all three", () => {
    expect(md.description).toBe("D");
    expect(md.openGraph?.description).toBe("D");
    expect(md.twitter?.description).toBe("D");
  });

  it("sets a canonical and the default social card", () => {
    expect(md.alternates?.canonical).toBe("/x");
    expect(md.openGraph).toHaveProperty("images");
  });

  it("omits images when a route supplies its own OG card", () => {
    const own = pageMetadata({ title: "T", description: "D", path: "/x", ogImage: null });
    expect(own.openGraph).not.toHaveProperty("images");
  });

  it("marks noIndex routes as such", () => {
    const priv = pageMetadata({ title: "T", description: "D", path: "/x", noIndex: true });
    expect(priv.robots).toEqual({ index: false, follow: false });
    expect(md.robots).toBeUndefined();
  });
});
