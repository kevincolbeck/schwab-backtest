import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/** robots.txt (P1-2 follow-up, per Google's crawling docs).
 *
 * Deliberately does NOT disallow /login /account /dashboard /admin /runs/ /s/.
 * Those carry `noindex` via pageMetadata(), and a robots block would stop
 * Google from ever READING that directive — leaving them as URL-only entries
 * in the index instead of properly excluded.
 *
 * The param disallows target crawl budget, not duplicates: filter/deep-link
 * URLs (?category=, ?template=, ?sort=, ?run=) already self-canonicalise, but
 * they are unbounded — an unknown value still returns 200 — and this domain
 * has no crawl history to spend on them.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/", "/*?category=", "/*?template=", "/*?sort=", "/*?run="],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    // No `host:` — it is a Yandex directive Google ignores, and Next renders
    // it as a full URL where the spec wants a bare hostname.
  };
}
