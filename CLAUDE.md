# CLAUDE.md — Product V2: "The Anything Trading-Strategy Lab"

> **RESUMING A BUILD SESSION? Read `docs/HANDOFF.md` FIRST** — it holds the
> exact resume point (what shipped, what's next, the per-item loop, hazards,
> and owner blockers), updated at the end of every session. This file is the
> standing product direction; `docs/CHATBACKTEST-BUILD.md` is the execution
> spec being worked top-to-bottom.

> V2 supersedes the V1 plan (2026-08-02) after launch. V1 shipped and its DoD passed on
> production (schwab-backtest.vercel.app). This doc is the standing product direction —
> refer to it every session; refine it here, never in chat-memory alone.

## The one-sentence vision

An AI trading-strategy lab where anyone — from a first-timer with an idea to a
quant-curious swing trader — builds ANY strategy (any market, any timeframe) in plain
English, proves it on decades of data in seconds inside a **futuristic, WOW-grade UI**,
and then stakes its reputation on a public, immutable forward-test ledger.

**Positioning stays: "They sell the dream. We sell the proof."**
Copy competitors (LuxAlgo) where things are commodity (auth, billing, layout patterns).
Be original where we differentiate: equity/drawdown visualization (keep — Kevin likes it),
per-trade candlestick forensics, forward ledger, social leaderboard.

## Non-negotiables (unchanged from V1 — never compromise)

- NO live trading, NO broker connections, NO order execution.
- NO buy/sell recommendations, NO price predictions. The AI edits specs, explains
  results, teaches concepts, and warns about pitfalls. Refusals stay polite.
- Disclaimer on every results/ledger surface: "Historical/paper simulation for research
  and education. Not financial advice. Past performance does not predict future results."
- Forward ledger stays append-only and frozen-spec immutable. Never merge forward and
  backtest curves. Losers stay on the leaderboard.
- Engine security: the AST expression allowlist (test_expression_security.py) must
  survive every engine change.

## What V2 changes (Kevin's directives, 2026-08-03)

| V1 | V2 |
|---|---|
| EOD-only, US stocks/ETFs | **Any timeframe** (1m→1d) and **any market Polygon serves** (all US stocks/ETFs + crypto), gated by plan/credits, editable via chat AND UI controls |
| Templates run logged-out; anonymous runs | ~~**Login required for the lab.**~~ *(Superseded 2026-08-05 by docs/CHATBACKTEST-BUILD.md P0-3: the first backtest is signup-free again — anonymous visitors get daily-timeframe template runs incl. chat-edited variants (IP-limited via trusted proxy header, `PROXY_SHARED_SECRET`), 3 AI chat messages/day, and explanations. Accounts gate custom specs, intraday, deploy, save, export. Pin: service/tests/test_anon_access.py.)* |
| Magic-link only | **Google, Discord, X/Twitter OAuth + email/password** (Supabase providers) |
| Runs/day plan limits | **Credit system** (Claude-style): subscriptions include monthly credits; top-ups cost extra; free signup grant that runs out fast |
| Utilitarian dark UI | **100× UI**: 2026-standard, clean/sleek/sharp/HD, exceeds LuxAlgo (see UI Bible below) |
| Template-first flow | **Start-from-scratch flow**: blank strategy, AI co-builds from the user's rules and proactively flags likely failure modes |
| Trades = table only | **Click any trade → candlestick chart** with exact entry/exit candles marked |
| Spec JSON visible | **Export**: download runnable code + spec; auto-generated **"Rules in plain English"** panel for manual traders |

---

## Phase A — UI/UX rebuild (the WOW pass)

Benchmark: luxalgo.com (docs/competitive-luxalgo.md has the teardown). Target: a visitor
says "this looks a generation ahead." Clean, simple, sleek — but sharp and HD.

**Stack**: Next.js App Router + Tailwind v4 + shadcn/ui primitives + Framer Motion
(micro-interactions only — 150-250ms, never gratuitous) + TradingView
`lightweight-charts` for all price/candle charts + Recharts retained for equity/drawdown
(Kevin explicitly likes these — restyle, don't replace).

**Design language** (evolves our validated tokens, doesn't discard them):
- Layered near-black surfaces (#0B0E14 base) with hairline borders, subtle glass
  (backdrop-blur on floating panels), one violet accent + teal comparison color,
  TradingView green/red strictly for P&L. Light mode ships too.
- Typography: Geist/Inter, tabular-nums mono for every number, big confident metrics.
- Product-as-hero landing (LuxAlgo's best trick): a LIVE embedded lab preview above the
  fold — real SPY data, scrubbing crosshair — with a "Go fullscreen" affordance.
  *(Superseded 2026-08-05 by P0-3: fullscreen now navigates to the lab for everyone —
  the first backtest is signup-free; it no longer opens the signup modal. See
  design/AUDIT.md §5.)*
- Section rhythm with eyebrow labels: "The Lab · Build anything" / "The Proof · The
  ledger" / "The Board · Public receipts".
- Command palette (⌘K): jump to template, symbol, run, deployment.
- Every metric keeps its plain-English tooltip; jargon never unexplained.
- Ban list (anti-LuxAlgo-sleaze): countdown timers, fake urgency, cherry-picked hero
  stats, testimonial walls implying profit, "edge/autopilot/execute" vocabulary.

**Lab (playground) layout v2**: three-zone pro-terminal —
1. Left rail: strategy browser (templates + my strategies + "New from scratch").
2. Center: tabbed workspace — **Results** (equity+drawdown, metric tiles with deltas),
   **Trades** (table → click row opens candlestick inspector), **Chart** (price chart
   with ALL entry/exit markers overlaid), **Rules** (plain-English + spec + export).
3. Right dock: AI chat (sticky, streaming responses, change-pill diffs, credit meter).
4. Top bar: strategy name (inline-editable), market/timeframe/date controls, Run,
   run-history dropdown, Deploy button, share.

## Phase B — Trade forensics + export + plain-English rules

1. **Trade inspector**: click a trade → modal/panel with candlestick chart (entry/exit
   candles flagged, stop level line, P&L annotation, a configurable context window of
   bars around the trade). Service: `GET /runs/{id}/bars?symbol=&from=&to=&timeframe=`
   serving OHLCV from the cache (auth-gated, symbol must belong to the run).
2. **Chart tab**: full price chart per symbol with every trade marker; toggle between
   symbols in the run.
3. **Plain-English rules**: deterministic translator (spec → structured sentences) +
   one cached LLM polish per spec-hash. Rendered in the Rules tab AND on strategy/share
   pages. Manual traders must be able to trade it from this alone.
4. **Export**: download button producing (a) `strategy.json` spec, (b) a standalone
   Python file (engine-lite runner or clear pseudocode header + spec embed) — "take
   your strategy with you." Watermark-free export = paid feature.

## Phase C — Any market, any timeframe

1. **Timeframes**: unlock 1m/5m/15m/30m/60m/1d in validation; UI selector + chat can
   set `backtest_timeframe`. Credit cost scales with timeframe granularity × range ×
   symbol count (intraday data is the expensive thing — price it, don't ban it).
   Engine already supports intraday paths (kept alive since V1; run_intraday_backtest.py
   is the harness). Guardrails: max range per timeframe (e.g., 1m capped to N months).
2. **Crypto**: Polygon crypto aggregates (`X:BTCUSD` style tickers). Engine work:
   24/7 calendar mode (no trading-day filter, no month-seasonality assumptions change),
   benchmark override (BTC instead of SPY), universe list from Polygon reference API.
3. **All US stocks/ETFs**: already served (5k+ symbol cache); expose search/autocomplete
   symbol picker backed by Polygon reference data (with asset-class badges).
4. Data plumbing: per-asset-class cache tables; Polygon subscription tier gates which
   asset classes are enabled (env flags), so we never advertise data we don't carry.

## Phase D — Start-from-scratch + proactive AI

1. "New from scratch" creates an empty spec; chat runs a guided intake (market →
   timeframe → entry idea → exits/stops → sizing), building the spec incrementally
   with a visible live draft.
2. **Proactive analysis**: before/after runs the AI flags known failure patterns
   (look-ahead bias smells, overtight stops vs timeframe volatility, unrealistic
   position sizing, survivorship caveats, too-few-trades significance warnings). These
   are teaching moments — the educational voice is brand.
3. Chat can rename, fork, and compare strategies by name.

## Phase E — Auth + accounts v2

- Supabase providers: **Google, Discord, X/Twitter, email+password** (keep magic link as
  secondary). Login/signup modal (not a separate page) matching the new UI.
- ~~**The lab requires login.**~~ *(Superseded by P0-3 — see the V2 table note. The
  account prompt moved to the SECOND action: deploy, export, chat beyond the free
  taste, custom/intraday specs.)*
- Profile: username (unique handle), avatar (from OAuth), linked X handle.
- Session-aware nav everywhere; dashboard becomes "My Lab" home.

## Phase F — Credits + billing v2 (Claude-style)

- **Credit = internal unit** roughly indexed to our marginal cost (Anthropic tokens +
  data/compute). Every priced action debits: chat message (by model tokens), backtest
  run (by symbols × years × timeframe), forward deployment slot (monthly), export.
  Template gallery browsing + cached template results are free to view.
- **Free tier**: signup grant (target: enough for ~2-3 strategies' worth of tinkering —
  a taste, gone in a session or two). No sub = no refill.
- **Subscriptions (monthly/yearly with ~2 months free on yearly)**: Starter/Pro/Max
  include monthly credit allowances + feature gates (intraday granularity, crypto,
  deployment slots, clean exports/shares). Overage: credit packs purchasable at a
  premium unit price (Claude-style "extra usage").
- Implementation: `credits_ledger` (append-only) + balance view in Supabase; FastAPI
  debits server-side pre-action, 402-style "out of credits" errors with upgrade CTA;
  Stripe: recurring subs (existing) + one-time credit-pack prices; webhook credits the
  ledger. UI: live credit meter in the chat dock + account page usage graph.
- Keep exact prices/allowances in `docs/pricing-model.md` (tune freely without
  touching code — constants live in one service module).

## Phase G — Social leaderboard

- Leaderboard rows: avatar, handle, linked X badge, days live, forward return, DD,
  sparkline. Sort/filter options from V1 plan remain.
- **Share-to-X**: one-click post with an auto-generated card image ("#3 on the ledger —
  +12.4% forward, 94 days, receipts attached") linking to the strategy page.
  OG-image endpoint renders the card (screenshot-clean, watermarked).
- X follower counts: needs paid X API — defer; store handle now, enrich later.
- Weekly Ledger Report page (auto-generated) doubles as content marketing.

## Build order (each gate green before next)

1. **A. UI rebuild** — the WOW pass (landing + lab shell + restyled results).
2. **B. Trade forensics + export + plain-English** (deepens the lab inside new shell).
3. **E. Auth v2 + login-gating** (providers, modal, ~~landing preview gate~~ — the
   preview/lab gate was reversed by P0-3; the account prompt is the second action now).
4. **F. Credits + billing v2** (replaces per-day limits; Stripe packs).
5. **C. Any market/timeframe** (unlock + gate + crypto engine work).
6. **D. Scratch-builder + proactive AI**.
7. **G. Social leaderboard + share-to-X**.

Rationale: visual credibility first (it re-frames everything else), monetization before
the expensive features (intraday/crypto burn real money), social last (needs users).

## Standing engineering notes

- Local dev: service on :8787 (`BACKTEST_CACHE_DB=engine/backtest_data.db`,
  `SERVICE_DATA_DIR=service_data`), web via `npm run dev` in /web. `.env` +
  `web/.env.local` hold real keys (gitignored). Tests: `pytest` from repo root.
- Production: Railway (service + cron worker `python -m service.worker`), Vercel (web),
  Supabase (auth+billing state), Stripe test-mode (live-mode switch pending).
- ADMIN_TOKEN guards /admin/* (seeding, worker runs).
- Deploy checklist: docs/deploy.md. Competitive teardown: docs/competitive-luxalgo.md.
- Regression treasures: AST security tests, clamp-hash-identity tests, template
  exemption tests (LIVE AGAIN under P0-3 — the anonymous template path is back;
  service/tests/test_anon_access.py pins it), credit-debit tests.
