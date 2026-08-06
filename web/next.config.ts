import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in the user home dir otherwise makes Next guess the wrong root.
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [
      {
        // The app had NO framing protection at all — every page, including the
        // lab and the account pages, could be iframed by anyone. Deny it
        // site-wide. frame-ancestors is the modern control and beats
        // X-Frame-Options where both are understood; the older header stays
        // for clients that only speak that.
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      {
        // ...except the embed widget, whose entire job is to be framed on
        // someone else's site (§8). It is a deliberate, narrow exception: the
        // route renders PUBLIC ledger data only, has no session, no forms and
        // no same-origin privileges worth stealing, so it cannot be
        // clickjacked into doing anything.
        source: "/embed/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
          { key: "X-Frame-Options", value: "" },
          // Cheap for the host page; the record only changes once a day.
          { key: "Cache-Control", value: "public, max-age=300, s-maxage=1800" },
        ],
      },
    ];
  },
};

export default nextConfig;
