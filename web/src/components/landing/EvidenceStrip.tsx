import type { LeaderboardEntry } from "@/lib/types";

/** The Strategist section's proof element: real aggregates computed from the
 *  live fetches — house-template count, how many are live on the ledger
 *  (verified + warming; every deployment accrues out-of-sample records from
 *  day one), and how many are negative right now (losers stay on the board;
 *  the honesty is the brand). Renders nothing when either fetch is
 *  unavailable — a fabricated zero would break the truth rule. */
export default function EvidenceStrip({
  templateCount,
  entries,
}: {
  templateCount: number;
  entries: LeaderboardEntry[];
}) {
  if (!templateCount || !entries.length) return null;
  const negative = entries.filter((e) => e.forward_return_pct < 0).length;
  const items = [
    { value: templateCount, label: "house strategies, drafted with the AI" },
    { value: entries.length, label: "live on the public ledger, accruing out-of-sample records" },
    { value: negative, label: "negative right now — and staying on the board" },
  ];
  return (
    <div className="card grid divide-y divide-hairline overflow-hidden sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {items.map((it) => (
        <div key={it.label} className="px-5 py-4">
          <p className="tnum text-headline text-ink">{it.value}</p>
          <p className="mt-1 text-caption text-muted">{it.label}</p>
        </div>
      ))}
    </div>
  );
}
