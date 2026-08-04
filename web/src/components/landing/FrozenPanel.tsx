import { CardLink } from "@/components/ui/Card";
import { FrozenBadge, HashMark, TimestampMark } from "@/components/EvidenceMarks";
import Sparkline from "@/components/Sparkline";
import { fmtSignedPct } from "@/lib/format";
import type { LeaderboardEntry } from "@/lib/types";

/** The Proof section's evidence object: ONE real deployed strategy straight
 *  from the live leaderboard fetch — frozen badge, spec-hash mark, deploy
 *  timestamp, and its actual forward record (truth rule: real data only).
 *  Styled as a quiet receipt; the whole panel links to the strategy page. */
export default function FrozenPanel({ entry }: { entry: LeaderboardEntry }) {
  const ret = entry.forward_return_pct;
  return (
    <CardLink
      href={`/strategy/${entry.slug}`}
      pad="none"
      featured
      className="mx-auto w-full max-w-md overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
        <p className="truncate text-sm font-medium text-ink">{entry.name}</p>
        <FrozenBadge />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hairline px-5 py-2.5">
        <HashMark hash={entry.spec_hash_short} />
        <TimestampMark iso={entry.deployed_at} prefix="deployed" />
      </div>
      <div className="flex items-end justify-between gap-4 px-5 py-4">
        <div>
          <p className="text-caption uppercase tracking-widest text-muted">Days live</p>
          <p className="tnum mt-0.5 text-headline text-ink">{entry.days_live}</p>
        </div>
        <div>
          <p className="text-caption uppercase tracking-widest text-muted">Forward return</p>
          <p
            className={`tnum mt-0.5 text-headline ${
              ret > 0 ? "text-gain" : ret < 0 ? "text-loss" : "text-ink"
            }`}
          >
            {fmtSignedPct(ret, 2)}
          </p>
        </div>
        <div className="pb-1.5">
          <Sparkline
            values={entry.sparkline}
            baseline={entry.starting_capital ?? 100000}
            width={96}
            height={30}
          />
        </div>
      </div>
    </CardLink>
  );
}
