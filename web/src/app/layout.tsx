import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import AuthModalProvider from "@/components/AuthModal";
import CommandPalette from "@/components/CommandPalette";
import SiteNav from "@/components/SiteNav";
import { DISCLAIMER } from "@/lib/constants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chat·Backtest — build it, test it, prove it in public",
  description:
    "The AI trading-strategy lab: build any strategy in plain English, backtest a decade in seconds, and prove it on a public, immutable forward-test ledger. Research and education — no signals, no live trading.",
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
