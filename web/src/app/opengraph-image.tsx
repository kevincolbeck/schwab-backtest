import { ImageResponse } from "next/og";

/* Site-wide default social card (P1-2: "OG tags render rich previews").
   Any route without its own opengraph-image inherits this one; /strategy and
   /stocks keep their data-driven cards. */

export const alt =
  "Chat·Backtest — AI backtesting for momentum and swing traders. Research and education, not financial advice.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Sanctioned hardcode (design/SYSTEM.md §12): OG renders off-DOM and cannot
// read CSS custom properties. Mirrors styles/tokens.css dark values — keep in
// sync when tokens change.
const BG = "#0c0f14"; // --bg-0
const PANEL = "#12151c"; // --bg-1
const HAIRLINE = "rgba(148, 163, 184, 0.22)"; // --hairline-strong
const INK = "#e9edf4"; // --ink
const MUTED = "#98a2b3"; // --muted
const ACCENT = "#4da2ff"; // --accent

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BG,
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 6, height: 34, background: ACCENT }} />
          {/* display:flex is required by Satori on any element with more than
              one child — plain text + <span> counts as several. */}
          <div style={{ display: "flex", fontSize: 30, color: INK, letterSpacing: -0.5 }}>
            <span>chat</span>
            <span style={{ color: ACCENT }}>·</span>
            <span>backtest</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 62,
              lineHeight: 1.1,
              color: INK,
              letterSpacing: -1.5,
              maxWidth: 940,
            }}
          >
            Test the setup you saw online — before you risk a dollar.
          </div>
          <div style={{ fontSize: 27, color: MUTED, maxWidth: 900, lineHeight: 1.35 }}>
            Describe a strategy in plain English. The AI writes the exact rules and
            backtests two decades in seconds.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `1px solid ${HAIRLINE}`,
            paddingTop: 26,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 21,
              color: ACCENT,
              background: PANEL,
              border: `1px solid ${HAIRLINE}`,
              borderRadius: 8,
              padding: "9px 18px",
            }}
          >
            They sell the dream. We sell the proof.
          </div>
          <div style={{ fontSize: 18, color: MUTED }}>
            Historical simulation · not financial advice
          </div>
        </div>
      </div>
    ),
    size,
  );
}
