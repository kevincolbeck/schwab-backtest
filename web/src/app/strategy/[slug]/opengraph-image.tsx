import { ImageResponse } from "next/og";
import { fmtSignedPct } from "@/lib/format";
import { BACKTEST_API_URL } from "@/lib/server/backend";
import type { StrategyPagePayload } from "@/lib/types";

export const alt =
  "Forward-test record card — simulated performance for research and education, not financial advice.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Design tokens v2, dark values (the card commits to the dark look — see globals.css).
const BG = "#07090e";
const PANEL = "#0c0f16";
const HAIRLINE = "rgba(148, 163, 184, 0.18)";
const INK = "#edf0f7";
const MUTED = "#8a94a6";
const ACCENT = "#8b7cf6";
const GAIN = "#089981";
const LOSS = "#f23645";

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

/** Shared frame: dark bg, violet top strip, eyebrow header, disclaimer footer. */
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
          background: `linear-gradient(90deg, ${ACCENT}, rgba(139, 124, 246, 0))`,
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
        <div style={{ fontSize: 28, fontWeight: 700 }}>Chat·Backtest</div>
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
            <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.15 }}>
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

  const { deployment, summary } = data;
  const fwd = summary.forward_return_pct;
  const fwdColor = fwd > 0 ? GAIN : fwd < 0 ? LOSS : INK;
  const name =
    deployment.name.length > 70
      ? `${deployment.name.slice(0, 69)}…`
      : deployment.name;

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
          <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.15 }}>
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
            <div style={{ fontSize: 132, fontWeight: 700, color: fwdColor }}>
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
              <div style={{ fontSize: 30, marginTop: 8 }}>
                {summary.days_live} trading days live
              </div>
            </div>
          </div>
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
            <div style={{ fontSize: 22, color: MUTED }}>
              spec {deployment.spec_hash.slice(0, 12)}
            </div>
          </div>
        </div>
      </Frame>
    ),
    { ...size },
  );
}
