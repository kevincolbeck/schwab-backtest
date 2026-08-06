"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NAV_LINKS } from "@/components/navLinks";

function BurgerIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6.5h14M3 13.5h14" />}
    </svg>
  );
}

/** Mobile nav (< sm): hamburger toggling a glass dropdown under the nav.
 *  Escape closes and restores focus; route changes close; body scroll locks
 *  while open; the scrim click closes. Reduced-motion: panel appears
 *  without the drop-in (globals.css guard). */
export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // A followed link changed the route â€” close the panel (state adjustment
  // during render, per react.dev "adjusting state when props change").
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="focus-ring tap-target flex h-8 w-8 items-center justify-center rounded-(--radius-control) border border-hairline text-muted transition-colors duration-(--dur-micro) hover:text-ink"
      >
        <BurgerIcon open={open} />
      </button>
      {open && (
        <>
          <div
            role="presentation"
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-x-0 bottom-0 top-(--nav-h) z-40 bg-overlay md:hidden"
          />
          <div
            id="mobile-nav-panel"
            className="menu-pop glass absolute inset-x-0 top-full z-50 border-b border-hairline md:hidden"
          >
            <nav aria-label="Site" className="mx-auto w-full max-w-(--container-max) px-4 py-3">
              <ul className="flex flex-col gap-0.5">
                {NAV_LINKS.map((l) => {
                  const active =
                    pathname === l.href || pathname.startsWith(`${l.href}/`);
                  return (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className={`focus-ring tap-target flex items-center rounded-(--radius-control) px-3 py-2.5 text-sm transition-colors duration-(--dur-micro) ${
                          active
                            ? "bg-accent-soft text-ink"
                            : "text-muted hover:bg-panel-2 hover:text-ink"
                        }`}
                      >
                        {l.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
