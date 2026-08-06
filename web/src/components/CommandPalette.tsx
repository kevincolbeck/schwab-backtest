"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { fetchTemplates } from "@/lib/api";
import type { Template } from "@/lib/types";

const PAGES = [
  { label: "The Lab", href: "/playground" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Pricing", href: "/pricing" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Home", href: "/" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  // cmdk forwards its ref to the root div — the trap needs it to scope the
  // focusable query to the palette.
  const panelRef = useRef<HTMLDivElement>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // While open: Escape closes, page scroll locks, focus is TRAPPED and then
  // restored. The trap is not optional decoration — this dialog declares
  // aria-modal="true", and cmdk's bare <Command> does no Tab handling at all,
  // so without it Tab walked straight out of the palette into the nav and
  // page behind the scrim. Neither is inert, so a keyboard user ended up
  // operating controls they could not see, and aria-modal was a false
  // promise. Modal.tsx and DayPanel.tsx already do this correctly; this was
  // the one hand-written dialog that didn't.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      // Without this, focus falls to <body> and the next Tab restarts at the
      // top of the document — losing the user's place entirely.
      previouslyFocused?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (open && templates.length === 0) {
      fetchTemplates()
        .then((r) => setTemplates(r.templates))
        .catch(() => {});
    }
  }, [open, templates.length]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]"
    >
      <div
        role="presentation"
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-overlay backdrop-blur-sm"
      />
      <Command
        ref={panelRef}
        label="Command palette"
        className="glass relative w-full max-w-lg overflow-hidden rounded-(--radius-card) border border-hairline-strong shadow-[var(--shadow-pop)]"
      >
        <Command.Input
          autoFocus
          placeholder="Jump to a page or strategy template…"
          className="w-full border-b border-hairline bg-transparent px-4 py-3.5 text-sm text-ink placeholder:text-faint focus-ring"
        />
        <Command.List className="slim-scroll max-h-72 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-muted">
            Nothing found.
          </Command.Empty>
          <Command.Group
            heading="Pages"
            className="px-1 text-caption uppercase tracking-widest text-faint [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
          >
            {PAGES.map((p) => (
              <Command.Item
                key={p.href}
                value={p.label}
                onSelect={() => go(p.href)}
                className="cursor-pointer rounded-(--radius-control) tap-target px-3 py-2 text-sm text-ink data-[selected=true]:bg-accent-soft"
              >
                {p.label}
              </Command.Item>
            ))}
          </Command.Group>
          {templates.length > 0 && (
            <Command.Group
              heading="Templates"
              className="mt-1 px-1 text-caption uppercase tracking-widest text-faint [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
            >
              {templates.map((t) => (
                <Command.Item
                  key={t.id}
                  value={`${t.meta.display_name} template`}
                  onSelect={() => go(`/playground?template=${encodeURIComponent(t.id)}`)}
                  className="cursor-pointer rounded-(--radius-control) tap-target px-3 py-2 text-sm text-ink data-[selected=true]:bg-accent-soft"
                >
                  {t.meta.display_name}
                  <span className="ml-2 text-caption uppercase tracking-wide text-faint">
                    {t.meta.category}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
        <div className="border-t border-hairline px-4 py-2 text-caption text-faint">
          <span className="tnum">⌘K</span>{" "}to toggle · <span className="tnum">↵</span>{" "}to open
        </div>
      </Command>
    </div>
  );
}
