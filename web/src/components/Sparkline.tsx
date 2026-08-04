"use client";

import { useEffect, useRef, useState } from "react";

/** Tiny equity sparkline (pure SVG). Colors read the gain/loss tokens at
 *  paint time (CSS vars in inline style — theme-reactive for free).
 *
 *  Draw-in: the line draws left→right over --dur-slow (700ms) the first time
 *  it scrolls into view (IntersectionObserver, once). The server render is
 *  fully drawn, so no-JS and reduced-motion users always see the line. */
export default function Sparkline({
  values,
  width = 120,
  height = 28,
  baseline,
}: {
  values: number[];
  width?: number;
  height?: number;
  /** Reference value (starting capital): above = gain color, below = loss. */
  baseline?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [phase, setPhase] = useState<"static" | "hidden" | "drawn">("static");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      return; // stays fully drawn, no animation
    }
    // Erase after the first paint (rAF) so the server render stays drawn for
    // no-JS; the observer then draws it in once, on intersection.
    let drawn = false;
    const raf = requestAnimationFrame(() => {
      if (!drawn) setPhase("hidden");
    });
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          drawn = true;
          setPhase("drawn");
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  if (!values || values.length < 2) {
    return <span className="text-caption text-muted">—</span>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map(
      (v, i) =>
        `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`,
    )
    .join(" ");
  const last = values[values.length - 1];
  const ref0 = baseline ?? values[0];
  const up = last >= ref0;
  return (
    <svg
      ref={ref}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Equity trend, ${up ? "up" : "down"} overall`}
    >
      <polyline
        points={points}
        fill="none"
        strokeWidth="1.5"
        pathLength={1}
        style={{
          stroke: up ? "var(--gain)" : "var(--loss)",
          ...(phase !== "static" && {
            strokeDasharray: 1,
            strokeDashoffset: phase === "hidden" ? 1 : 0,
            transition:
              phase === "drawn"
                ? "stroke-dashoffset var(--dur-slow) var(--ease-out)"
                : "none",
          }),
        }}
      />
    </svg>
  );
}
