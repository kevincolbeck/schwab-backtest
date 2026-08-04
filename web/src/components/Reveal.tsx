"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/** THE scroll-reveal (brief: fade-up 16px / 500ms / 60ms sibling stagger /
 *  once / IntersectionObserver / reduced-motion guarded). All values come
 *  from motion tokens via the `.reveal-*` classes in globals.css.
 *
 *  Server-rendered content stays visible until JS mounts, so no-JS and
 *  reduced-motion users always see a finished page. Stagger: pass `index`
 *  (multiplies --reveal-stagger) or the legacy `delay` (seconds). */
export default function Reveal({
  children,
  delay = 0,
  index,
  className = "",
}: {
  children: ReactNode;
  /** Explicit delay in seconds (legacy API — still supported). */
  delay?: number;
  /** Sibling position; delay = index × --reveal-stagger (60ms). */
  index?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"static" | "out" | "in">("static");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      return; // stays visible, no animation
    }
    // Hide after the first paint (rAF) so the server-rendered content is never
    // blank without JS; the observer then reveals it once, on intersection.
    let revealed = false;
    const raf = requestAnimationFrame(() => {
      if (!revealed) setPhase("out");
    });
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          revealed = true;
          setPhase("in");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -60px 0px" },
    );
    io.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  const delayValue = delay
    ? `${delay}s`
    : index
      ? `calc(var(--reveal-stagger) * ${index})`
      : undefined;

  return (
    <div
      ref={ref}
      className={`${phase === "out" ? "reveal-out" : phase === "in" ? "reveal-in" : ""} ${className}`}
      style={delayValue ? ({ "--reveal-delay": delayValue } as CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
