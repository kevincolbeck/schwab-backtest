import Image from "next/image";
import Link from "next/link";
import MobileMenu from "@/components/MobileMenu";
import NavAuthButton from "@/components/NavAuthButton";
import NavShell from "@/components/NavShell";
import ThemeToggle from "@/components/ThemeToggle";
import { NAV_LINKS } from "@/components/navLinks";
import { serverSession } from "@/lib/supabase/server";

export default async function SiteNav() {
  const session = await serverSession();
  return (
    <NavShell>
      <div className="mx-auto flex h-(--nav-h) w-full max-w-(--container-max) items-center gap-5 px-4">
        <Link
          href="/"
          className="focus-ring flex items-center gap-2 rounded-(--radius-tag) text-sm font-semibold tracking-tight"
        >
          {/* The mark ships as a raster because it's a gradient logo, not an
              icon font. alt="" because the wordmark beside it already names
              the site — a screen reader shouldn't hear it twice. */}
          <Image
            src="/brand/chatbacktest-logo-400.png"
            alt=""
            width={22}
            height={22}
            priority
            className="shrink-0"
          />
          chat<span className="text-accent">·</span>backtest
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="focus-ring rounded-(--radius-control) px-2.5 py-1.5 text-sm text-muted transition-colors duration-(--dur-micro) hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <kbd
            title="Command palette"
            className="tnum hidden rounded-(--radius-tag) border border-hairline bg-panel-2 px-1.5 py-0.5 text-caption text-faint md:inline-block"
          >
            ⌘K
          </kbd>
          <ThemeToggle />
          <NavAuthButton signedIn={Boolean(session)} />
          <MobileMenu />
        </div>
      </div>
    </NavShell>
  );
}
