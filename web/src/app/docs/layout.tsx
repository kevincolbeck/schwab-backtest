import type { Metadata } from "next";
import DocsSidebar from "@/components/docs/DocsSidebar";
import { DISCLAIMER } from "@/lib/constants";

export const metadata: Metadata = {
  title: {
    template: "%s — Docs — Chat·Backtest",
    default: "Docs — Chat·Backtest",
  },
  description:
    "How the lab, the ledger, and the exports work. Research and education — no live trading, no advice.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10 lg:flex lg:gap-12">
      {/* Left rail: sticky on desktop, a select on mobile (inside DocsSidebar). */}
      <aside className="slim-scroll shrink-0 lg:sticky lg:top-20 lg:block lg:max-h-[calc(100vh-6rem)] lg:w-56 lg:self-start lg:overflow-y-auto lg:pb-8">
        <DocsSidebar />
      </aside>

      <div className="min-w-0 flex-1">
        <article className="docs-prose max-w-[70ch]">{children}</article>
        <p className="mt-12 max-w-[70ch] border-t border-hairline pt-5 text-[11px] leading-relaxed text-faint">
          {DISCLAIMER}
        </p>
      </div>
    </div>
  );
}
