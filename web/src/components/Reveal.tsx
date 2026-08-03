"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/** Fade-up on scroll — subtle, 200ms, honors prefers-reduced-motion. */
export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, delay, ease: [0.21, 0.6, 0.35, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
