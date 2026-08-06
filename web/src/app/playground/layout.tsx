import { pageMetadata } from "@/lib/seo";

/* page.tsx is a Client Component (the lab is one big interactive surface), and
   Client Components can't export metadata — so it lives here. Next merges this
   layout's metadata into the route. */
export const metadata = pageMetadata({
  title: "The Lab — build & backtest any strategy in plain English",
  description:
    "Describe a strategy, watch the AI turn it into exact rules, and backtest it on decades of data in seconds. Free on daily bars, no signup for your first run.",
  path: "/playground",
});

export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
  return children;
}
