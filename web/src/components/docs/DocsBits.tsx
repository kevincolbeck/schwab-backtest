import Link from "next/link";
import type { ReactNode } from "react";

/* ── Shared docs building blocks ─────────────────────────────────────────────
   Server components used inside .docs-prose articles. Styling stays on-system:
   hairline borders, panel surfaces, accent for notes, warm amber for warnings,
   teal for the "honest" brand-voice callouts. */

type CalloutKind = "note" | "warn" | "honest";

const KIND_STYLES: Record<
  CalloutKind,
  { label: string; color: string; soft: string }
> = {
  note: {
    label: "Note",
    color: "var(--accent)",
    soft: "var(--accent-soft)",
  },
  warn: {
    label: "Heads up",
    color: "var(--warn)",
    soft: "var(--warn-soft)",
  },
  honest: {
    label: "Honestly",
    color: "var(--prev-run)",
    soft: "color-mix(in srgb, var(--prev-run) 9%, transparent)",
  },
};

export function Callout({
  kind,
  title,
  children,
}: {
  kind: CalloutKind;
  title?: string;
  children: ReactNode;
}) {
  const s = KIND_STYLES[kind];
  return (
    <aside
      className="docs-callout my-6 rounded-(--radius-card) border border-hairline p-4 pl-5"
      style={{
        background: s.soft,
        borderLeft: `3px solid ${s.color}`,
      }}
    >
      <p
        className="docs-callout-label text-caption font-semibold uppercase tracking-widest"
        style={{ color: s.color }}
      >
        {s.label}
        {title ? <span className="text-ink normal-case tracking-normal"> · {title}</span> : null}
      </p>
      <div className="docs-callout-body mt-2 text-sm leading-relaxed">{children}</div>
    </aside>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="docs-steps my-6 list-none space-y-0 p-0">{children}</ol>;
}

export function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="docs-step relative flex gap-4 pb-8 last:pb-2">
      {/* connector line — hidden on the last step via .docs-prose CSS */}
      <span
        aria-hidden
        className="docs-step-line absolute bottom-0 left-[13px] top-8 w-px bg-hairline-strong opacity-60"
      />
      <span
        aria-hidden
        className="tnum z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hairline bg-panel text-xs font-semibold text-accent"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="docs-step-title text-sm font-semibold text-ink">{title}</p>
        <div className="docs-step-body mt-1.5 text-sm leading-relaxed">{children}</div>
      </div>
    </li>
  );
}

type FooterLink = { href: string; label: string };

export function DocsFooterNav({ prev, next }: { prev?: FooterLink; next?: FooterLink }) {
  return (
    <nav
      aria-label="Docs pages"
      className="docs-footer-nav mt-12 grid gap-3 border-t border-hairline pt-6 sm:grid-cols-2"
    >
      {prev ? (
        <Link
          href={prev.href}
          className="focus-ring group card-hover rounded-(--radius-card) border border-hairline bg-panel px-4 py-3"
        >
          <span className="text-caption uppercase tracking-widest text-faint">
            ← Previous
          </span>
          <span className="mt-1 block text-sm font-medium text-ink group-hover:text-accent">
            {prev.label}
          </span>
        </Link>
      ) : (
        <span aria-hidden className="hidden sm:block" />
      )}
      {next ? (
        <Link
          href={next.href}
          className="focus-ring group card-hover rounded-(--radius-card) border border-hairline bg-panel px-4 py-3 text-right sm:col-start-2"
        >
          <span className="text-caption uppercase tracking-widest text-faint">
            Next →
          </span>
          <span className="mt-1 block text-sm font-medium text-ink group-hover:text-accent">
            {next.label}
          </span>
        </Link>
      ) : null}
    </nav>
  );
}
