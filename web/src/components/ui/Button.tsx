import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-background font-medium hover:bg-accent-hover btn-glow disabled:opacity-40",
  outline:
    "border border-hairline-strong text-ink hover:bg-panel-2 disabled:opacity-40",
  ghost: "text-muted hover:text-ink hover:bg-panel-2 disabled:opacity-40",
  danger: "bg-loss-soft text-loss border border-loss/30 hover:opacity-90 disabled:opacity-40",
};

const SIZES: Record<Size, string> = {
  sm: "px-2.5 py-1 text-xs rounded-lg",
  md: "px-4 py-2 text-sm rounded-[10px]",
  lg: "px-5 py-2.5 text-sm rounded-xl",
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 transition-colors duration-150 focus-ring ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}
