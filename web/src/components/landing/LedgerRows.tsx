import Link from "next/link";
import { HashMark } from "@/components/EvidenceMarks";
import Reveal from "@/components/Reveal";
import Sparkline from "@/components/Sparkline";
import { fmtSignedPct } from "@/lib/format";
import type { LeaderboardEntry } from "@/lib/types";

/** The Board section's proof object: mini append-only ledger rows from the
 *  REAL leaderboard fetch — rank, name, spec-hash mark, days live, equity
 *  sparkline, signed forward return (sign is the non-color valence cue).
 *  Rows enter with the single site-wide reveal stagger. Truth rule: every
 *  mark below is live system data. */
export default function LedgerRows({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="card overflow-hidden">
      {entries.map((e, i) => {
        const ret = e.forward_return_pct;
        return (
          <Reveal key={e.slug} index={i} className="border-b border-hairline last:border-0">
            <Link
              href={`/strategy/${e.slug}`}
              className="focus-ring flex items-center gap-4 px-4 py-3 transition-colors duration-(--dur-micro) hover:bg-panel-2"
            >
              <span className="tnum w-5 shrink-0 text-caption text-faint">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{e.name}</span>
                <HashMark hash={e.spec_hash_short} className="hidden sm:inline" />
              </span>
              <span className="tnum hidden shrink-0 text-caption text-muted md:block">
                {e.days_live} days live
              </span>
              <Sparkline values={e.sparkline} baseline={100000} width={90} height={22} />
              <span
                className={`tnum w-20 shrink-0 text-right text-sm ${
                  ret > 0 ? "text-gain" : ret < 0 ? "text-loss" : "text-muted"
                }`}
              >
                {fmtSignedPct(ret, 2)}
              </span>
            </Link>
          </Reveal>
        );
      })}
    </div>
  );
}
