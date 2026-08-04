"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Sticky glass nav chrome (brief §3.3): backdrop-blur over the canvas with
 *  a hairline bottom border that fades in once the page scrolls. Content is
 *  server-rendered by SiteNav and passed through. */
export default function NavShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`glass sticky top-0 z-40 border-b transition-colors duration-(--dur-standard) ${
        scrolled ? "border-hairline" : "border-transparent"
      }`}
    >
      {children}
    </nav>
  );
}
