import { fmtSignedPct } from "@/lib/format";

/** Public site origin for share links (env-driven; production domain fallback). */
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://chatbacktest.com"
).replace(/\/+$/, "");

function XLogo({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
    </svg>
  );
}

/**
 * Share-to-X intent link — a plain anchor, no X API involved. Server-renderable
 * (no client JS). Rank is omitted from the post text when unknown.
 */
export default function ShareToX({
  name,
  path,
  forwardReturnPct,
  daysLive,
  rank,
  iconOnly = false,
}: {
  name: string;
  /** Site-relative strategy page path, e.g. `/strategy/my-slug`. */
  path: string;
  forwardReturnPct: number;
  daysLive: number;
  /** 1-based leaderboard rank; omit when unknown. */
  rank?: number;
  /** Compact icon-only rendering for table rows. */
  iconOnly?: boolean;
}) {
  const standing = rank ? `is #${rank} on` : "is on";
  const text = `"${name}" ${standing} the chat-to-backtest forward ledger — ${fmtSignedPct(
    forwardReturnPct,
    2,
  )} over ${daysLive} trading days. Receipts attached.`;
  const href = `https://x.com/intent/post?text=${encodeURIComponent(
    text,
  )}&url=${encodeURIComponent(`${SITE_URL}${path}`)}`;
  const label = `Share “${name}” on X`;

  if (iconOnly) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        title="Share on X"
        className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-(--radius-control) text-muted transition-colors duration-(--dur-micro) hover:bg-panel-2 hover:text-ink"
      >
        <XLogo size={13} />
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-(--radius-control) border border-hairline-strong px-4 text-sm text-ink transition-colors duration-(--dur-micro) hover:bg-panel-2"
    >
      <XLogo />
      Share on X
    </a>
  );
}
