"use client";

import { useState } from "react";

export default function PortalButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/stripe/portal", { method: "POST" });
            const body = await res.json();
            if (!res.ok) throw new Error(body.detail ?? "portal failed");
            window.location.href = body.url;
          } catch (e) {
            setError(e instanceof Error ? e.message : "portal failed");
            setBusy(false);
          }
        }}
        disabled={busy}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "Opening…" : "Manage billing"}
      </button>
      {error && <span className="ml-3 text-sm text-loss">{error}</span>}
    </span>
  );
}
