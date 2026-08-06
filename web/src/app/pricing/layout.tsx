import { pageMetadata } from "@/lib/seo";

/* Metadata lives here because pricing/page.tsx is a Client Component (the
   monthly/annual toggle holds state). */
export const metadata = pageMetadata({
  title: "Pricing — Chat·Backtest AI strategy lab",
  description:
    "Flat capability tiers, no usage counters. Free runs unlimited daily-data backtests; Pro $39/mo adds intraday; Max $99/mo adds crypto and the full US universe.",
  path: "/pricing",
});

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
