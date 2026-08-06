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
  const [embedCopied, setEmbedCopied] = useState(false);

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

  // §8 creator embed: a live card for the creator's own site or link-in-bio.
  // An iframe rather than a script tag on purpose — a script would ask people
  // to run our code on their page, and there is nothing here that needs to.
  const copyEmbed = async () => {
    const src = `${window.location.origin}/embed/${slug}`;
    const snippet =
      `<iframe src="${src}" title="${name} — live forward-test record on Chat·Backtest" ` +
      `width="360" height="230" loading="lazy" style="border:0;max-width:100%"></iframe>`;
    try {
      await navigator.clipboard.writeText(snippet);
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 2000);
    } catch {
      /* clipboard blocked — the embed URL is still documented on the page. */
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
      <button
        type="button"
        onClick={copyEmbed}
        className="focus-ring tap-target rounded-(--radius-control) border border-hairline px-2.5 py-1.5 text-xs text-muted transition-colors duration-(--dur-micro) hover:border-hairline-strong hover:text-ink"
        title="Copy an iframe snippet that shows this record live on your own site"
      >
        {embedCopied ? "Embed copied!" : "Embed"}
      </button>
    </div>
  );
}
