import Link from "next/link";
import type { AnchorHTMLAttributes, HTMLAttributes } from "react";

type Pad = "none" | "sm" | "md";
const PADS: Record<Pad, string> = { none: "", sm: "p-4", md: "p-5" };

/** Base surface card (brief §3.3): bg-1 + hairline + card radius + lift
 *  shadow, all from `.card`. `interactive` adds the ONE site-wide hover
 *  behavior (slight lift + hairline brightens); `featured` adds the
 *  hover-only gloss ring — one featured item per section max (SYSTEM.md §5). */
export default function Card({
  interactive = false,
  featured = false,
  pad = "md",
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  featured?: boolean;
  pad?: Pad;
}) {
  return (
    <div
      className={`card ${interactive ? "card-hover" : ""} ${
        featured ? "gloss-ring-hover" : ""
      } ${PADS[pad]} ${className}`}
      {...props}
    />
  );
}

/** A whole-card link — always interactive, always focus-visible. */
export function CardLink({
  href,
  featured = false,
  pad = "md",
  className = "",
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  featured?: boolean;
  pad?: Pad;
}) {
  return (
    <Link
      href={href}
      className={`card card-hover focus-ring block ${
        featured ? "gloss-ring-hover" : ""
      } ${PADS[pad]} ${className}`}
      {...props}
    />
  );
}
