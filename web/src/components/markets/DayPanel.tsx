"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { fmtNum } from "@/lib/format";
import {
  type CalendarKind,
  type CalendarRow,
  type DayPayload,
  type Profile,
  HOUR_BADGES,
  dayLabel,
  fmtMarketCap,
  fmtShares,
  rowTicker,
} from "./types";

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

type LoadState = "loading" | "ready" | "error";

function LogoOrMono({ ticker, logo }: { ticker: string; logo?: string | null }) {
  const [broken, setBroken] = useState(false);
  if (logo && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small third-party logo; native lazy loading
      <img
        src={logo}
        alt=""
        width={24}
        height={24}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className="h-6 w-6 shrink-0 object-contain"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-(--radius-tag) border border-hairline bg-panel-2 text-caption text-muted"
    >
      {ticker.slice(0, 2)}
    </span>
  );
}

function EarningsRows({ rows }: { rows: CalendarRow[] }) {
  return (
    <ul className="divide-y divide-hairline">
      {rows.map((row, i) => {
        const ticker = rowTicker(row) ?? "—";
        const badge = row.hour ? HOUR_BADGES[row.hour] : undefined;
        return (
          <li key={`${ticker}-${i}`} className="py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <LogoOrMono ticker={ticker} logo={row.profile?.logo} />
              <Link
                href={`/stocks/${encodeURIComponent(ticker)}`}
                className="focus-ring rounded-(--radius-tag) text-sm font-medium text-ink hover:text-accent"
              >
                {ticker}
              </Link>
              <span className="truncate text-xs text-muted">
                {row.profile?.name ?? ""}
              </span>
              {(badge || row.hour) && (
                <span
                  title={badge?.title ?? undefined}
                  className="tnum ml-auto shrink-0 rounded-(--radius-pill) border border-hairline bg-panel-2 px-2 py-0.5 text-caption uppercase tracking-wide text-muted"
                >
                  {badge?.label ?? row.hour}
                </span>
              )}
            </div>
            <div className="tnum mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 pl-[2.125rem] text-caption text-muted">
              <span>
                EPS est <span className="text-ink">{fmtNum(row.epsEstimate)}</span>
              </span>
              <span>
                EPS actual <span className="text-ink">{fmtNum(row.epsActual)}</span>
              </span>
              <span>
                Mkt cap{" "}
                <span className="text-ink">
                  {fmtMarketCap(row.profile?.marketCapitalization)}
                </span>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function IpoRows({ rows }: { rows: CalendarRow[] }) {
  return (
    <ul className="divide-y divide-hairline">
      {rows.map((row, i) => {
        const ticker = rowTicker(row);
        return (
          <li key={`${ticker ?? row.name}-${i}`} className="py-3">
            <div className="flex min-w-0 items-baseline gap-2">
              {ticker ? (
                <Link
                  href={`/stocks/${encodeURIComponent(ticker)}`}
                  className="focus-ring rounded-(--radius-tag) text-sm font-medium text-ink hover:text-accent"
                >
                  {ticker}
                </Link>
              ) : (
                <span className="text-sm font-medium text-ink">—</span>
              )}
              <span className="truncate text-xs text-muted">{row.name}</span>
              {row.status && (
                <span className="ml-auto shrink-0 rounded-(--radius-pill) border border-hairline bg-panel-2 px-2 py-0.5 text-caption uppercase tracking-wide text-muted">
                  {row.status}
                </span>
              )}
            </div>
            <div className="tnum mt-1.5 text-caption text-muted">
              {row.exchange ?? "—"}
              {row.price !== null && row.price !== undefined && row.price !== "" && (
                <> · ${String(row.price)}</>
              )}
              <> · {fmtShares(row.numberOfShares)}</>
              <> · {row.date}</>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Slide-in day detail (right sheet on desktop, full-width overlay on
 *  mobile). Fetches /api/markets/day on open; enrichment profiles flow back
 *  up via onProfiles so month-grid chips gain logos over time. */
export default function DayPanel({
  date,
  kind,
  onClose,
  onProfiles,
}: {
  date: string;
  kind: CalendarKind;
  onClose: () => void;
  onProfiles: (profiles: Record<string, Profile | null>) => void;
}) {
  const [state, setState] = useState<LoadState>("loading");
  const [rows, setRows] = useState<CalendarRow[]>([]);
  const [entered, setEntered] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const onProfilesRef = useRef(onProfiles);
  useEffect(() => {
    onCloseRef.current = onClose;
    onProfilesRef.current = onProfiles;
  });

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setState("loading");
      try {
        const res = await fetch(
          `/api/markets/day?date=${encodeURIComponent(date)}&kind=${kind}`,
          { signal },
        );
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as Partial<DayPayload>;
        const got = Array.isArray(body.rows) ? body.rows : [];
        setRows(got);
        setState("ready");
        if (kind === "earnings") {
          const profiles: Record<string, Profile | null> = {};
          for (const row of got) {
            const ticker = rowTicker(row);
            if (ticker && row.profile !== undefined) profiles[ticker] = row.profile;
          }
          if (Object.keys(profiles).length) onProfilesRef.current(profiles);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setRows([]);
        setState("error");
      }
    },
    [date, kind],
  );

  useEffect(() => {
    // Scheduled so the effect body never sets state synchronously; the panel
    // mounts already in its "loading" visual state.
    const controller = new AbortController();
    const timer = setTimeout(() => load(controller.signal), 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  // Enter animation + Escape/Tab handling + scroll lock + focus restore.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
        ).filter((el) => el.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !panelRef.current.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previouslyFocused?.focus?.();
    };
  }, []);

  const kindLabel = kind === "ipo" ? "IPOs" : "Earnings";

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <div
        aria-hidden="true"
        onClick={() => onCloseRef.current()}
        className="absolute inset-0 bg-overlay backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`${kindLabel} on ${dayLabel(date)}`}
        className={`glass focus-ring absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-hairline-strong shadow-[var(--shadow-pop)] transition-transform duration-(--dur-standard) ease-(--ease-out) motion-reduce:transition-none ${
          entered ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted">
              {kindLabel}
            </p>
            <h2 className="tnum mt-1 text-lg font-medium text-ink">
              {dayLabel(date)}
            </h2>
          </div>
          <button
            onClick={() => onCloseRef.current()}
            aria-label="Close"
            className="focus-ring rounded-(--radius-tag) tap-target inline-flex items-center justify-center p-1 text-muted hover:text-ink"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {state === "loading" && (
            <ul aria-hidden className="animate-pulse space-y-3 py-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <li key={i} className="space-y-1.5">
                  <div className="h-4 w-2/3 rounded-(--radius-tag) bg-panel-2" />
                  <div className="h-3 w-5/6 rounded-(--radius-tag) bg-panel-2" />
                </li>
              ))}
            </ul>
          )}
          {state === "error" && (
            <div className="py-6 text-sm text-muted">
              <p>Couldn&apos;t load this day — the data service may be busy.</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => load()}>
                Try again
              </Button>
            </div>
          )}
          {state === "ready" &&
            (rows.length === 0 ? (
              <p className="py-6 text-sm text-muted">
                Nothing scheduled for this day.
              </p>
            ) : kind === "ipo" ? (
              <IpoRows rows={rows} />
            ) : (
              <EarningsRows rows={rows} />
            ))}
        </div>
        <p className="border-t border-hairline px-5 py-3 text-caption text-faint">
          Informational calendar data — not a recommendation to buy or sell
          anything.
        </p>
      </div>
    </div>
  );
}
