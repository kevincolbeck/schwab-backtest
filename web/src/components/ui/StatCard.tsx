import type { ReactNode } from "react";

/** Evidence stat card (brief §3.1): the number is the hero, the label
 *  whispers. `valence` colors are for REAL P&L values only — never use
 *  gain/loss decoratively (SYSTEM.md §2). The `sub` slot takes evidence
 *  marks (TimestampMark / HashMark) or a caption; pass real data only. */
export default function StatCard({
  label,
  value,
  unit,
  valence = "neutral",
  sub,
  size = "md",
  className = "",
}: {
  /** Whispering label, e.g. "CAGR" — caption size, muted. */
  label: string;
  /** The hero number, pre-formatted (mono + tabular via .tnum). */
  value: string;
  /** Small unit suffix, e.g. "%" or "days", when not part of `value`. */
  unit?: string;
  /** P&L semantics only: gain/loss tint the number; neutral = ink. */
  valence?: "gain" | "loss" | "neutral";
  /** Evidence footer — TimestampMark, HashMark, or quiet caption copy. */
  sub?: ReactNode;
  size?: "md" | "lg";
  className?: string;
}) {
  const color =
    valence === "gain" ? "text-gain" : valence === "loss" ? "text-loss" : "text-ink";
  return (
    <div className={`card p-5 ${className}`}>
      <p className="text-caption uppercase tracking-widest text-muted">{label}</p>
      <p className={`tnum mt-1.5 ${size === "lg" ? "text-display" : "text-headline"} ${color}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-sans text-muted">{unit}</span>}
      </p>
      {sub && <div className="mt-1.5 text-caption text-faint">{sub}</div>}
    </div>
  );
}
