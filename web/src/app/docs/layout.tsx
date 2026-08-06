import type { Metadata } from "next";
import DocsSidebar from "@/components/docs/DocsSidebar";
import { DISCLAIMER } from "@/lib/constants";
import { pageMetadata } from "@/lib/seo";

/* No title.template here any more: every docs page sets its FULL title via
   pageMetadata() so <title> and og:title are the same string (P1-2). A
   template would append the suffix a second time. This is only the fallback
   for a docs route that forgets its own metadata — it still goes through the
   helper so that fallback carries correct OG tags rather than the homepage's. */
export const metadata: Metadata = pageMetadata({
  title: "Docs — Chat·Backtest",
  description:
    "How the lab, the ledger, and the exports work. Research and education — no live trading, no advice.",
  path: "/docs",
});

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-(--container-max) px-4 py-10 sm:px-6 lg:flex lg:gap-12">
      {/* Left rail: sticky on desktop, a select on mobile (inside DocsSidebar).
          Offsets derive from --nav-h (SYSTEM.md §8 — no magic viewport math). */}
      <aside className="slim-scroll shrink-0 lg:sticky lg:top-[calc(var(--nav-h)+2rem)] lg:block lg:max-h-[calc(100vh-var(--nav-h)-3rem)] lg:w-56 lg:self-start lg:overflow-y-auto lg:pb-8">
        <DocsSidebar />
      </aside>

      <div className="min-w-0 flex-1">
        {/* 70ch = named line-length cap for prose (AUDIT §7.2 — legit ch value). */}
        <article className="docs-prose max-w-[70ch]">{children}</article>
        <p className="mt-12 max-w-[70ch] border-t border-hairline pt-5 text-caption leading-relaxed text-faint">
          {DISCLAIMER}
        </p>
      </div>
    </div>
  );
}
