import type { ReactNode } from "react";
import type { Indicator, Spec, TemplateMeta } from "@/lib/types";

/** StrategyPreview — a deterministic SVG teaching illustration of a strategy's
 *  MECHANIC. It reads the template's spec (indicators + rules + timeframe),
 *  derives a MOTIF from the spec's contents (never hardcoded per template id),
 *  and renders a stylized dark mini-chart: a synthetic-but-plausible candle
 *  path, the strategy's actual indicator geometry, one short annotation label
 *  derived from the rules, and a subtle highlight at the trigger moment.
 *
 *  TRUTH RULE (SYSTEM.md §3): this is a teaching illustration, not data — an
 *  "illustration" caption sits in the corner and no stats are ever faked. The
 *  only numbers shown are the strategy's own rule parameters (lengths,
 *  thresholds) parsed straight from the spec.
 *
 *  Tokens only (SYSTEM.md §10): inline SVG consumes CSS vars directly (the
 *  Sparkline pattern), so every color is theme-reactive with zero JS. Candle
 *  valence uses --gain/--loss (their sanctioned use), the strategy's primary
 *  indicator uses --accent (the EquityChart precedent), secondary lines use
 *  the --muted/--faint ink tiers, and the rotation motif's comparison line
 *  uses --prev-run + dash (never color alone). Geometry is seeded from the
 *  spec name — deterministic, so server and client renders agree. */

const W = 320;
const H = 150;
const X0 = 12;
const X1 = 308;
const PT = 28; // price pane top
const PB = 128; // price pane bottom
const N = 24; // candles
const STEP = (X1 - X0) / N;
const BODY = STEP * 0.55;

type Rng = () => number;

type MotifKind =
  | "ma-cross"
  | "channel"
  | "oscillator"
  | "band"
  | "dip"
  | "stack"
  | "rotation"
  | "seasonal"
  | "vwap"
  | "generic";

interface Motif {
  kind: MotifKind;
  /** ONE short annotation, derived from the spec's own rule parameters. */
  label: string;
  /** Plain-English description of the mechanic for aria-label. */
  aria: string;
  /** Price-MA lengths referenced by the entry rule (generic fallback lines). */
  maLens: number[];
  /** Channel motif: spec also carries a rolling_min exit channel. */
  hasLower: boolean;
}

/* ── deterministic PRNG ─────────────────────────────────────────────────── */

function seedFrom(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── tiny series math ───────────────────────────────────────────────────── */

const clampV = (v: number) => Math.min(0.97, Math.max(0.03, v));
const xAt = (i: number) => X0 + STEP * (i + 0.5);
const yAt = (v: number, top = PT, bottom = PB) =>
  bottom - clampV(v) * (bottom - top);
const fx = (n: number) => Number(n.toFixed(2));

function mkSeries(fn: (i: number, t: number) => number): number[] {
  return Array.from({ length: N }, (_, i) => clampV(fn(i, i / (N - 1))));
}

function sma(vals: number[], w: number): number[] {
  return vals.map((_, i) => {
    const s = vals.slice(Math.max(0, i - w + 1), i + 1);
    return s.reduce((a, b) => a + b, 0) / s.length;
  });
}

function rollMax(vals: number[], w: number): number[] {
  return vals.map((_, i) => Math.max(...vals.slice(Math.max(0, i - w + 1), i + 1)));
}

function rollMin(vals: number[], w: number): number[] {
  return vals.map((_, i) => Math.min(...vals.slice(Math.max(0, i - w + 1), i + 1)));
}

function rollStd(vals: number[], w: number): number[] {
  return vals.map((_, i) => {
    const s = vals.slice(Math.max(0, i - w + 1), i + 1);
    const m = s.reduce((a, b) => a + b, 0) / s.length;
    return Math.sqrt(s.reduce((a, b) => a + (b - m) * (b - m), 0) / s.length);
  });
}

const gauss = (i: number, c: number, wdt: number) => {
  const d = (i - c) / wdt;
  return Math.exp(-d * d);
};

const argMin = (vals: number[]) =>
  vals.reduce((best, v, i) => (v < vals[best] ? i : best), 0);

function linePts(vals: number[], top = PT, bottom = PB, i0 = 0): string {
  return vals
    .map((v, j) => `${fx(xAt(i0 + j))},${fx(yAt(v, top, bottom))}`)
    .join(" ");
}

/* ── candle geometry ────────────────────────────────────────────────────── */

interface Candle {
  x: number;
  o: number;
  c: number;
  h: number;
  l: number;
  up: boolean;
}

function buildCandles(closes: number[], r: Rng): Candle[] {
  return closes.map((c, i) => {
    const o = i === 0 ? c - 0.008 : closes[i - 1];
    const h = Math.max(o, c) + 0.008 + r() * 0.018;
    const l = Math.min(o, c) - (0.008 + r() * 0.018);
    return { x: xAt(i), o, c, h, l, up: c >= o };
  });
}

/* ── shared visual atoms (tokens only) ──────────────────────────────────── */

function grid(top = PT, bottom = PB, mid = true): ReactNode {
  const m = (top + bottom) / 2;
  return (
    <g stroke="var(--hairline)" strokeWidth={1}>
      <line x1={X0} x2={X1} y1={top} y2={top} />
      {mid && <line x1={X0} x2={X1} y1={m} y2={m} />}
      <line x1={X0} x2={X1} y1={bottom} y2={bottom} />
    </g>
  );
}

/** Subtle highlight column at the trigger moment (accent-soft = the sanctioned
 *  "active state" alpha fill). Rendered UNDER the candles. */
function column(i: number, top = PT, bottom = PB): ReactNode {
  return (
    <rect
      x={fx(xAt(i) - STEP / 2)}
      y={top}
      width={fx(STEP)}
      height={bottom - top}
      rx={2}
      fill="var(--accent-soft)"
    />
  );
}

/** Trigger dot — accent marker with a surface ring so it reads over lines. */
function dot(i: number, v: number, top = PT, bottom = PB): ReactNode {
  return (
    <circle
      cx={fx(xAt(i))}
      cy={fx(yAt(v, top, bottom))}
      r={3.2}
      fill="var(--accent)"
      stroke="var(--bg-1)"
      strokeWidth={1.4}
    />
  );
}

function candleMarks(
  cs: Candle[],
  top = PT,
  bottom = PB,
  dimmed?: (i: number) => boolean,
): ReactNode {
  return (
    <g>
      {cs.map((k, i) => {
        const color = k.up ? "var(--gain)" : "var(--loss)";
        const yO = yAt(k.o, top, bottom);
        const yC = yAt(k.c, top, bottom);
        return (
          <g key={i} opacity={dimmed?.(i) ? 0.35 : 1}>
            <line
              x1={fx(k.x)}
              x2={fx(k.x)}
              y1={fx(yAt(k.h, top, bottom))}
              y2={fx(yAt(k.l, top, bottom))}
              stroke={color}
              strokeWidth={1}
            />
            <rect
              x={fx(k.x - BODY / 2)}
              y={fx(Math.min(yO, yC))}
              width={fx(BODY)}
              height={fx(Math.max(Math.abs(yO - yC), 1.4))}
              rx={1}
              fill={color}
            />
          </g>
        );
      })}
    </g>
  );
}

/* ── motif derivation (from spec contents, never template ids) ──────────── */

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function deriveMotif(spec: Spec): Motif {
  const entry = `${spec.entry_rule_long ?? spec.entry_rule ?? ""}`;
  const exit = `${spec.exit_rule ?? ""}`;
  const rules = `${entry} ${exit}`;
  const inds = spec.indicators ?? [];
  const named = inds.filter((x): x is Indicator & { name: string } => Boolean(x.name));
  const refd = (n: string) => new RegExp(`\\b${n}\\b`).test(entry);
  // Price moving averages the ENTRY rule actually uses (volume MAs excluded).
  const maRefs = named.filter(
    (x) => (x.type === "sma" || x.type === "ema") && x.source !== "volume" && refd(x.name),
  );
  const maLens = maRefs
    .map((x) => x.length ?? 0)
    .filter(Boolean)
    .sort((a, b) => a - b);

  // 1 · VWAP reversion: rules anchor to the session VWAP.
  if (/session_vwap/.test(rules)) {
    const k = rules.match(/session_vwap\s*\*\s*(0?\.\d+)/);
    const pct = k ? Number(((1 - parseFloat(k[1])) * 100).toFixed(1)) : null;
    return {
      kind: "vwap",
      label: pct ? `${pct}% under VWAP` : "VWAP snap-back",
      aria: "illustration of the mechanic: price stretching below the session VWAP line, with the entry marked at the stretch and a snap back to VWAP after.",
      maLens,
      hasLower: false,
    };
  }

  // 2 · Seasonal: entry keyed to the calendar.
  if (/\bmonth\b/.test(entry)) {
    const a = entry.match(/month\s*>=\s*(\d+)/);
    const b = entry.match(/month\s*<=\s*(\d+)/);
    const mA = (a && MONTHS[+a[1]]) || "Nov";
    const mB = (b && MONTHS[+b[1]]) || "Apr";
    return {
      kind: "seasonal",
      label: `${mA}–${mB} long`,
      aria: `illustration of the mechanic: a price path with the ${mA} to ${mB} holding window shaded; outside the window the strategy sits in cash.`,
      maLens,
      hasLower: false,
    };
  }

  // 3 · Rotation: ranked menu, one slot — hold the leader, switch on momentum.
  if (spec.ranking_field && (spec.max_positions ?? 0) === 1) {
    const lagInd = named.find((x) => x.type === "lag" && x.source === "close" && x.length);
    const months = lagInd?.length ? Math.round(lagInd.length / 21) : null;
    return {
      kind: "rotation",
      label: months ? `${months}-mo leader switch` : "leader switch",
      aria: "illustration of the mechanic: two asset lines diverging, with the switch point marked where momentum leadership changes hands.",
      maLens,
      hasLower: false,
    };
  }

  // 4 · Band reversion: a stddev envelope in the entry rule.
  const sdInd = named.find((x) => x.type === "stddev" && refd(x.name));
  if (sdInd) {
    const k = entry.match(/(\d+(?:\.\d+)?)\s*\*\s*[a-z0-9_]*stddev/i);
    return {
      kind: "band",
      label: `−${k ? k[1] : "2"}σ touch`,
      aria: "illustration of the mechanic: price piercing the lower band of a volatility envelope, then snapping back toward the middle band.",
      maLens,
      hasLower: false,
    };
  }

  // 5 · Oscillator: an RSI bought oversold (rsi_x < threshold in the entry).
  for (const x of named) {
    if (x.type !== "rsi") continue;
    const mt = entry.match(new RegExp(`\\b${x.name}\\b\\s*<\\s*(\\d+(?:\\.\\d+)?)`));
    if (mt) {
      return {
        kind: "oscillator",
        label: `RSI${x.length ? ` ${x.length}` : ""} < ${mt[1]}`,
        aria: `illustration of the mechanic: an RSI pane below the price dipping into the shaded oversold zone, with the entry marked where it crosses below ${mt[1]}.`,
        maLens,
        hasLower: false,
      };
    }
  }

  // 6 · Dip-recovery: price below its own lagged value by a fixed percent.
  const dm = entry.match(/close\s*<\s*lag\(\s*close\s*,\s*(\d+)\s*\)\s*\*\s*(0?\.\d+)/);
  if (dm) {
    const pct = Math.round((1 - parseFloat(dm[2])) * 100);
    return {
      kind: "dip",
      label: `${pct}% dip in ${dm[1]}d`,
      aria: "illustration of the mechanic: a sharp dip inside an intact uptrend, with the entry arrow marked at the recovery.",
      maLens,
      hasLower: false,
    };
  }

  // 7 · Channel breakout: a rolling_max referenced by the entry (directly or
  //     via a lag alias like high_20_prev).
  const rollMaxInds = named.filter((x) => x.type === "rolling_max");
  let chan: (Indicator & { name: string }) | null =
    rollMaxInds.find((x) => refd(x.name)) ?? null;
  if (!chan) {
    for (const x of named) {
      if (x.type !== "lag" || !x.source) continue;
      const src = rollMaxInds.find((rmi) => rmi.name === x.source);
      if (src && refd(x.name)) {
        chan = src;
        break;
      }
    }
  }
  if (chan) {
    const len = chan.length ?? 20;
    const intraday = /\d+m$/.test(`${spec.backtest_timeframe ?? "1d"}`);
    const base = len === 252 ? "52-wk high" : `${len}-${intraday ? "bar" : "day"} high`;
    const near = new RegExp(`(?:close|open)\\s*>=?\\s*${chan.name}\\s*\\*\\s*0?\\.\\d+`).test(entry);
    return {
      kind: "channel",
      label: near ? `near ${base}` : `${base} break`,
      aria: near
        ? `illustration of the mechanic: price holding within a few percent of its ${base}, with the qualifying candle highlighted.`
        : `illustration of the mechanic: price breaking above its ${base} channel line, with the breakout candle highlighted.`,
      maLens,
      hasLower: named.some((x) => x.type === "rolling_min"),
    };
  }

  // 8 · Trend stack: three or more price MAs aligned in the entry rule.
  if (maLens.length >= 3) {
    return {
      kind: "stack",
      label: `${maLens.join("/")} stacked`,
      aria: "illustration of the mechanic: rising moving averages stacked in order beneath price — the trend alignment this strategy requires before entering.",
      maLens,
      hasLower: false,
    };
  }

  // 9 · MA cross: crosses_above(...) or a two-MA lagged cross pattern.
  const cab = entry.match(/crosses_above\(\s*([a-z0-9_]+)\s*,\s*([a-z0-9_]+)\s*\)/i);
  if (cab || (maRefs.length === 2 && /lag\(/.test(entry))) {
    let fast: Indicator | undefined;
    let slow: Indicator | undefined;
    if (cab) {
      fast = named.find((x) => x.name === cab[1]);
      slow = named.find((x) => x.name === cab[2]);
    }
    if (!fast || !slow) {
      const sorted = [...maRefs].sort((a, b) => (a.length ?? 0) - (b.length ?? 0));
      fast = sorted[0];
      slow = sorted[1];
    }
    const label =
      fast?.length && slow?.length
        ? `${fast.type === "ema" ? "EMA" : "SMA"} ${fast.length}×${slow.length} cross`
        : "MA cross";
    return {
      kind: "ma-cross",
      label,
      aria: "illustration of the mechanic: a fast moving average crossing above a slow one, with the entry marked at the crossover dot.",
      maLens,
      hasLower: false,
    };
  }

  // 10 · Generic fallback: price plus whatever indicators the rules reference,
  //      so future strategies get a correct preview automatically.
  return {
    kind: "generic",
    label: "rule-based entry",
    aria: "illustration: a stylized price chart with this strategy's indicator lines.",
    maLens,
    hasLower: false,
  };
}

/* ── motif scenes ───────────────────────────────────────────────────────── */

function sceneMaCross(r: Rng): ReactNode {
  const closes = mkSeries((i, t) => 0.25 + 1.7 * (t - 0.42) ** 2 + (r() - 0.5) * 0.04);
  const cs = buildCandles(closes, r);
  const fast = sma(closes, 3);
  const slow = sma(closes, 9);
  let ci = 13;
  for (let i = 6; i < N; i++) {
    if (fast[i] > slow[i] && fast[i - 1] <= slow[i - 1]) {
      ci = i;
      break;
    }
  }
  return (
    <>
      {grid()}
      {column(ci)}
      {candleMarks(cs)}
      <polyline points={linePts(slow)} fill="none" stroke="var(--muted)" strokeWidth={1.4} />
      <polyline points={linePts(fast)} fill="none" stroke="var(--accent)" strokeWidth={1.7} />
      {dot(ci, (fast[ci] + slow[ci]) / 2)}
    </>
  );
}

function sceneChannel(hasLower: boolean, r: Rng): ReactNode {
  const closes = mkSeries((i) =>
    i < 16
      ? 0.32 + 0.05 * Math.sin(i * 1.05) + (r() - 0.5) * 0.05
      : 0.42 + (0.43 * (i - 16)) / 7 + (r() - 0.5) * 0.03,
  );
  const cs = buildCandles(closes, r);
  const upper = rollMax(cs.map((k) => k.h), 7);
  const lower = rollMin(cs.map((k) => k.l), 7);
  let bi = 17;
  for (let i = 13; i < N; i++) {
    if (closes[i] > upper[i - 1] + 0.004) {
      bi = i;
      break;
    }
  }
  return (
    <>
      {grid()}
      {column(bi)}
      {candleMarks(cs)}
      {hasLower && (
        <polyline
          points={linePts(lower)}
          fill="none"
          stroke="var(--faint)"
          strokeWidth={1.1}
          strokeDasharray="3 3"
        />
      )}
      <polyline points={linePts(upper)} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
      {dot(bi, closes[bi])}
    </>
  );
}

function sceneOscillator(r: Rng): ReactNode {
  const pB = 80; // price pane bottom
  const oT = 90; // oscillator pane top
  const closes = mkSeries(
    (i, t) =>
      0.66 - 0.12 * t - 0.16 * gauss(i, 13.5, 1.6) + (i > 16 ? (0.1 * (i - 16)) / 7 : 0) + (r() - 0.5) * 0.02,
  );
  const cs = buildCandles(closes, r);
  const ma = sma(closes, 9);
  const rsi = closes.map((c, i) => Math.min(0.94, Math.max(0.06, 0.55 + (c - closes[Math.max(0, i - 2)]) * 4.5)));
  const zoneV = 0.32;
  let ti = 13;
  for (let i = 3; i < N; i++) {
    if (rsi[i] <= zoneV) {
      ti = i;
      break;
    }
  }
  const yZone = yAt(zoneV, oT, PB);
  return (
    <>
      {grid(PT, pB)}
      <g stroke="var(--hairline)" strokeWidth={1}>
        <line x1={X0} x2={X1} y1={oT} y2={oT} />
        <line x1={X0} x2={X1} y1={PB} y2={PB} />
      </g>
      {/* oversold zone: the strategy's active-trigger region */}
      <rect x={X0} y={fx(yZone)} width={X1 - X0} height={fx(PB - yZone)} fill="var(--accent-soft)" />
      <line x1={X0} x2={X1} y1={fx(yZone)} y2={fx(yZone)} stroke="var(--hairline-strong)" strokeWidth={1} strokeDasharray="3 3" />
      {column(ti, PT, PB)}
      {candleMarks(cs, PT, pB)}
      <polyline points={linePts(ma, PT, pB)} fill="none" stroke="var(--muted)" strokeWidth={1.3} />
      <polyline points={linePts(rsi, oT, PB)} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
      {dot(ti, rsi[ti], oT, PB)}
    </>
  );
}

function sceneBand(r: Rng): ReactNode {
  const closes = mkSeries(
    (i, t) => 0.58 - 0.02 * t + 0.035 * Math.sin(i * 0.8) - 0.26 * gauss(i, 15, 1.5) + (r() - 0.5) * 0.03,
  );
  const cs = buildCandles(closes, r);
  const mid = sma(closes, 6);
  const sd = rollStd(closes, 6);
  const upper = mid.map((m, i) => m + sd[i] * 1.45);
  const lower = mid.map((m, i) => m - sd[i] * 1.45);
  const ti = argMin(closes);
  return (
    <>
      {grid()}
      {column(ti)}
      {candleMarks(cs)}
      <polyline points={linePts(upper)} fill="none" stroke="var(--muted)" strokeWidth={1.1} strokeDasharray="3 3" />
      <polyline points={linePts(lower)} fill="none" stroke="var(--muted)" strokeWidth={1.1} strokeDasharray="3 3" />
      <polyline points={linePts(mid)} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
      {dot(ti, closes[ti])}
    </>
  );
}

function sceneDip(r: Rng): ReactNode {
  // Slope shallower than the dip depth, so the dip is the global low.
  const closes = mkSeries(
    (i, t) => 0.34 + 0.3 * t + 0.02 * Math.sin(i * 0.9) - 0.22 * gauss(i, 14, 1.5) + (r() - 0.5) * 0.02,
  );
  const cs = buildCandles(closes, r);
  const ma = sma(closes, 9);
  const ti = Math.min(argMin(closes) + 1, N - 1);
  const ax = fx(xAt(ti));
  const yTip = fx(yAt(closes[ti]) + 7);
  return (
    <>
      {grid()}
      {column(ti)}
      {candleMarks(cs)}
      <polyline points={linePts(ma)} fill="none" stroke="var(--muted)" strokeWidth={1.4} />
      {/* recovery arrow at the trigger candle */}
      <path
        d={`M ${ax} ${fx(yAt(closes[ti]) + 18)} L ${ax} ${yTip} M ${fx(xAt(ti) - 3.2)} ${fx(yAt(closes[ti]) + 10.5)} L ${ax} ${yTip} L ${fx(xAt(ti) + 3.2)} ${fx(yAt(closes[ti]) + 10.5)}`}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

function sceneStack(maLens: number[], r: Rng): ReactNode {
  const closes = mkSeries((i, t) => 0.2 + 0.58 * t + 0.02 * Math.sin(i * 0.9) + (r() - 0.5) * 0.016);
  const cs = buildCandles(closes, r);
  const m1 = sma(closes, 3);
  const m2 = sma(closes, 7);
  const m3 = sma(closes, 12);
  let ti = 10;
  for (let i = 8; i < N; i++) {
    if (m1[i] > m2[i] && m2[i] > m3[i] && closes[i] > m1[i]) {
      ti = i;
      break;
    }
  }
  return (
    <>
      {grid()}
      {column(ti)}
      {candleMarks(cs)}
      <polyline points={linePts(m3)} fill="none" stroke="var(--faint)" strokeWidth={1.3} />
      <polyline points={linePts(m2)} fill="none" stroke="var(--muted)" strokeWidth={1.4} />
      <polyline points={linePts(m1)} fill="none" stroke="var(--accent)" strokeWidth={1.6} />
      {dot(ti, m1[ti])}
    </>
  );
}

function sceneRotation(r: Rng): ReactNode {
  const a = mkSeries((i, t) => 0.32 + 0.5 * t + 0.03 * Math.sin(i * 0.8) + (r() - 0.5) * 0.02);
  const b = mkSeries((i, t) => 0.52 + 0.3 * t - 0.55 * t * t + 0.025 * Math.sin(i * 0.7 + 2) + (r() - 0.5) * 0.02);
  let ci = 10;
  for (let i = 3; i < N; i++) {
    if (a[i] > b[i] && a[i - 1] <= b[i - 1]) {
      ci = i;
      break;
    }
  }
  return (
    <>
      {grid()}
      {column(ci)}
      {/* the asset being compared against — comparison color + dash, never color alone */}
      <polyline points={linePts(b)} fill="none" stroke="var(--prev-run)" strokeWidth={1.5} strokeDasharray="5 3" />
      {/* the held leader: faded before the switch, full-strength after */}
      <polyline points={linePts(a.slice(0, ci + 1))} fill="none" stroke="var(--accent)" strokeWidth={1.4} opacity={0.55} />
      <polyline points={linePts(a.slice(ci), PT, PB, ci)} fill="none" stroke="var(--accent)" strokeWidth={2} />
      {dot(ci, a[ci])}
    </>
  );
}

function sceneSeasonal(r: Rng): ReactNode {
  const closes = mkSeries((i, t) => 0.3 + 0.38 * t + 0.045 * Math.sin(i * 0.7) + (r() - 0.5) * 0.03);
  const cs = buildCandles(closes, r);
  const w0 = 6;
  const w1 = 17;
  const shadeX = fx(xAt(w0) - STEP / 2);
  const shadeW = fx(xAt(w1) + STEP / 2 - (xAt(w0) - STEP / 2));
  return (
    <>
      {grid()}
      {/* the held calendar window — active state, shaded */}
      <rect x={shadeX} y={PT} width={shadeW} height={PB - PT} fill="var(--accent-soft)" />
      <g stroke="var(--hairline-strong)" strokeWidth={1}>
        <line x1={shadeX} x2={shadeX} y1={PT} y2={PB} />
        <line x1={fx(xAt(w1) + STEP / 2)} x2={fx(xAt(w1) + STEP / 2)} y1={PT} y2={PB} />
      </g>
      {candleMarks(cs, PT, PB, (i) => i < w0 || i > w1)}
      {dot(w0, closes[w0])}
    </>
  );
}

function sceneVwap(r: Rng): ReactNode {
  const closes = mkSeries(
    (i) => 0.62 + 0.015 * Math.sin(i * 1.1) - 0.18 * gauss(i, 12.5, 1.9) + (i > 17 ? 0.02 : 0) + (r() - 0.5) * 0.02,
  );
  const cs = buildCandles(closes, r);
  const vwap = closes.map((_, i) => {
    const s = closes.slice(0, i + 1);
    return s.reduce((x, y) => x + y, 0) / s.length;
  });
  const ti = argMin(closes);
  return (
    <>
      {grid()}
      {column(ti)}
      {candleMarks(cs)}
      <polyline points={linePts(vwap)} fill="none" stroke="var(--accent)" strokeWidth={1.6} />
      {dot(ti, closes[ti])}
    </>
  );
}

function sceneGeneric(maLens: number[], r: Rng): ReactNode {
  const closes = mkSeries((i, t) => 0.32 + 0.4 * t + 0.03 * Math.sin(i * 0.8) + (r() - 0.5) * 0.03);
  const cs = buildCandles(closes, r);
  const windows = maLens.length >= 2 ? [4, 10] : maLens.length === 1 ? [7] : [];
  const strokes = ["var(--accent)", "var(--muted)"];
  return (
    <>
      {grid()}
      {candleMarks(cs)}
      {windows.map((w, i) => (
        <polyline
          key={w}
          points={linePts(sma(closes, w))}
          fill="none"
          stroke={strokes[i] ?? "var(--faint)"}
          strokeWidth={i === 0 ? 1.6 : 1.3}
        />
      ))}
      {dot(N - 1, closes[N - 1])}
    </>
  );
}

function renderScene(m: Motif, r: Rng): ReactNode {
  switch (m.kind) {
    case "ma-cross":
      return sceneMaCross(r);
    case "channel":
      return sceneChannel(m.hasLower, r);
    case "oscillator":
      return sceneOscillator(r);
    case "band":
      return sceneBand(r);
    case "dip":
      return sceneDip(r);
    case "stack":
      return sceneStack(m.maLens, r);
    case "rotation":
      return sceneRotation(r);
    case "seasonal":
      return sceneSeasonal(r);
    case "vwap":
      return sceneVwap(r);
    default:
      return sceneGeneric(m.maLens, r);
  }
}

/* ── component ──────────────────────────────────────────────────────────── */

export default function StrategyPreview({
  spec,
  meta,
  className = "",
}: {
  spec: Spec;
  meta: TemplateMeta;
  className?: string;
}) {
  const motif = deriveMotif(spec);
  const rng = makeRng(seedFrom(`${spec?.name ?? meta.display_name}::${motif.kind}`));
  return (
    <div
      className={`relative overflow-hidden rounded-(--radius-tag) border border-hairline bg-background ${className}`}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${meta.display_name} — ${motif.aria}`}
        className="block h-auto w-full"
      >
        {renderScene(motif, rng)}
        <text
          x={X0}
          y={18}
          fontSize={11}
          fill="var(--muted)"
          fontFamily="var(--font-stack-mono)"
          letterSpacing="0.02em"
        >
          {motif.label}
        </text>
      </svg>
      {/* Truth rule: this is a teaching illustration, never data. */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-2 bottom-1 text-caption text-faint"
      >
        illustration
      </span>
    </div>
  );
}
