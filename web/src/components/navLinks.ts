/** Primary site navigation — the single source for the desktop nav and the
 *  mobile menu, so the two can never drift. */
export const NAV_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: "The Lab", href: "/playground" },
  { label: "Library", href: "/library" },
  { label: "Markets", href: "/markets" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Docs", href: "/docs" },
  { label: "Pricing", href: "/pricing" },
];
