import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "ring";
type Size = "sm" | "md" | "lg";

/* One control language (SYSTEM.md §8): every variant shares the control
   radius, the height scale, and the focus ring.
   primary   — accent fill; gloss ring appears on hover/focus only.
   secondary — hairline ghost (brief §3.3). "outline" is its legacy alias.
   ring      — THE ring-CTA (brief §3.2): idle gloss ring + glow. One per
               page, the primary hero CTA only (SYSTEM.md §5).
   ghost     — quiet tertiary actions.
   danger    — destructive confirms (semantic loss color, never decorative). */
const VARIANTS: Record<Variant, string> = {
  primary:
    "gloss-ring-hover bg-accent font-medium text-background hover:bg-accent-hover disabled:opacity-40",
  secondary:
    "border border-hairline-strong text-ink hover:bg-panel-2 disabled:opacity-40",
  outline:
    "border border-hairline-strong text-ink hover:bg-panel-2 disabled:opacity-40",
  ghost: "text-muted hover:bg-panel-2 hover:text-ink disabled:opacity-40",
  danger: "bg-loss-soft text-loss border border-loss/30 hover:opacity-90 disabled:opacity-40",
  ring: "gloss-ring btn-glow bg-accent font-medium text-background hover:bg-accent-hover disabled:opacity-40",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-6 text-sm",
};

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-(--radius-control) transition-colors duration-(--dur-micro) focus-ring";

/** Class recipe for elements that must look like a Button but can't be one. */
export function buttonClasses(
  variant: Variant = "primary",
  size: Size = "md",
  className = "",
): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
}

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}

/** Link with button styling — for CTA anchors (fork / upgrade / explore). */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: Variant;
  size?: Size;
}) {
  return <Link href={href} className={buttonClasses(variant, size, className)} {...props} />;
}
