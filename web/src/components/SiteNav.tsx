import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import NavAuthButton from "@/components/NavAuthButton";
import { serverSession } from "@/lib/supabase/server";

const LINKS = [
  { label: "The Lab", href: "/playground" },
  { label: "Library", href: "/library" },
  { label: "Markets", href: "/markets" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Docs", href: "/docs" },
  { label: "Pricing", href: "/pricing" },
];

export default async function SiteNav() {
  const session = await serverSession();
  return (
    <nav className="glass sticky top-0 z-40 border-b border-hairline">
      <div className="mx-auto flex h-12 w-full max-w-6xl items-center gap-5 px-4">
        <Link
          href="/"
          className="focus-ring rounded-md text-sm font-semibold tracking-tight"
        >
          chat<span className="text-accent">·</span>backtest
        </Link>
        <div className="hidden items-center gap-1 sm:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="focus-ring rounded-lg px-2.5 py-1.5 text-sm text-muted transition-colors hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="tnum hidden text-[10px] text-faint md:block">⌘K</span>
          <ThemeToggle />
          <NavAuthButton signedIn={Boolean(session)} />
        </div>
      </div>
    </nav>
  );
}
