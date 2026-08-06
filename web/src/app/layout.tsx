import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import AuthModalProvider from "@/components/AuthModal";
import CommandPalette from "@/components/CommandPalette";
import SiteNav from "@/components/SiteNav";
import { DISCLAIMER } from "@/lib/constants";
import { SITE_URL, pageMetadata } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* Root metadata doubles as the HOMEPAGE's metadata (a page with no metadata
   export inherits it), which is why the title here is the spec's homepage
   title verbatim. Every other route sets its own via pageMetadata() — see
   web/src/lib/seo.ts for why that matters (shallow merging would otherwise
   give every page the homepage's og:title). Deliberately NO title.template:
   §P1-2 fixes exact titles for the primary pages and a template would append
   a suffix to them. */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  ...pageMetadata({
    title: "Chat·Backtest — AI backtesting for momentum & swing traders",
    description:
      "Describe a trading strategy in plain English. The AI writes exact rules, backtests two decades in seconds, and shows you where it breaks — then survivors earn a public, verifiable forward-test record.",
    path: "/",
  }),
};

const THEME_INIT = `(function(){try{if(localStorage.getItem('ctb-theme')==='light'){document.documentElement.dataset.theme='light'}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background text-ink">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <AuthModalProvider>
          <SiteNav />
          <div className="flex flex-1 flex-col">{children}</div>
          <CommandPalette />
          <footer className="border-t border-hairline">
            <div className="mx-auto flex w-full max-w-(--container-max) flex-col gap-3 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-center gap-4 text-xs text-muted">
                <Link
                  href="/leaderboard"
                  className="focus-ring rounded-(--radius-tag) hover:text-ink"
                >
                  Leaderboard
                </Link>
                <Link
                  href="/pricing"
                  className="focus-ring rounded-(--radius-tag) hover:text-ink"
                >
                  Pricing
                </Link>
                <Link
                  href="/playground"
                  className="focus-ring rounded-(--radius-tag) hover:text-ink"
                >
                  The Lab
                </Link>
                {/* Kept in the footer rather than the nav: both are
                    search-entry surfaces that need a crawlable internal link
                    from every page, not a seventh and eighth top-level tab. */}
                <Link
                  href="/compare"
                  className="focus-ring rounded-(--radius-tag) hover:text-ink"
                >
                  Compare
                </Link>
                <Link
                  href="/about"
                  className="focus-ring rounded-(--radius-tag) hover:text-ink"
                >
                  About
                </Link>
              </div>
              <p className="max-w-xl text-caption leading-relaxed text-faint">
                {DISCLAIMER}
              </p>
            </div>
          </footer>
        </AuthModalProvider>
      </body>
    </html>
  );
}
