import type { Metadata } from "next";

/** Per-page SEO (P1-2) — one builder so every page's <title>, og:title and
 *  twitter:title are the same string by construction.
 *
 *  Why a helper rather than hand-written metadata per page: Next merges
 *  metadata *shallowly* across segments. A page that sets `title` but not
 *  `openGraph` inherits the ROOT's entire openGraph block — so its social
 *  preview would show the homepage's title. Routing everything through
 *  pageMetadata() makes that class of drift impossible, and keeps the
 *  uniqueness requirement ("no two pages share a title or description")
 *  auditable from one place.
 *
 *  Titles here are FINAL strings — there is deliberately no title.template at
 *  the root, because docs/CHATBACKTEST-BUILD.md §P1-2 specifies exact titles
 *  for the primary pages and a template would append a suffix to them.
 */

export const SITE_NAME = "Chat·Backtest";

/** Canonical origin. Mirrors the root layout's metadataBase. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://chatbacktest.com";

export interface PageSeo {
  /** The exact <title>. Include the brand yourself where it belongs. */
  title: string;
  /** Unique, ≤ ~160 chars, describes THIS page — never boilerplate. */
  description: string;
  /** Route path for the canonical URL, e.g. "/leaderboard". */
  path: string;
  /** "article" for blog posts; defaults to "website". */
  type?: "website" | "article";
  /** ISO date — only meaningful for articles. */
  publishedTime?: string;
  /** Extra keywords; the target search phrase for content pages. */
  keywords?: string[];
  /** Keep a page out of the index (operator surfaces, user-private views). */
  noIndex?: boolean;
  /**
   * Social card. Defaults to the site-wide card at /opengraph-image.
   *
   * Pass `null` on routes that ship their OWN `opengraph-image.tsx` (the
   * strategy record cards, the stock cards) — omitting `images` here lets
   * that segment's file convention supply the data-driven image instead.
   * This is load-bearing: because Next merges metadata shallowly, setting
   * `openGraph` at all replaces the parent's block, which is why the
   * site-wide card does NOT reach child routes on its own.
   */
  ogImage?: string | null;
}

/** Site-wide social card (app/opengraph-image.tsx). */
export const DEFAULT_OG_IMAGE = "/opengraph-image";

export function pageMetadata({
  title,
  description,
  path,
  type = "website",
  publishedTime,
  keywords,
  noIndex,
  ogImage = DEFAULT_OG_IMAGE,
}: PageSeo): Metadata {
  const url = path === "/" ? "/" : path;
  const images = ogImage ? [ogImage] : undefined;
  return {
    title,
    description,
    ...(keywords?.length ? { keywords } : {}),
    // Indexable pages opt into large image previews and untruncated snippets.
    // Without this Google defaults to a small thumbnail, and the OG cards this
    // site generates (1200x630, well over Discover's threshold) are the main
    // thing a linkless domain has going for it in feeds and rich results.
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type,
      ...(images ? { images } : {}),
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(images ? { images } : {}),
    },
  };
}
