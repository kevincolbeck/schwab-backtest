import type { ReactNode } from "react";
import Reveal from "@/components/Reveal";

/** THE marketing section wrapper (brief §3.3 · SYSTEM.md §7). Every homepage
 *  and marketing section composes this one shell — identical rhythm, eyebrow
 *  grammar, and container everywhere is what unifies the site.
 *
 *  Anatomy: eyebrow (mono small-caps + accent tick — the eyebrow's ONLY
 *  accent) → heading → one short subcopy → content slot → a SINGLE CTA.
 *  Never two competing CTAs. App surfaces pass `tight` for the thinner
 *  --space-section-sm rhythm but keep the same container and grammar. */
export default function SectionShell({
  eyebrow,
  title,
  sub,
  children,
  cta,
  id,
  headingAs: Heading = "h2",
  hero = false,
  center = false,
  tight = false,
  className = "",
}: {
  /** Eyebrow label from the copy, e.g. "The Lab · What it does". */
  eyebrow?: string;
  title?: ReactNode;
  /** One short paragraph max (SYSTEM.md §7). */
  sub?: ReactNode;
  children?: ReactNode;
  /** The single CTA — one link or button, never two. */
  cta?: ReactNode;
  id?: string;
  /** Page hero sections pass "h1". */
  headingAs?: "h1" | "h2" | "h3";
  /** Display-size heading for the page hero. */
  hero?: boolean;
  center?: boolean;
  /** App-surface rhythm (--space-section-sm) instead of marketing rhythm. */
  tight?: boolean;
  className?: string;
}) {
  const hasHeader = Boolean(eyebrow || title || sub);
  return (
    <section
      id={id}
      className={`relative ${tight ? "py-(--space-section-sm)" : "py-(--space-section)"} ${className}`}
    >
      <div className="relative mx-auto w-full max-w-(--container-max) px-4 sm:px-6">
        {hasHeader && (
          <Reveal className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
            {eyebrow && (
              <p className="font-mono text-xs uppercase tracking-widest text-muted">
                <span aria-hidden className="mr-2 inline-block h-2 w-0.5 bg-accent" />
                {eyebrow}
              </p>
            )}
            {title && (
              <Heading
                className={`${eyebrow ? "mt-4" : ""} font-semibold text-balance text-ink ${
                  hero ? "text-display" : "text-headline"
                }`}
              >
                {title}
              </Heading>
            )}
            {sub && (
              <p className={`mt-4 text-lg text-muted ${center ? "" : "max-w-prose"}`}>{sub}</p>
            )}
          </Reveal>
        )}
        {children && <div className={hasHeader ? "mt-10" : ""}>{children}</div>}
        {cta && <div className={`mt-10 flex ${center ? "justify-center" : ""}`}>{cta}</div>}
      </div>
    </section>
  );
}
