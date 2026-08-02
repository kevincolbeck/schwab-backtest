import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
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
  title: "Chat to Backtest — test any trading strategy in plain English",
  description:
    "Pick a template strategy, see 10 years of historical results in seconds, then change it in plain English and re-run. A research and education tool — no signals, no live trading.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-ink">
        <div className="flex-1 flex flex-col">{children}</div>
        <footer className="border-t border-hairline px-6 py-4 text-xs text-muted">
          {DISCLAIMER}
        </footer>
      </body>
    </html>
  );
}
