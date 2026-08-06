import { ImageResponse } from "next/og";
import { fmtSignedPct } from "@/lib/format";
import { CARD, DISCLAIMER_LINE, getRecord, toCardData } from "@/lib/server/recordCard";

/** Square (1080x1080) downloadable record card — P1-3's "download a square
 *  image sized for social". The landscape opengraph-image is what platforms
 *  scrape automatically; this is what a person saves and posts by hand.
 *
 *  A route handler rather than a file convention because Next's
 *  opengraph-image/twitter-image conventions own the scraped sizes; this one
 *  needs its own URL so the share button can link to it with `download`.
 *
 *  Both cards render from lib/server/recordCard.ts so what a record CLAIMS
 *  can never differ between the two. */

const SIZE = { width: 1080, height: 1080 };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const data = await getRecord(slug);
  const { BG, PANEL, HAIRLINE, INK, MUTED, ACCENT, GAIN, LOSS } = CARD;

  if (!data) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: BG,
            color: INK,
            padding: 80,
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ display: "flex", fontSize: 46, fontWeight: 600 }}>
            Record not found
          </div>
          <div style={{ display: "flex", fontSize: 26, color: MUTED, marginTop: 18 }}>
            chatbacktest.com — the public forward-test ledger
          </div>
        </div>
      ),
      SIZE,
    );
  }

  const card = toCardData(data);
  const fwdColor =
    card.forwardPct > 0 ? GAIN : card.forwardPct < 0 ? LOSS : INK;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: BG,
          color: INK,
          padding: "0 72px 56px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            height: 8,
            width: "100%",
            background: `linear-gradient(90deg, ${ACCENT}, rgba(77, 162, 255, 0))`,
          }}
        />

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 52,
          }}
        >
          <div style={{ display: "flex", fontSize: 34, fontWeight: 600 }}>
            Chat·Backtest
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              color: ACCENT,
              textTransform: "uppercase",
              letterSpacing: 4,
            }}
          >
            The Ledger
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", fontSize: 56, fontWeight: 600, lineHeight: 1.15 }}>
            {card.name}
          </div>

          <div style={{ display: "flex", fontSize: 168, fontWeight: 600, color: fwdColor, marginTop: 26 }}>
            {fmtSignedPct(card.forwardPct, 2)}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: MUTED, marginTop: 6 }}>
            forward return
          </div>
          {/* Never lets a short record read as proof. */}
          <div style={{ display: "flex", fontSize: 30, marginTop: 14 }}>
            {card.statusLabel}
          </div>

          {(card.cagr !== null || card.sharpe !== null) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 34,
                marginTop: 34,
                borderTop: `1px solid ${HAIRLINE}`,
                paddingTop: 26,
              }}
            >
              <div style={{ display: "flex", fontSize: 24, color: MUTED }}>
                backtest (hypothetical)
              </div>
              {card.cagr !== null && (
                <div style={{ display: "flex", fontSize: 30 }}>
                  CAGR {fmtSignedPct(card.cagr, 1)}
                </div>
              )}
              {card.sharpe !== null && (
                <div style={{ display: "flex", fontSize: 30 }}>
                  Sharpe {card.sharpe.toFixed(2)}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 30 }}>
            <div
              style={{
                display: "flex",
                fontSize: 22,
                color: MUTED,
                backgroundColor: PANEL,
                border: `1px solid ${HAIRLINE}`,
                borderRadius: 999,
                padding: "10px 24px",
              }}
            >
              frozen spec · append-only
            </div>
            <div style={{ display: "flex", fontSize: 22, color: MUTED }}>
              spec {card.specHash}
            </div>
          </div>
        </div>

        {/* Watermark / footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${HAIRLINE}`,
            paddingTop: 26,
          }}
        >
          <div style={{ display: "flex", fontSize: 21, color: MUTED, maxWidth: 700 }}>
            {DISCLAIMER_LINE}
          </div>
          <div style={{ display: "flex", fontSize: 22, color: ACCENT }}>
            chatbacktest.com
          </div>
        </div>
      </div>
    ),
    SIZE,
  );
}
