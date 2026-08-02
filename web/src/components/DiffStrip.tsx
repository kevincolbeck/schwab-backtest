"use client";

import type { SpecChange } from "@/lib/types";

/** "Changes: stop loss 8% → 5%" pills shown after a chat edit re-runs. */
export default function DiffStrip({ changes }: { changes: SpecChange[] }) {
  if (!changes.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-accent-soft px-3 py-2">
      <span className="text-xs font-medium text-accent">Changes</span>
      {changes.map((c) => {
        const shortFrom = c.from.length > 24 ? c.from.slice(0, 24) + "…" : c.from;
        const shortTo = c.to.length > 24 ? c.to.slice(0, 24) + "…" : c.to;
        return (
          <span
            key={c.field}
            className="rounded-full border border-hairline bg-panel px-2.5 py-0.5 text-xs"
            title={`${c.field}: ${c.from} → ${c.to}`}
          >
            <span className="text-muted">{c.field}</span>{" "}
            <span className="tnum" aria-hidden="true">
              {shortFrom} → {shortTo}
            </span>
            <span className="sr-only">
              {c.from} changed to {c.to}
            </span>
          </span>
        );
      })}
    </div>
  );
}
