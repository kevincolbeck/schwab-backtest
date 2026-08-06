import type { ReactNode } from "react";
import { METRICS, type MetricDef, type MetricKey } from "@/lib/metrics";

/** THE stat block (Section 7 design system).
 *
 *  Section 7's acceptance criterion is "stat displays render from one
 *  component". Before this, eleven files each rolled their own — five
 *  different value sizes, three different label recipes, and the same metric
 *  formatted to different precision on different pages. The component that
 *  was supposed to be the shared one, `ui/StatCard`, had zero importers.
 *
 *  It went unadopted for a concrete reason worth not repeating: it hardcoded
 *  its own `card p-5` wrapper, so every real call site — already inside a
 *  Card, a panel or a table — would have got a double border. Surface is the
 *  caller's job here. This renders semantics and type scale, nothing else.
 *
 *  Deliberately NOT a client component: it has no state and no handlers, so
 *  it can render inside server pages without opening a client boundary.
 */

const SIZES = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-xl",
  xl: "text-headline",
} as const;

export function StatGrid({
  cols = 4,
  children,
  className = "",
}: {
  cols?: 2 | 3 | 4 | 6;
  children: ReactNode;
  className?: string;
}) {
  const grid = {
    2: "grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  }[cols];
  // A real <dl>: each stat is a term/definition pair, which is what lets a
  // screen reader announce "CAGR, 21.8%" rather than two loose strings.
  return <dl className={`grid gap-5 ${grid} ${className}`}>{children}</dl>;
}

export default function Stat({
  metric,
  label,
  value,
  hint,
  size = "md",
  valence = "none",
  sub,
}: {
  /** Pulls label, hint and formatter from the registry. */
  metric?: MetricKey;
  /** Escape hatch for one-off stats that aren't real metrics. */
  label?: string;
  /** Raw number (formatted via the registry) or a pre-formatted string. */
  value: number | string | null | undefined;
  hint?: string;
  size?: keyof typeof SIZES;
  /** "auto" derives gain/loss from the sign — legal ONLY on real P&L. */
  valence?: "auto" | "none";
  /** Caption or evidence mark, rendered inside the <dd> so it stays
   *  associated with the value rather than orphaned beside it. */
  sub?: ReactNode;
}) {
  const def: MetricDef | undefined = metric ? METRICS[metric] : undefined;
  const resolvedLabel = label ?? def?.label ?? "";
  const resolvedHint = hint ?? def?.hint;

  if (process.env.NODE_ENV !== "production" && valence === "auto") {
    // Colouring a hypothetical or a magnitude as if it were realised P&L is a
    // truth problem, not a style problem — fail loudly in dev.
    if (!def?.isPnl) {
      throw new Error(
        `Stat: valence="auto" is only legal on a real P&L metric; "${metric ?? label}" is not one.`,
      );
    }
  }

  const numeric = typeof value === "number" ? value : null;
  const text =
    typeof value === "string" ? value : def ? def.fmt(numeric) : String(value ?? "—");
  const color =
    valence === "auto" && numeric !== null
      ? numeric > 0
        ? "text-gain"
        : numeric < 0
          ? "text-loss"
          : "text-ink"
      : "text-ink";

  return (
    <div>
      <dt className="flex items-center gap-1 text-caption uppercase tracking-widest text-muted">
        {resolvedLabel}
        {resolvedHint ? (
          // <abbr>, not <button>: it performs no action, and a focusable
          // control that does nothing on Enter is worse than none.
          <abbr
            className="cursor-help no-underline"
            aria-label={`${resolvedLabel}: ${resolvedHint}`}
            title={resolvedHint}
          >
            ⓘ
          </abbr>
        ) : null}
      </dt>
      <dd className={`tnum mt-0.5 font-medium ${SIZES[size]} ${color}`}>
        {text}
        {sub ? (
          <span className="mt-0.5 block text-caption font-normal text-faint">{sub}</span>
        ) : null}
      </dd>
    </div>
  );
}
