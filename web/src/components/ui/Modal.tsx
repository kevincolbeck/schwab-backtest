"use client";

import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export default function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Latest-ref pattern, updated in an effect (not during render) so handlers
  // registered by the open-effect always call the current onClose.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Runs only on the open/close transition — parent re-renders (e.g. controlled
  // inputs inside the modal) must never re-trigger focus or scroll-lock churn.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        // Real focus trap: Tab cycles inside the dialog.
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
    // Focus the first focusable control (falls back to the panel itself).
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    const target = Array.from(focusables ?? []).find(
      (el) => el.offsetParent !== null && el.getAttribute("aria-label") !== "Close",
    );
    (target ?? panelRef.current)?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        role="presentation"
        aria-hidden="true"
        onClick={() => onCloseRef.current()}
        className="absolute inset-0 bg-overlay backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`glass relative w-full ${wide ? "max-w-3xl" : "max-w-md"} rounded-(--radius-card) border border-hairline-strong p-6 shadow-[var(--shadow-pop)] focus-ring`}
      >
        {title && <h2 className="mb-4 text-lg font-semibold">{title}</h2>}
        <button
          onClick={() => onCloseRef.current()}
          aria-label="Close"
          className="focus-ring absolute right-4 top-4 rounded-(--radius-tag) p-1 text-muted hover:text-ink"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
