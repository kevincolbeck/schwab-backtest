"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Tabs from "@/components/ui/Tabs";
import AgendaList from "./AgendaList";
import CalendarMonth from "./CalendarMonth";
import DayPanel from "./DayPanel";
import ListToggle, { type CalendarView } from "./ListToggle";
import ListView from "./ListView";
import {
  type CalendarKind,
  type CalendarRow,
  type MonthPayload,
  type Profile,
  addDaysISO,
  monthLabel,
  parseMonthPayload,
  todayLocalISO,
} from "./types";

const KIND_LABELS: Record<CalendarKind, string> = {
  earnings: "Earnings",
  ipo: "IPOs",
};

const monthKey = (kind: CalendarKind, year: number, month: number) =>
  `${kind}-${year}-${month}`;

/** Interactive earnings/IPO calendar: tabbed month grid (agenda list on
 *  mobile), a compact list view for power users, and a slide-in day panel.
 *  Months are fetched through /api/markets/calendar-month and cached for the
 *  visit; every failure path degrades to a message, never a blank section. */
export default function CalendarSection({
  initialEarnings,
  initialIpo,
  initialYear,
  initialMonth,
  initialTodayIso,
}: {
  /** Server-rendered current-month payloads; null when the SSR fetch failed
   *  (the client then refetches instead of trusting a transient failure). */
  initialEarnings: MonthPayload | null;
  initialIpo: MonthPayload | null;
  initialYear: number;
  initialMonth: number;
  initialTodayIso: string;
}) {
  const [kind, setKind] = useState<CalendarKind>("earnings");
  const [view, setView] = useState<CalendarView>("calendar");
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [selected, setSelected] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile | null>>({});
  const [months, setMonths] = useState<Record<string, MonthPayload>>(() => {
    const seed: Record<string, MonthPayload> = {};
    if (initialEarnings)
      seed[monthKey("earnings", initialEarnings.year, initialEarnings.month)] =
        initialEarnings;
    if (initialIpo)
      seed[monthKey("ipo", initialIpo.year, initialIpo.month)] = initialIpo;
    return seed;
  });
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // Server today (SSR-stable) corrected to the visitor's local date on mount
  // — scheduled via rAF so hydration compares identical markup first.
  const [todayIso, setTodayIso] = useState(initialTodayIso);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setTodayIso(todayLocalISO()));
    return () => cancelAnimationFrame(raf);
  }, []);

  const monthsRef = useRef(months);
  const errorsRef = useRef(errors);
  useEffect(() => {
    monthsRef.current = months;
    errorsRef.current = errors;
  }, [months, errors]);
  const inflight = useRef<Set<string>>(new Set());

  const ensureMonth = useCallback(
    async (k: CalendarKind, y: number, m: number, force = false) => {
      if (y < 2000 || y > 2100 || m < 1 || m > 12) return;
      const key = monthKey(k, y, m);
      if (inflight.current.has(key)) return;
      if (!force && (monthsRef.current[key] || errorsRef.current[key])) return;
      inflight.current.add(key);
      try {
        const res = await fetch(
          `/api/markets/calendar-month?kind=${k}&year=${y}&month=${m}`,
        );
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as Partial<MonthPayload>;
        const payload = parseMonthPayload(body, k, y, m);
        setMonths((prev) => ({ ...prev, [key]: payload }));
        setErrors((prev) => {
          if (!prev[key]) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
      } catch {
        setErrors((prev) => ({ ...prev, [key]: true }));
      } finally {
        inflight.current.delete(key);
      }
    },
    [],
  );

  // Keep the displayed month + the agenda window (today..today+13, which can
  // straddle a month boundary) warm for the active kind. Scheduled (not
  // called synchronously) so the effect body never sets state directly.
  useEffect(() => {
    const [ty, tm] = todayIso.split("-").map(Number);
    const [ey, em] = addDaysISO(todayIso, 13).split("-").map(Number);
    const timer = setTimeout(() => {
      ensureMonth(kind, year, month);
      ensureMonth(kind, ty, tm);
      ensureMonth(kind, ey, em);
    }, 0);
    return () => clearTimeout(timer);
  }, [kind, year, month, todayIso, ensureMonth]);

  /** date -> rows across every cached month of the active kind — the grid
   *  reads its month out of it, the agenda reads its two-week window. */
  const rowsByDate = useMemo(() => {
    const map = new Map<string, CalendarRow[]>();
    for (const [key, payload] of Object.entries(months)) {
      if (!key.startsWith(`${kind}-`)) continue;
      for (const row of payload.rows) {
        if (!row?.date) continue;
        const list = map.get(row.date);
        if (list) list.push(row);
        else map.set(row.date, [row]);
      }
    }
    return map;
  }, [months, kind]);

  const activeKey = monthKey(kind, year, month);
  const activePayload = months[activeKey];
  const activeError = Boolean(errors[activeKey]);
  const kindLabel = KIND_LABELS[kind];

  const shiftMonth = (delta: number) => {
    const zero = year * 12 + (month - 1) + delta;
    const nextYear = Math.floor(zero / 12);
    if (nextYear < 2000 || nextYear > 2100) return;
    setYear(nextYear);
    setMonth((zero % 12) + 1);
  };

  const goToday = () => {
    const [ty, tm] = todayIso.split("-").map(Number);
    setYear(ty);
    setMonth(tm);
  };

  const mergeProfiles = useCallback(
    (incoming: Record<string, Profile | null>) =>
      setProfiles((prev) => ({ ...prev, ...incoming })),
    [],
  );

  const retry = () => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[activeKey];
      return next;
    });
    ensureMonth(kind, year, month, true);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          ariaLabel="Calendar type"
          // These tabs swap the whole calendar body rather than toggling
          // discrete panels, so there is no element for aria-controls to
          // point at. Omitting it is correct; a dangling reference is not.
          hasPanels={false}
          tabs={[
            { id: "earnings", label: "Earnings" },
            { id: "ipo", label: "IPOs" },
          ]}
          active={kind}
          onChange={(id) => {
            setKind(id as CalendarKind);
            setSelected(null);
          }}
        />
        <ListToggle view={view} onChange={setView} />
      </div>

      <div
        className={`mt-4 items-center justify-between gap-3 ${
          view === "calendar" ? "hidden sm:flex" : "flex"
        }`}
      >
        <h3 className="tnum text-sm font-medium text-ink">
          {monthLabel(year, month)}
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
          >
            ‹
          </Button>
          <Button variant="ghost" size="sm" onClick={goToday}>
            Today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
          >
            ›
          </Button>
        </div>
      </div>

      <div className="mt-3">
        {activePayload && !activePayload.configured ? (
          <Card pad="sm" className="border-dashed text-sm text-muted">
            Calendars warming up — earnings and IPO schedules will appear here
            shortly.
          </Card>
        ) : activeError && !activePayload ? (
          <Card pad="sm" className="border-dashed text-sm text-muted">
            <p>Couldn&apos;t load {monthLabel(year, month)} — the data service
            may be waking up.</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={retry}>
              Try again
            </Button>
          </Card>
        ) : !activePayload ? (
          <div
            aria-hidden
            className="h-80 animate-pulse rounded-(--radius-card) border border-hairline bg-panel-2"
          />
        ) : view === "list" ? (
          <ListView kind={kind} rows={activePayload.rows} />
        ) : (
          <>
            <div className="hidden sm:block">
              <CalendarMonth
                key={`${kind}-${year}-${month}`}
                year={year}
                month={month}
                rowsByDate={rowsByDate}
                profiles={profiles}
                todayIso={todayIso}
                selectedDate={selected}
                kindLabel={kindLabel}
                onOpenDay={setSelected}
              />
              {activePayload.rows.length === 0 && (
                <p className="mt-2 text-caption text-faint">
                  No {kindLabel.toLowerCase()} on the calendar for{" "}
                  <span className="tnum">{monthLabel(year, month)}</span>{" "}yet.
                </p>
              )}
            </div>
            <div className="sm:hidden">
              <AgendaList
                todayIso={todayIso}
                rowsByDate={rowsByDate}
                kindLabel={kindLabel}
                onOpenDay={setSelected}
              />
            </div>
          </>
        )}
      </div>

      {selected && (
        <DayPanel
          date={selected}
          kind={kind}
          onClose={() => setSelected(null)}
          onProfiles={mergeProfiles}
        />
      )}
    </div>
  );
}
