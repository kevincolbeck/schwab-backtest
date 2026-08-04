"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/* Sidebar sections — the docs sitemap. Slugs are the contract; edit with care. */
export const DOCS_SECTIONS: {
  title: string;
  links: { href: string; label: string }[];
}[] = [
  {
    title: "Getting started",
    links: [
      { href: "/docs", label: "Introduction" },
      { href: "/docs/first-backtest", label: "Your first backtest" },
      { href: "/docs/reading-results", label: "Reading the results" },
      { href: "/docs/credits", label: "Credits" },
    ],
  },
  {
    title: "The Lab",
    links: [
      { href: "/docs/chat", label: "Building by chat" },
      { href: "/docs/markets-timeframes", label: "Markets & timeframes" },
      { href: "/docs/strategy-spec", label: "The strategy spec" },
    ],
  },
  {
    title: "The Ledger",
    links: [{ href: "/docs/forward-testing", label: "Forward testing" }],
  },
  {
    title: "Your arsenal",
    links: [
      { href: "/docs/export-pine", label: "Export to Pine Script" },
      { href: "/docs/export-python", label: "Export to Python" },
      { href: "/docs/manual-trading", label: "Manual trading" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/docs") return pathname === "/docs";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DocsSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      {/* Mobile: compact section jumper. */}
      <div className="mb-6 lg:hidden">
        <label htmlFor="docs-nav-select" className="sr-only">
          Docs page
        </label>
        <select
          id="docs-nav-select"
          value={
            DOCS_SECTIONS.flatMap((s) => s.links).find((l) =>
              isActive(pathname, l.href),
            )?.href ?? "/docs"
          }
          onChange={(e) => router.push(e.target.value)}
          className="focus-ring w-full rounded-lg border border-hairline bg-panel px-3 py-2 text-sm text-ink"
        >
          {DOCS_SECTIONS.map((section) => (
            <optgroup key={section.title} label={section.title}>
              {section.links.map((l) => (
                <option key={l.href} value={l.href}>
                  {l.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Desktop: sticky rail. */}
      <nav aria-label="Docs" className="hidden lg:block">
        {DOCS_SECTIONS.map((section) => (
          <div key={section.title} className="mb-6">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-faint">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.links.map((l) => {
                const active = isActive(pathname, l.href);
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={active ? "page" : undefined}
                      className={`focus-ring block rounded-lg border-l-2 py-1.5 pl-3 pr-2 text-sm transition-colors ${
                        active
                          ? "border-accent bg-accent-soft font-medium text-ink"
                          : "border-transparent text-muted hover:text-ink"
                      }`}
                    >
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
