import XLogo from "@/components/XLogo";

/** Link to the product's X account. The mark only — never the word "Twitter",
 *  which is both the old name and a worse affordance than the glyph people
 *  already recognise.
 *
 *  Icon-only links are the classic unlabelled-control bug, so the accessible
 *  name is carried explicitly and the hit area gets the coarse-pointer floor
 *  the rest of the site uses. */
export const X_PROFILE_URL = "https://x.com/chatbacktest";

export default function XProfileLink({
  size = 14,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <a
      href={X_PROFILE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat·Backtest on X (opens in a new tab)"
      className={`focus-ring tap-target inline-flex items-center justify-center rounded-(--radius-tag) text-muted transition-colors duration-(--dur-micro) hover:text-ink ${className}`}
    >
      <XLogo size={size} />
    </a>
  );
}
