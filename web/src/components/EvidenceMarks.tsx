import { fmtDate } from "@/lib/format";

/* ── Evidence primitives (brief §3.1 · SYSTEM.md §3) ─────────────────────────
   The signature visual language: quiet verification marks on ledger and
   strategy surfaces. TRUTH RULE (absolute): these render ONLY real data
   passed as props — a fabricated hash or timestamp would undermine the
   entire brand. When the data is missing, they render nothing. */

/** Middle-truncate a hash for display: `a3f9…c21e`. */
export function truncateHash(hash: string): string {
  const h = hash.trim();
  return h.length > 10 ? `${h.slice(0, 4)}…${h.slice(-4)}` : h;
}

/** Truncated spec-hash verification mark, e.g. `a3f9…c21e ✓`.
 *  Pass the REAL hash (full or pre-shortened); never invent one. */
export function HashMark({
  hash,
  verified = true,
  className = "",
}: {
  hash: string | null | undefined;
  /** Show the quiet ✓ (muted, never accent/gain — SYSTEM.md §3). */
  verified?: boolean;
  className?: string;
}) {
  const full = hash?.trim();
  if (!full) return null;
  return (
    <span className={`tnum text-caption text-faint ${className}`} title={full}>
      {truncateHash(full)}
      {verified && (
        <span className="text-muted">
          {" "}
          ✓<span className="sr-only"> verified</span>
        </span>
      )}
    </span>
  );
}

/** Quiet mono timestamp mark, e.g. `since 2026-03-14`. Real dates only. */
export function TimestampMark({
  iso,
  prefix,
  className = "",
}: {
  /** Real ISO date/datetime from the system (rendered as YYYY-MM-DD). */
  iso: string | null | undefined;
  /** Framing word(s), e.g. "since" or "deployed". */
  prefix?: string;
  className?: string;
}) {
  if (!iso) return null;
  return (
    <time dateTime={iso} className={`tnum text-caption text-faint ${className}`}>
      {prefix ? `${prefix} ` : ""}
      {fmtDate(iso)}
    </time>
  );
}

/** Hypothetical-result badge — the counterpart to FrozenBadge for numbers
 *  derived from backtests rather than the live ledger. ≈ glyph + text so the
 *  distinction never rests on color alone (WCAG 1.4.1). */
export function HypotheticalBadge({
  label = "Hypothetical",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-(--radius-pill) border border-hairline bg-panel-2 px-2 py-0.5 font-mono text-caption text-muted ${className}`}
    >
      <span aria-hidden>≈</span>
      {label}
    </span>
  );
}

/** Frozen/verified badge for deployed strategies — quiet hairline pill,
 *  never glowing, never accent (SYSTEM.md §3). */
export function FrozenBadge({
  label = "Spec frozen",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-(--radius-pill) border border-hairline bg-panel-2 px-2 py-0.5 font-mono text-caption text-muted ${className}`}
    >
      <span aria-hidden>✓</span>
      {label}
    </span>
  );
}
