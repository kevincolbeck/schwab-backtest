import { ImageResponse } from "next/og";
import { fmtSignedPct } from "@/lib/format";
import { BACKTEST_API_URL } from "@/lib/server/backend";
import { toCardData } from "@/lib/server/recordCard";
import type { StrategyPagePayload } from "@/lib/types";

export const alt =
  "Forward-test record card — simulated performance for research and education, not financial advice.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Sanctioned hardcode (design/SYSTEM.md §12): OG renders off-DOM and cannot read
// CSS custom properties. These constants MUST mirror styles/tokens.css dark values —
// keep in sync when tokens change. The card commits to the dark look.
const BG = "#0c0f14"; // --bg-0
const PANEL = "#12151c"; // --bg-1
const HAIRLINE = "rgba(148, 163, 184, 0.22)"; // --hairline-strong (1px reads at OG scale)
const INK = "#e9edf4"; // --ink
const MUTED = "#98a2b3"; // --muted
const ACCENT = "#4da2ff"; // --accent
const GAIN = "#089981"; // --gain
const LOSS = "#f23645"; // --loss

const DISCLAIMER_LINE =
  "Simulated performance for research/education. Not financial advice.";

async function getStrategy(slug: string): Promise<StrategyPagePayload | null> {
  try {
    const res = await fetch(
      `${BACKTEST_API_URL}/strategy/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as StrategyPagePayload;
  } catch {
    return null;
  }
}

/** Shared frame: dark bg, accent top strip, eyebrow header, disclaimer footer. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: BG,
        color: INK,
        padding: "0 64px 44px",
      }}
    >
      <div
        style={{
          height: 6,
          width: "100%",
          background: `linear-gradient(90deg, ${ACCENT}, rgba(77, 162, 255, 0))`,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 40,
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 600 }}>Chat·Backtest</div>
        <div
          style={{
            fontSize: 20,
            color: ACCENT,
            textTransform: "uppercase",
            letterSpacing: 4,
          }}
        >
          The Ledger · Public record
        </div>
      </div>
      {children}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid ${HAIRLINE}`,
          paddingTop: 22,
        }}
      >
        <div style={{ fontSize: 20, color: MUTED }}>{DISCLAIMER_LINE}</div>
        <div style={{ fontSize: 20, color: ACCENT }}>chat·backtest</div>
      </div>
    </div>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getStrategy(slug);

  if (!data) {
    // Branded fallback — never ship a broken card.
    return new ImageResponse(
      (
        <Frame>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: 64, fontWeight: 600, lineHeight: 1.15 }}>
              The forward-test ledger
            </div>
            <div style={{ fontSize: 28, color: MUTED, marginTop: 20 }}>
              Timestamped, append-only, out-of-sample. Losers stay on the board.
            </div>
            <div style={{ fontSize: 22, color: MUTED, marginTop: 28 }}>
              Forward test · frozen spec · append-only ledger
            </div>
          </div>
        </Frame>
      ),
      { ...size },
    );
  }

  const card = toCardData(data);
  const fwd = card.forwardPct;
  const fwdColor = fwd > 0 ? GAIN : fwd < 0 ? LOSS : INK;
  const name = card.name;

  return new ImageResponse(
    (
      <Frame>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 52, fontWeight: 600, lineHeight: 1.15 }}>
            {name}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 40,
              marginTop: 18,
            }}
          >
            <div style={{ fontSize: 132, fontWeight: 600, color: fwdColor }}>
              {fmtSignedPct(fwd, 2)}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                paddingBottom: 30,
              }}
            >
              <div style={{ fontSize: 24, color: MUTED }}>forward return</div>
              <div style={{ fontSize: 26, marginTop: 8 }}>{card.statusLabel}</div>
            </div>
          </div>
          {(card.cagr !== null || card.sharpe !== null) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 30,
                marginTop: 22,
              }}
            >
              {/* Backtest figures, ALWAYS labelled hypothetical and kept
                  visually subordinate to the verified forward number — the
                  two are never merged (see design/SYSTEM.md + the ledger
                  non-negotiables). */}
              <div style={{ display: "flex", fontSize: 22, color: MUTED }}>
                backtest (hypothetical)
              </div>
              {card.cagr !== null && (
                <div style={{ display: "flex", fontSize: 26 }}>
                  CAGR {fmtSignedPct(card.cagr, 1)}
                </div>
              )}
              {card.sharpe !== null && (
                <div style={{ display: "flex", fontSize: 26 }}>
                  Sharpe {card.sharpe.toFixed(2)}
                </div>
              )}
            </div>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginTop: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 22,
                color: MUTED,
                backgroundColor: PANEL,
                border: `1px solid ${HAIRLINE}`,
                borderRadius: 999,
                padding: "8px 22px",
              }}
            >
              Forward test · frozen spec · append-only ledger
            </div>
            {/* display:flex is REQUIRED by Satori on any element with more
                than one child — "spec " plus the expression counts as two.
                Without it the whole route 500s, which is exactly how this
                card silently returned a broken preview in production from
                Phase G until P1-3. */}
            <div style={{ display: "flex", fontSize: 22, color: MUTED }}>
              spec {card.specHash}
            </div>
          </div>
        </div>
      </Frame>
    ),
    { ...size },
  );
}
