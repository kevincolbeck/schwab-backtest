"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type CalendarRow,
  type Profile,
  WEEKDAYS_SHORT,
  daysInMonth,
  isoDate,
  mondayIndex,
  monthLabel,
  rowTicker,
} from "./types";

const MAX_CHIPS = 3;

/** Tiny ticker chip for a day cell: logo when enrichment has one (lazy),
 *  mono ticker text otherwise. Non-interactive — the whole cell opens the
 *  day panel; ticker links live in the panel. */
function TickerChip({ label, logo }: { label: string; logo?: string | null }) {
  const [logoBroken, setLogoBroken] = useState(false);
  return (
    <span className="flex min-w-0 items-center gap-1 rounded-(--radius-tag) border border-hairline bg-panel-2 px-1.5 py-0.5">
      {logo && !logoBroken && (
        // eslint-disable-next-line @next/next/no-img-element -- tiny third-party favicon-scale logo; native lazy is the right tool
        <img
          src={logo}
          alt=""
          width={14}
          height={14}
          loading="lazy"
          decoding="async"
          onError={() => setLogoBroken(true)}
          className="h-3.5 w-3.5 shrink-0 object-contain"
        />
      )}
      <span className="tnum truncate text-caption text-ink">{label}</span>
    </span>
  );
}

/** Month grid with aria-grid semantics and full keyboard nav (arrows across
 *  days, Home/End across the month, Enter/Space opens the day panel). Hidden
 *  under `sm` — mobile renders the agenda list instead (parent decides).
 *  MUST be mounted with a `key` that includes year+month: the roving-focus
 *  state resets via remount (React's sanctioned state-reset pattern). */
export default function CalendarMonth({
  year,
  month,
  rowsByDate,
  profiles,
  todayIso,
  selectedDate,
  kindLabel,
  onOpenDay,
}: {
  year: number;
  month: number;
  /** ISO date -> that day's calendar rows (already kind-filtered). */
  rowsByDate: Map<string, CalendarRow[]>;
  /** symbol -> enrichment profile (populated as day panels load). */
  profiles: Record<string, Profile | null>;
  todayIso: string;
  selectedDate: string | null;
  kindLabel: string;
  onOpenDay: (iso: string) => void;
}) {
  const total = daysInMonth(year, month);
  // Initial focus: today when this month contains it, else day 1. Month
  // changes remount the grid (parent key), re-running this initializer.
  const [focusDay, setFocusDay] = useState(() => {
    const [ty, tm, td] = todayIso.split("-").map(Number);
    return ty === year && tm === month ? td : 1;
  });
  const gridRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef(false);

  // Roving tabindex: after a keyboard move, put DOM focus on the new cell.
  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-day="${focusDay}"]`)
      ?.focus();
  }, [focusDay]);

  const weeks = useMemo(() => {
    const lead = mondayIndex(year, month, 1);
    const cells: (number | null)[] = [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: total }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    const out: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [year, month, total]);

  const move = (delta: number) => {
    pendingFocus.current = true;
    setFocusDay((d) => Math.min(total, Math.max(1, d + delta)));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowRight": e.preventDefault(); move(1); break;
      case "ArrowLeft": e.preventDefault(); move(-1); break;
      case "ArrowDown": e.preventDefault(); move(7); break;
      case "ArrowUp": e.preventDefault(); move(-7); break;
      case "Home": e.preventDefault(); pendingFocus.current = true; setFocusDay(1); break;
      case "End": e.preventDefault(); pendingFocus.current = true; setFocusDay(total); break;
      case "Enter":
      case " ":
        e.preventDefault();
        onOpenDay(isoDate(year, month, focusDay));
        break;
    }
  };

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label={`${kindLabel} calendar, ${monthLabel(year, month)}`}
      onKeyDown={onKeyDown}
      className="overflow-hidden rounded-(--radius-card) border border-hairline bg-panel"
    >
      <div role="row" className="grid grid-cols-7 border-b border-hairline bg-panel-2">
        {WEEKDAYS_SHORT.map((d) => (
          <div
            key={d}
            role="columnheader"
            className="px-2 py-1.5 text-center text-caption font-medium uppercase tracking-wide text-muted"
          >
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div
          role="row"
          key={wi}
          className="grid grid-cols-7 border-b border-hairline last:border-b-0"
        >
          {week.map((day, di) => {
            if (day === null) {
              return (
                <div
                  key={`pad-${di}`}
                  role="gridcell"
                  aria-disabled="true"
                  className="min-h-24 border-r border-hairline bg-panel-2/40 last:border-r-0"
                />
              );
            }
            const iso = isoDate(year, month, day);
            const rows = rowsByDate.get(iso) ?? [];
            const shown = rows.slice(0, MAX_CHIPS);
            const extra = rows.length - shown.length;
            const isToday = iso === todayIso;
            const isSelected = iso === selectedDate;
            return (
              <button
                key={iso}
                type="button"
                role="gridcell"
                data-day={day}
                tabIndex={day === focusDay ? 0 : -1}
                aria-selected={isSelected || undefined}
                aria-current={isToday ? "date" : undefined}
                aria-label={`${iso}: ${rows.length} ${kindLabel.toLowerCase()} scheduled`}
                onClick={() => onOpenDay(iso)}
                className={`focus-ring flex min-h-24 flex-col items-stretch justify-start border-r border-hairline p-1.5 text-left transition-colors duration-(--dur-micro) last:border-r-0 hover:bg-panel-2 ${
                  isSelected ? "bg-accent-soft" : ""
                }`}
              >
                <span
                  className={`tnum block text-caption ${
                    isToday ? "font-medium text-accent" : "text-faint"
                  }`}
                >
                  {day}
                </span>
                <span className="mt-1 flex flex-col gap-1">
                  {shown.map((row, i) => {
                    const ticker = rowTicker(row);
                    const label = ticker ?? (row.name ?? "—").slice(0, 10);
                    const logo = ticker ? profiles[ticker]?.logo : null;
                    return <TickerChip key={`${label}-${i}`} label={label} logo={logo} />;
                  })}
                  {extra > 0 && (
                    <span className="tnum px-1 text-caption text-faint">
                      +{extra} more
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
