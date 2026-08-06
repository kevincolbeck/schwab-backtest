import { CARD, VERIFY_DAYS, getRecord, toCardData } from "@/lib/server/recordCard";
import { SITE_URL } from "@/lib/seo";

/** §8 creator embed widget — a live forward-ledger record, framable anywhere.
 *
 *  A Route Handler, not a page: `app/layout.tsx` is the single root layout
 *  (nav, command palette, auth provider, footer, theme script), and a page
 *  would drag all of it into someone else's iframe.
 *
 *  Everything here is PUBLIC data. Private deployments never render because
 *  the service 404s them on GET /strategy/{slug}, which is the same gate the
 *  public strategy page uses — privacy is enforced upstream, not re-derived.
 *
 *  Honesty rules travel WITH the widget, because this is the one surface that
 *  appears where we have no other context to lean on:
 *   - a record under the verification window says "warming up", never
 *     presented as proof;
 *   - the forward number is labelled as simulated, on the card, always;
 *   - the watermark links back, so a reader can check the full record.
 *  Someone embedding this on a link-in-bio cannot strip those without
 *  rebuilding the card themselves.
 */

export const revalidate = 1800;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function shell(body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<meta name="robots" content="noindex">` +
      `<title>Chat·Backtest record</title><style>${STYLE}</style></head>` +
      `<body>${body}</body></html>`,
    {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        // Belt and braces: the route-level header in next.config.ts sets this
        // too, but a widget that silently stops being embeddable because of a
        // config change is a broken promise on someone else's website.
        "content-security-policy": "frame-ancestors *",
      },
    },
  );
}

const STYLE = `
*{box-sizing:border-box;margin:0}
body{font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  background:${CARD.BG};color:${CARD.INK};padding:14px;
  -webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none;display:block}
.card{border:1px solid ${CARD.HAIRLINE};border-radius:12px;background:${CARD.PANEL};
  padding:14px 16px}
.name{font-weight:600;font-size:15px;line-height:1.3;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-top:10px}
.ret{font-variant-numeric:tabular-nums;font-size:26px;font-weight:600;letter-spacing:-.02em}
.gain{color:${CARD.GAIN}}.loss{color:${CARD.LOSS}}.flat{color:${CARD.MUTED}}
.status{font-size:11px;color:${CARD.MUTED};text-align:right;line-height:1.35}
.meta{margin-top:8px;font-size:11px;color:${CARD.MUTED};
  font-variant-numeric:tabular-nums}
.foot{display:flex;align-items:center;justify-content:space-between;gap:8px;
  margin-top:12px;padding-top:10px;border-top:1px solid ${CARD.HAIRLINE};
  font-size:11px;color:${CARD.MUTED}}
.brand{color:${CARD.INK};font-weight:600}
.dot{color:${CARD.ACCENT}}
.note{font-size:10px;color:${CARD.MUTED};margin-top:6px;line-height:1.4}
`;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const data = await getRecord(slug);

  // Degrade, never error. This markup lives on someone else's page — a stack
  // trace or a blank frame there is our failure showing up in their design.
  if (!data) {
    return shell(
      `<div class="card"><div class="name">Record unavailable</div>` +
        `<div class="meta">This record isn&#39;t reachable right now.</div>` +
        `<div class="foot"><span><span class="brand">chat<span class="dot">·</span>backtest</span></span>` +
        `<span>chatbacktest.com</span></div></div>`,
      200,
    );
  }

  const card = toCardData(data);
  const href = `${SITE_URL}/strategy/${encodeURIComponent(slug)}`;
  const cls = card.forwardPct > 0 ? "gain" : card.forwardPct < 0 ? "loss" : "flat";
  const sign = card.forwardPct > 0 ? "+" : "";
  const backtest =
    card.cagr === null
      ? ""
      : `<div class="meta">Backtest (hypothetical): ${card.cagr.toFixed(1)}% CAGR` +
        (card.sharpe === null ? "" : ` · ${card.sharpe.toFixed(2)} Sharpe`) +
        `</div>`;

  return shell(
    `<a href="${esc(href)}" target="_blank" rel="noopener">
      <div class="card">
        <div class="name">${esc(card.name)}</div>
        <div class="row">
          <div class="ret ${cls}">${sign}${card.forwardPct.toFixed(2)}%</div>
          <div class="status">${esc(card.statusLabel)}<br>forward, simulated</div>
        </div>
        ${backtest}
        <div class="meta">spec ${esc(card.specHash)} · frozen at deploy</div>
        <div class="foot">
          <span class="brand">chat<span class="dot">·</span>backtest</span>
          <span>See the full record →</span>
        </div>
        <div class="note">
          Simulated forward test on closed-candle data. Not financial advice.
          Past performance does not predict future results.
        </div>
      </div>
    </a>`,
  );
}
