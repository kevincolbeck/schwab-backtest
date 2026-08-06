"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

/** "Share this record" (P1-3) — copies the record's public URL and offers the
 *  square social card for download.
 *
 *  Deliberately NOT a Web Share API call: on desktop that silently does
 *  nothing, and the two things a person actually wants here are the link and
 *  the image. Copy is the primary action; the download is a plain anchor so
 *  it works without JS and can be right-click-saved.
 */
export default function ShareRecord({
  slug,
  name,
}: {
  slug: string;
  name: string;
}) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    const url = `${window.location.origin}/strategy/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked (insecure context / permissions) — the download
         link still works, and the URL is in the address bar regardless. */
    }
  };

  // Filesystem-safe filename from the strategy name.
  const fileName = `${slug.replace(/[^a-z0-9-]/gi, "-")}-record.png`;

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={copyLink}>
        {copied ? "Link copied!" : "Share this record"}
      </Button>
      <a
        href={`/strategy/${slug}/card`}
        download={fileName}
        className="focus-ring rounded-(--radius-control) border border-hairline px-2.5 py-1.5 text-xs text-muted transition-colors duration-(--dur-micro) hover:border-hairline-strong hover:text-ink"
        title={`Download a square social card for ${name} (1080×1080 PNG)`}
      >
        Download card
      </a>
    </div>
  );
}
