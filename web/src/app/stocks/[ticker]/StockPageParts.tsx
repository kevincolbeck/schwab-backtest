"use client";

import { useMemo, useState } from "react";
import CandleChart, { type Bar } from "@/components/CandleChart";

/* ── Client bits for the stock page ──────────────────────────────────────────
   One payload, client-side slicing: the range chips re-slice the SAME daily
   series the server already sent — no extra fetches, ever. */

const RANGES = [
  { id: "1M", days: 31 },
  { id: "6M", days: 183 },
  { id: "1Y", days: 366 },
  { id: "5Y", days: Number.POSITIVE_INFINITY },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

/** Service bars guarantee `close`; OHLC fields may be null on sparse rows. */
export type DailyBar = {
  time: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
};

/** Coerce sparse rows to full candles (flat candle when OHLC is missing). */
function toCandles(bars: DailyBar[]): Bar[] {
  return bars.map((b) => ({
    time: b.time,
    open: b.open ?? b.close,
    high: b.high ?? b.close,
    low: b.low ?? b.close,
    close: b.close,
    volume: b.volume ?? undefined,
  }));
}

/** Slice relative to the LAST settled bar (not "now") — EOD-honest windows. */
function sliceRange(bars: Bar[], days: number): Bar[] {
  if (!Number.isFinite(days) || bars.length === 0) return bars;
  const last = new Date(`${bars[bars.length - 1].time}T00:00:00Z`).getTime();
  if (!Number.isFinite(last)) return bars;
  const cutoff = new Date(last - days * 86_400_000).toISOString().slice(0, 10);
  return bars.filter((b) => b.time >= cutoff);
}

/** Candle chart with 1M / 6M / 1Y / 5Y range chips. Colors resolve from the
 *  design tokens at runtime inside CandleChart (SYSTEM.md §10). */
export function PriceRangeChart({ bars: rawBars }: { bars: DailyBar[] }) {
  const [range, setRange] = useState<RangeId>("1Y");
  const bars = useMemo(() => toCandles(rawBars), [rawBars]);
  const days = RANGES.find((r) => r.id === range)?.days ?? Number.POSITIVE_INFINITY;
  const sliced = useMemo(() => sliceRange(bars, days), [bars, days]);

  if (bars.length < 2) {
    return (
      <p className="text-sm text-muted">
        Not enough cached settled closes to chart yet — price history appears here
        after the next end-of-day data refresh.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Chart range"
          className="inline-flex items-center gap-1 rounded-(--radius-control) border border-hairline bg-panel-2 p-1"
        >
          {RANGES.map((r) => {
            const active = r.id === range;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                aria-pressed={active}
                className={`focus-ring tnum rounded-(--radius-tag) tap-target inline-flex items-center px-3 py-1 text-xs transition-colors duration-(--dur-micro) ${
                  active
                    ? "border border-hairline bg-panel text-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                {r.id}
              </button>
            );
          })}
        </div>
        {sliced.length > 1 && (
          <p className="tnum text-caption text-faint">
            {sliced[0].time} → {sliced[sliced.length - 1].time} · {sliced.length}{" "}
            settled sessions
          </p>
        )}
      </div>
      <div className="mt-3">
        <CandleChart bars={sliced} height={340} />
      </div>
    </div>
  );
}

/** Company mark with a quiet initial-tile fallback when the logo is missing
 *  or the remote image breaks. */
export function CompanyLogo({ src, symbol }: { src: string | null; symbol: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span
        aria-hidden
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-(--radius-control) border border-hairline bg-panel-2 font-mono text-lg text-muted"
      >
        {symbol.charAt(0)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- company logos come from arbitrary hosts; next/image needs remotePatterns config
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-12 w-12 shrink-0 rounded-(--radius-control) border border-hairline bg-panel-2 object-contain p-1"
    />
  );
}

/** Profile description, clamped with a quiet expand toggle. */
export function CompanyDescription({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 320;
  return (
    <div>
      <p
        className={`max-w-prose text-sm leading-relaxed text-muted ${
          long && !open ? "line-clamp-4" : ""
        }`}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="focus-ring mt-2 rounded-(--radius-tag) text-xs text-accent hover:underline"
        >
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

/** Lazy news thumbnail that degrades to a quiet panel when the remote image
 *  is missing or broken — a dead image must never break the list. */
export function NewsThumb({ src }: { src: string | null }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span
        aria-hidden
        className="h-14 w-14 shrink-0 rounded-(--radius-tag) border border-hairline bg-panel-2"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- news images come from arbitrary hosts; next/image needs remotePatterns config
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-14 w-14 shrink-0 rounded-(--radius-tag) border border-hairline object-cover"
    />
  );
}
