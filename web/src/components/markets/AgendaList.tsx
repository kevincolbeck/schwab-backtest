"use client";

import { type CalendarRow, addDaysISO, dayLabel, rowTicker } from "./types";

const WINDOW_DAYS = 14;
const MAX_TICKERS = 6;

/** Mobile replacement for the month grid: the next two weeks as a tappable
 *  agenda (days with events only). Each row opens the same day panel. */
export default function AgendaList({
  todayIso,
  rowsByDate,
  kindLabel,
  onOpenDay,
}: {
  todayIso: string;
  /** ISO date -> rows, spanning at least today..today+13 (kind-filtered). */
  rowsByDate: Map<string, CalendarRow[]>;
  kindLabel: string;
  onOpenDay: (iso: string) => void;
}) {
  const days: { iso: string; rows: CalendarRow[] }[] = [];
  for (let i = 0; i < WINDOW_DAYS; i += 1) {
    const iso = addDaysISO(todayIso, i);
    const rows = rowsByDate.get(iso) ?? [];
    if (rows.length > 0) days.push({ iso, rows });
  }

  if (days.length === 0) {
    return (
      <div className="card border-dashed p-4 text-sm text-muted">
        Nothing scheduled in the next two weeks.
      </div>
    );
  }

  return (
    <ul aria-label={`${kindLabel}, next two weeks`} className="space-y-2">
      {days.map(({ iso, rows }) => {
        const shown = rows.slice(0, MAX_TICKERS);
        const extra = rows.length - shown.length;
        return (
          <li key={iso}>
            <button
              type="button"
              onClick={() => onOpenDay(iso)}
              className="card card-hover focus-ring block w-full p-3 text-left"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="tnum text-sm font-medium text-ink">
                  {dayLabel(iso)}
                  {iso === todayIso && (
                    <span className="ml-2 text-caption text-accent">today</span>
                  )}
                </span>
                <span className="tnum shrink-0 text-caption text-faint">
                  {rows.length} scheduled
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {shown.map((row, i) => {
                  const label = rowTicker(row) ?? (row.name ?? "—").slice(0, 12);
                  return (
                    <span
                      key={`${label}-${i}`}
                      className="tnum rounded-(--radius-tag) border border-hairline bg-panel-2 px-1.5 py-0.5 text-caption text-ink"
                    >
                      {label}
                    </span>
                  );
                })}
                {extra > 0 && (
                  <span className="tnum px-1 py-0.5 text-caption text-faint">
                    +{extra} more
                  </span>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
