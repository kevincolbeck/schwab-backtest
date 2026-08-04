import { ImageResponse } from "next/og";
import { fmtSignedPct } from "@/lib/format";
import { dayChange, getStockBundle } from "@/lib/server/stocks";

export const alt =
  "Settled-close stock card — informational end-of-day data for research and education, not financial advice.";
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
  "Settled end-of-day data for research/education. Not financial advice.";

function fmtPrice(v: number): string {
  return `$${v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
          Stocks · Settled daily
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
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const result = await getStockBundle(ticker);

  if (result.status !== "found") {
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
              Settled-close stock pages
            </div>
            <div style={{ fontSize: 28, color: MUTED, marginTop: 20 }}>
              End-of-day charts, key stats, and company news — one honest update
              per trading day.
            </div>
            <div style={{ fontSize: 22, color: MUTED, marginTop: 28 }}>
              Informational only · no ratings, no recommendations
            </div>
          </div>
        </Frame>
      ),
      { ...size },
    );
  }

  const { bundle } = result;
  const rawName = bundle.profile?.name?.trim() ?? "";
  const name = rawName.length > 60 ? `${rawName.slice(0, 59)}…` : rawName;
  const lastClose =
    bundle.stats?.last_close ??
    (bundle.bars.length ? bundle.bars[bundle.bars.length - 1].close : null);
  const asOf =
    bundle.stats?.as_of ??
    (bundle.bars.length ? bundle.bars[bundle.bars.length - 1].time : null);
  const change = dayChange(bundle.bars);
  const changeColor =
    change && change.pct > 0 ? GAIN : change && change.pct < 0 ? LOSS : MUTED;

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
          <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
            <div style={{ fontSize: 84, fontWeight: 600, lineHeight: 1.05 }}>
              {bundle.symbol}
            </div>
            {name && (
              <div style={{ fontSize: 34, color: MUTED }}>{name}</div>
            )}
          </div>
          {lastClose != null ? (
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 36,
                marginTop: 14,
              }}
            >
              <div style={{ fontSize: 124, fontWeight: 600 }}>
                {fmtPrice(lastClose)}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  paddingBottom: 26,
                }}
              >
                {change && (
                  <div style={{ fontSize: 40, color: changeColor }}>
                    {fmtSignedPct(change.pct, 2)}
                  </div>
                )}
                <div style={{ fontSize: 24, color: MUTED, marginTop: 6 }}>
                  {`last settled close${asOf ? ` · ${asOf}` : ""}`}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 32, color: MUTED, marginTop: 24 }}>
              Settled-close chart, key stats, and company news
            </div>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginTop: 26,
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
              Settled EOD closes · informational only
            </div>
            {bundle.profile?.industry && (
              <div style={{ fontSize: 22, color: MUTED }}>
                {bundle.profile.industry}
              </div>
            )}
          </div>
        </div>
      </Frame>
    ),
    { ...size },
  );
}
