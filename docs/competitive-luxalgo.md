# Competitive Analysis: LuxAlgo vs. Chat-to-Backtest

Researched 2026-08-02 (sources: luxalgo.com home/pricing/backtesting pages + raw HTML/CSS,
docs.luxalgo.com AI-backtesting + Quant docs, their own blog breakdown, app.luxalgo.com/quant,
Trustpilot via search snippets, Reddit/third-party reviews). Pairs with CLAUDE.md — this doc
drives Phase 4 design decisions and landing-page messaging.

## What LuxAlgo actually is

Repositioned ~2025-26 from "TradingView indicator vendor" to "The AI Trading & Charting
Platform" with its own charting engine. Product lines:

- **Quant** — AI chat agent that generates/validates Pine Script for TradingView. Output is
  code; credits-metered (long chats burn credits; docs suggest restarting after ~50 messages).
- **AI Backtesting Assistant** — closest to our product, and critically: **a retrieval engine,
  not a backtesting engine.** Their own blog: "The system doesn't generate new strategies on
  the fly. Instead, it intelligently matches your requests with the most relevant strategies
  from an extensive database." The "10M+ backtested strategies" are combinations of their three
  proprietary toolkits' signals. Coverage: ~90 tickers (only 30 stocks + 5 ETFs), timeframes
  **5m/15m/60m only — no daily**, max **20,000 recent bars** (~1 trading year at 5m),
  recomputed **Mon/Wed/Fri 23:30 UTC** at $10k capital. Max 3 strategies per chat reply.
  Export = CSV only. To modify a strategy you must leave the chat and hand-tune in their
  TradingView backtesters — on data their docs admit "might be different."
- **Algos** — three invite-only premium TradingView toolkits (repainting controversy lives here).
- **Alerts** — webhooks "ready to drive brokers, bots, and prop-firm platforms" (signal-seller
  territory we explicitly avoid).
- **Library / PineTS / Markets hub** — genuine moat: 1M+ TradingView followers, free indicators.

## Pricing

| Tier | Monthly | Annual-equivalent | Notes |
|------|---------|-------------------|-------|
| Free | $0 | $0 | Library + limited AI credits; can't save strategies or set alerts |
| Premium | $67.99 | ~$34.99/mo | 5,000 credits + toolkits; **no full AI Backtesting** |
| Ultimate | $119.99 | $59.99/mo | 25,000 credits + full AI Backtesting + backtesters |

Credit meter anxiety, first-payment-only refund, flash-sale countdowns, documented surprise
$300-480 auto-renewals (Trustpilot ~4.6★ but 9% 1-star on billing).

## Verified product gaps we exploit

1. **No true modify-and-re-run loop in chat** — retrieval of stale pre-computed results.
2. **No long-horizon backtests** — intraday only, ~1 year of bars. Our 10-year daily runs are
   outside their engine's capability.
3. **No public shareable result links** (CSV export only).
4. **No before/after diff comparison.**
5. **Login + $59.99-119.99/mo + credit meter** before the good stuff; our templates run
   logged-out, free.
6. **TradingView lock-in** for refinement, with mismatched data between platforms.
7. **Strategy universe = their black-box indicator soup** — can't express "50/200 SMA cross on
   SPY with 5% stop" as such; we're plain-English readable rules.
8. **Overfitting-as-a-service** — mining 10M backtests for winners is data-dredging; honesty
   lives in an 8pt footer. We print limitations on the result card.
9. **Beginner hostility** — hero greets you with "CHoCH" and "BOS" jargon.
10. **Reputation soft spots** — repainting complaints, billing complaints, signal-seller odor.
11. Only 30 US stocks, intraday, crypto/futures tilt — "how would AAPL have done over 10
    years" has no home there.

## Differentiation messaging (them vs us one-liners)

1. *An AI that searches yesterday's backtests* vs *an AI that actually re-runs yours — change
   the stop, get a fresh 10-year result in seconds.*
2. *Intraday snippets recomputed three times a week* vs *a decade of history, on demand.*
3. *Three strategy cards in a table* vs *your change, side-by-side — curves overlaid, every
   metric delta highlighted.*
4. *$59.99+/mo and a credit counter* vs *click a template, see real results, free, before you
   even sign up.*
5. *Export a CSV* vs *every result is a URL.*
6. *Trademarked black-box signals* vs *strategies you can read.*
7. *Disclaimers in 8pt gray* vs *limitations printed on the result card.*
8. *Alerts wired to brokers* vs *a lab for understanding. No signals, no autopilot, no promises.*
9. *Two platforms, three toolkits, steep curve* vs *pick a template, ask a question.*
10. *Refine on TradingView, on data that doesn't match* vs *one page, one engine, one answer.*

Lead with #1-4. #8 doubles as legal positioning.

## Design bar (Phase 4 directives)

**Steal:** product-as-hero (live template run above the fold, not a mock); eyebrow-label
section rhythm ("Templates · The starting point", "Chat · The what-if machine", "Share · The
receipt"); TradingView's P&L colors **green #089981 / red #F23645** strictly for profit/loss
semantics; hairline `rgba(255,255,255,0.08)` borders on near-black cards; tabular mono digits
everywhere; an FAQ that answers "will this make me money?" with a flat "No".

**Palette:** warmer terminal than their pure black — bg `#0B0E14`, panels `#11151D`, hairline
`rgba(148,163,184,0.12)`, text `#E6EAF2`, muted `#8A94A6`. One brand accent they don't own
(violet `#8B7CF6` or amber `#F5A623`) for chat/CTAs. Ship a real light mode (they don't).

**Type:** Inter/Geist for UI; JetBrains Mono / Geist Mono with `tabular-nums` for all metrics.

**Playground layout:** three-pane terminal — left template/params rail; center Recharts equity
curve + mirrored drawdown sub-chart with metric tiles (each with an ⓘ plain-English tooltip);
chat dock right/bottom. After any chat edit: **ghost-line diff** — previous run at 40% opacity
behind the new curve, metric tiles show deltas (▲ +2.1pp). This one interaction out-designs
their whole product.

**Charts:** one clean equity line + subtle area fill; sparse axes; annotate only what the chat
changed. Clarity, not density, is the flex.

**Tone:** curious-lab, not war-room. Ban: *edge, autopilot, execute, Wall Street, win-rate-as-
hero-stat*, alerts/webhooks/prop-firm anything, countdown timers, cherry-picked hero stats,
testimonial walls implying profits.

**Trust:** methodology page linked from every result; limitations printed on the shareable
card so shared links carry the honesty with them.
