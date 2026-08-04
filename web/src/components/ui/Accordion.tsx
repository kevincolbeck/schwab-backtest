import type { ReactNode } from "react";

/** FAQ accordion (brief §3.3) on native `<details>`/`<summary>` — keyboard
 *  and screen-reader semantics come free and survive without JS. The open
 *  chevron rotates (transform only) and the body eases in via `.acc-body`
 *  (globals.css), both reduced-motion guarded. */
export function Accordion({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`card divide-y divide-hairline overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

export function AccordionItem({
  summary,
  children,
  defaultOpen = false,
  name,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Shared name renders an exclusive accordion (native `details name`). */
  name?: string;
}) {
  return (
    <details className="group" open={defaultOpen || undefined} name={name}>
      <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-ink transition-colors duration-(--dur-micro) hover:bg-panel-2 [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="h-4 w-4 shrink-0 text-muted transition-transform duration-(--dur-standard) ease-(--ease-out) group-open:rotate-180 motion-reduce:transition-none"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </summary>
      <div className="acc-body px-5 pb-5 text-sm leading-relaxed text-muted">{children}</div>
    </details>
  );
}
