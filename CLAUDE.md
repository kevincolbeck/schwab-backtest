# CLAUDE.md — Build "Chat-to-Backtest + Forward-Test Ledger" SaaS from `schwab-backtest`

## Product vision (read this first — it drives every decision)

Pivot the existing repo (`kevincolbeck/schwab-backtest`) from a personal Windows trading bot
into a web SaaS for **swing traders**: an AI backtesting playground where users build
strategies in plain English, PLUS a **public forward-testing ledger** that tracks every
deployed strategy's signals on live end-of-day data — timestamped, immutable, and public.

**Positioning: "They sell the dream. We sell the proof."**
Competitors (LuxAlgo etc.) sell AI-optimized backtests to day traders — hindsight dressed as
edge. We serve the **swing/position trading niche** (O'Neil / Minervini / Qullamaggie style
momentum, EOD data, multi-day holds) and our differentiator is **receipts**: backtests are
where you experiment; the forward ledger is where strategies prove themselves in public,
out-of-sample, where nobody can retroactively fake a track record.

**Strategic constraints that are features, not bugs:**
- **EOD-only in v1.** No intraday, no real-time. Swing trading doesn't need it, EOD data is
  nearly free (vs. licensed real-time feeds), and it keeps compute trivial. Do not build
  intraday paths even though the engine supports them — disable/hide them.
- **US stocks + ETFs only in v1.** No crypto, no forex, no futures.
- **NO live trading, NO broker connections, NO order execution.** Delete all of it.
- **NO buy/sell recommendations.** The AI edits strategy specs and explains results. Every
  results page carries: "Historical/paper simulation for research and education. Not
  financial advice. Past performance does not predict future results."

**The two core loops:**
1. **Backtest loop (the playground):** pick template or describe strategy → results in
   seconds → chat to modify ("tighten the stop to 5%") → re-run → diff vs previous run →
   save/share.
2. **Forward loop (the ledger, the moat):** when a user is happy with a strategy, one click
   **deploys to forward testing** → spec is FROZEN → every trading day after market close,
   our worker evaluates it on fresh EOD data and appends signals (entries/exits at next-day
   open) to an immutable ledger → public strategy page shows the live paper track record
   next to the original backtest → site-wide **leaderboard ranks strategies by forward
   performance**. Every day the ledger runs, the moat deepens — no competitor can backfill
   a public forward record.

---

## Current repo state (verified)

- ~19k lines of Python; all 89 tests pass (`pytest tests/`).
- Working end-to-end: `run_backtest_cli.py` loads a strategy spec JSON, pulls OHLCV via
  yfinance (SQLite cache: `backtest_data.db`), runs `RuleBasedBacktestEngine`, outputs
  stats (CAGR, Sharpe, Sortino, max DD, win rate, profit factor, expectancy_r), writes an
  immutable run snapshot (`backtest_runs.jsonl` + per-run JSON).
- Strategies are fully described by JSON specs; the AI layer already knows how to
  propose/edit them.

## Strategy spec format (existing — keep, document in README)

```json
{
  "name": "string",
  "description": "string",
  "symbols": ["AAPL", "..."] | ["ALL_US"],
  "indicators": [{"type": "sma|ema|rsi|zscore|atr|stddev", "length": 20}],
  "entry_rule_long": "close > sma_20 & rsi_14 > 55",
  "exit_rule": "close < sma_20",
  "entry_price_field": "open",
  "backtest_timeframe": "1d",
  "position_size_mode": "notional_pct|risk_pct",
  "position_size_pct": 25,
  "max_positions": 4,
  "stop_loss_pct": 8,
  "take_profit_pct": null,
  "max_holding_days": 60
}
```
v1 validation: force `backtest_timeframe: "1d"`; reject intraday values with a friendly error.

---

## Phase 0 — Surgery (delete the trading bot)

**DELETE entirely:**
- `broker/`, `execution/` (all order/trade/kill-switch code)
- `gui/` — the whole PySide6 desktop app. FIRST extract the prompt-building and
  response-parsing logic from `gui/chat_controller.py` into the new `service/chat.py`
  (the spec-editing prompt scaffolding there is good), THEN delete the directory.
- `core/engine.py`, `core/scheduler.py` (live loop)
- `strategy/live_rule_based.py`, `strategy/signals.py`, `strategy/sizing.py`,
  `strategy/regime.py`, `strategy/filters.py`, `strategy/universe.py` (live-bot path —
  verify nothing in `backtest/` imports them before deleting)
- `main.py`, `main_headless.py`, `setup_wizard.py`, `build.bat`, `build_exe.py`,
  `create_icon.py`, `create_shortcut.ps1`, both `Launch *.bat`, `optimize_intraday_ict.py`
- Schwab-as-data-source fallback inside `backtest/data_provider.py`
- Live-trading tables in `data/models.py`
- `schwab-py`, `PySide6`, and other GUI/broker deps from requirements

**KEEP (the engine):**
- `backtest/`: `rule_based_engine.py`, `order_simulator.py`, `portfolio.py`,
  `statistics.py`, `data_provider.py`, `data_adapter.py`, `config_overrides.py`
- `strategy/indicators.py`, `strategy/computed_scanners.py` (Qullamaggie scanner
  translations — powers the flagship template)
- `ai/strategist.py`, `ai/analyzer.py` (repurposed as chat brain)
- `data/us_universe.py`, `data/market_data.py`, `import_market_data.py`
- `run_backtest_cli.py` (reference implementation for the service)
- Run snapshot/replay system — extend it for the forward ledger
- All tests for kept modules (must stay green); delete tests for deleted modules

**Acceptance:** zero references to Schwab/broker/orders/live trading; `pytest` green;
`run_backtest_cli.py` runs end-to-end.

---

## Architecture

**Vercel cannot run the Python engine** (size/duration limits, no persistent disk). Layout:
- **Vercel** → Next.js frontend + API routes (auth session, Stripe webhooks, proxy to engine)
- **Railway** → Python FastAPI service wrapping the engine + the **forward-test worker**
  (cron), persistent volume for the OHLCV cache
- **Supabase** → Postgres (users, strategies, runs, deployments, forward ledger), Auth
- **Stripe** → subscriptions (Checkout + customer portal)
- **Anthropic API** → chat brain, model `claude-sonnet-4-6`

Monorepo:
```
/engine      # kept Python (backtest/, strategy/, ai/, data/)
/service     # NEW FastAPI app + forward-test worker
/web         # NEW Next.js app (Vercel)
/templates   # strategy template JSONs
```

**Data source:** yfinance for local dev. Production: Polygon via `POLYGON_API_KEY`
(data_provider already has Polygon paths — make it primary when key present). EOD-only
keeps Polygon cost at the cheapest tier. Do not ship paid product on yfinance.

---

## Phase 1 — FastAPI service (`/service`)

Reference `run_backtest_cli.py` for invocation (spec → BacktestConfig →
HistoricalDataProvider → RuleBasedBacktestEngine → stats).

**Endpoints:**
- `POST /backtest` — `{spec, start_date, end_date, starting_capital}`. Validate spec +
  plan limits. Runs <15s execute synchronously; larger (ALL_US) return `run_id` and process
  via background worker; `GET /runs/{run_id}` to poll. Persist run to Supabase. Response:
  `{run_id, stats, equity_curve, trades[], spec}`.
- `POST /chat` — `{messages[], current_spec, last_run_stats}`. Strict JSON contract back:
  `{reply, updated_spec|null, should_rerun}`. See Chat rules below.
- `GET /runs/{id}`, `GET /runs/{id}/diff/{other_id}` — run detail and side-by-side stats.
- `GET /templates` — list from `/templates`.
- `POST /deploy` — deploy strategy to forward testing (see Phase 5).
- `GET /forward/{deployment_id}` — forward record (signals, open positions, paper equity).
- `GET /leaderboard` — ranked public deployments (see Phase 6).
- `GET /share/{slug}` — public read-only backtest run.
- `GET /healthz`.

**Engine changes:**
- Expose `equity_curve` (`[{date, equity}]`) and full per-trade list (symbol, entry/exit
  date + price, pnl, R) in the result payload — the frontend charts need them.
- Mark entry/exit points per trade so the frontend can render **trade markers on price
  charts** (this visual is a core selling point — entries/exits shown ON the chart).
- SQLite cache concurrency: WAL mode + a data-load lock. Keep it simple.

## Chat brain rules (enforce in system prompt + server-side)

1. The AI may ONLY: explain results, propose/apply spec edits, explain trading concepts
   (plain English, swing-trading vocabulary), compare runs. It may NOT predict prices,
   recommend real-money trades, or claim a strategy "will" make money. Refuse politely.
2. Spec edits bounded: position_size_pct 1–100, max_positions 1–20, stop_loss_pct 0–50,
   max_holding_days 1–365, symbols valid tickers or "ALL_US", timeframe locked to 1d.
3. Vague asks ("make it better") → ONE concrete change with reasoning, not a rewrite.
4. Server validates `updated_spec` against schema before running; on failure, feed the
   validation error back to the AI for ONE self-correction retry.
5. The AI should teach as it works: when it edits a spec, one plain-English sentence on
   what the change means (educational tone is part of the niche positioning).

---

## Phase 2 — Swing-trading template gallery (`/templates/*.json`)

Each template = spec JSON + `meta` block (`display_name`, `category`, `difficulty`,
`one_liner`, `explainer_md` — 3–5 sentences, beginner-friendly, explaining the methodology
and who popularized it). Pre-run each at build time; gallery shows real cached stats.

All templates are swing/EOD. Categories: **Momentum**, **Trend Following**,
**Mean Reversion**, **Famous Claims — Tested**.

1. **Qullamaggie-Style Breakout** (flagship) — use `strategy/computed_scanners.py` logic:
   large prior move, consolidation, breakout over recent high, ADR-aware. Difficulty: Advanced.
2. **Minervini Trend Template** — close > sma_50 > sma_150 > sma_200 + momentum filter,
   8% stop. Difficulty: Intermediate.
3. **52-Week-High Momentum** — close within 5% of rolling 252-day high, trail sma_50.
4. **Golden Cross** — sma_50 crosses above sma_200; exit on cross-down. Difficulty: Beginner.
5. **Turtle-Style Breakout** — 40-day-high entry, 20-day-low exit, ATR-based stop.
6. **RSI-2 Mean Reversion** (Connors-style) — rsi_2 < 10 above sma_200; exit close > sma_5.
7. **Buy the Dip — Tested** — SPY/QQQ down 3%+ in 5 days while above sma_200; exit +5% or 10 days.
8. **Sell in May — Tested** — long SPY November–April only. (Famous, simple, shareable.)

---

## Phase 3 — Next.js frontend (`/web`)

Stack: Next.js 14+ App Router, TypeScript, Tailwind, shadcn/ui, Recharts, Supabase JS.
Design: dark, clean, financial but friendly — this sells to serious beginners, not quants.
Big numbers, tooltipped jargon (hover "Profit factor" → one-sentence explanation).
Disclaimer footer on every results/ledger view.

**Pages:**
- `/` landing — pitch: **"Build it. Test it. Prove it in public."** Three-step visual
  (chat → backtest → forward ledger). Template gallery with real stats. Leaderboard teaser
  (top 5 forward-tested strategies). CTA runs a template with NO login (anonymous session,
  limited runs).
- `/playground` — THE product. Left: chat panel. Right: price chart with **entry/exit
  markers on actual bars**, equity curve, stats grid, trade log below fold. Top bar:
  strategy name, template selector, date range, Run button, run history. Chat edits show a
  "Changes: stop_loss 8% → 5%" pill, auto-rerun, before/after stats strip. Prominent
  **"Deploy to Forward Test"** button once a run completes (auth required).
- `/leaderboard` — public. See Phase 6.
- `/strategy/[slug]` — public strategy page. See Phase 5.
- `/runs/[id]` (auth) + `/s/[slug]` (public share of a backtest, watermarked on free,
  "Fork this strategy" CTA — the growth loop; make it screenshot-clean).
- `/dashboard` (auth) — my strategies, my deployments with live paper P&L, my runs.
- `/pricing`, `/account` (Stripe portal link).

---

## Phase 4 — Auth, data model, billing

**Supabase tables:**
- `profiles` (user_id, plan, stripe_customer_id)
- `strategies` (id, user_id, name, spec jsonb, forked_from, created_at)
- `runs` (id, user_id, strategy_id, spec jsonb, stats jsonb, equity_curve jsonb,
  trades jsonb, parent_run_id, share_slug, created_at)
- `deployments` (id, strategy_id, user_id, spec_frozen jsonb, spec_hash, status
  [active|paused|archived], visibility [public|private], slug, starting_capital,
  deployed_at)
- `forward_signals` (id, deployment_id, signal_date, action [entry|exit|stop|time_exit],
  symbol, price, shares, reason, created_at) — **append-only**: no UPDATE/DELETE grants;
  enforce via Postgres RLS/permissions.
- `forward_equity` (deployment_id, date, equity, open_positions jsonb) — daily snapshot.

**Plans (enforced server-side in FastAPI, not just UI):**
- **Free:** templates + 10 custom backtests/day, 10 symbols max, watermarked shares,
  **1 forward deployment** (public only).
- **Pro $29/mo:** unlimited backtests, 100 symbols, run history + diffs, clean shares,
  **5 forward deployments**, private deployments allowed.
- **Max $79/mo:** ALL_US universe backtests, **25 forward deployments**, robustness
  check button (auto re-run across 2016–2019 / 2020–2022 / 2023–present, flag if
  profitable in <2 windows — label "Overfitting check").

Free tier gets a forward slot on purpose: deployed public strategies feed the leaderboard,
and the leaderboard is the marketing.

Stripe: two products, Checkout, webhook on a Vercel API route updates `profiles.plan`,
customer portal for changes. Build nothing custom.

---

## Phase 5 — Forward-testing engine (THE MOAT — build with care)

**Deploy flow (`POST /deploy`):**
1. Takes a completed run's spec. Server re-validates, then **freezes** it: stores
   `spec_frozen` + SHA-256 `spec_hash` in `deployments`. Frozen specs are IMMUTABLE —
   editing a deployed strategy creates a NEW deployment with a fresh track record and
   links the old one as archived ("v1 — retired after 94 days"). This is the anti-gaming
   rule; never compromise it.
2. User chooses public (default, required on Free) or private (Pro+).
3. Paper account initialized at `starting_capital` (default $100k).

**Daily worker (cron on Railway, weekdays ~7:00 PM ET, after EOD data settles):**
1. Pull fresh EOD bars for all symbols referenced by active deployments (batch, cached).
   Handle data-not-yet-available: retry at 9 PM, then flag the day as pending.
2. For each active deployment, evaluate the frozen spec against the new bar using the SAME
   engine code paths as backtesting (extract a shared `evaluate_day()` from
   `rule_based_engine.py` so backtest and forward-test literally cannot drift — this
   "no drift between test and live signals" guarantee is a marketing claim, so make it
   true by construction).
3. **Execution model (state it everywhere, transparently):** signals generated on today's
   close are filled at TOMORROW's open, with the same slippage assumption as backtests.
   Stops: if tomorrow's low breaches the stop, fill at stop price (gap-through: fill at
   open). This is honest EOD paper trading; document it on every strategy page.
4. Append `forward_signals` rows, update positions, snapshot `forward_equity`.
5. Idempotent per (deployment, date) — safe to re-run; never double-append.
6. Log every worker run; alert (simple email/webhook) on failures. Missed days must be
   backfillable in order.

**Public strategy page (`/strategy/[slug]`):** name + plain-English description (AI-generated
from spec, owner-editable), rules summary, **"Forward-tested N days" badge**,
forward equity curve, signals ledger table (date, action, symbol, price — timestamped),
price charts with forward entry/exit markers, and the side-by-side that IS the brand:
**original backtest stats vs. live forward stats**. Fork button. Never show forward and
backtest performance merged into one curve — always separated. That separation is the
honesty product.

---

## Phase 6 — Leaderboard

`/leaderboard`, public, the front door of the site.
- Ranks **public, active deployments** by forward performance.
- **Minimum 20 trading days deployed to appear** (anti-noise); badges at 30/90/180/365 days.
- Default sort: forward return since deployment; alternate sorts: Sharpe (forward),
  max DD, win rate, most-forked. Filters: category, deployment age.
- Each row: strategy name, owner handle, days live, forward return, DD, sparkline → links
  to strategy page.
- Show `spec_hash` (short) on strategy pages — a quiet proof-of-immutability signal that
  sophisticated users will appreciate.
- Weekly "Ledger Report" page auto-generated (top movers, new entrants, notable failures —
  failures included on purpose; honesty is the brand). This doubles as content marketing.

---

## Phase 7 — Deploy

1. **Railway:** `/service` Dockerfile (python:3.12-slim), volume mounted at OHLCV cache
   path, cron/worker process for the forward engine, env: `ANTHROPIC_API_KEY`,
   `POLYGON_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.
2. **Vercel:** `/web`. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `BACKTEST_API_URL`, Stripe keys. Frontend reaches the engine only through Next.js route
   handlers (service URL/keys stay server-side; add per-user rate limiting there).
3. CORS on the service locked to the Vercel domain.
4. Warm the cache post-deploy: `import_market_data.py` for all symbols used by the 8
   templates so template runs are instant for logged-out visitors.
5. Deploy the 8 templates as **house deployments** on day one (owner: "House") so the
   leaderboard is alive before the first user arrives.

---

## Build order & acceptance gates (each must be green before the next)

1. **Phase 0 surgery** → repo clean, tests pass, CLI backtest works
2. **Phase 1 service** → `curl POST /backtest` with Golden Cross spec returns stats +
   equity curve + trades in <10s
3. **Phase 2 templates** → all 8 run via API with plausible results
4. **Phase 3 frontend (playground + gallery, no auth)** → full local loop: template →
   chart with trade markers → chat edit → re-run → diff strip
5. **Chat hardening** → bounds enforced, invalid-spec self-correction works, prediction
   requests refused
6. **Phase 4 auth + billing + share pages**
7. **Phase 5 forward engine** → deploy a template, run the worker manually across 5
   simulated days of historical "new" data, verify ledger appends, equity snapshots,
   idempotency, and immutability (attempt an UPDATE on forward_signals — must fail)
8. **Phase 6 leaderboard** → house deployments ranked and rendering
9. **Phase 7 production deploy**

**Definition of done for v1:** a logged-out visitor runs the Minervini template, asks chat
"what if the stop was 5%?", watches the re-run and comparison — then signs up, deploys it
to forward testing, and it appears on their dashboard; the next worker run appends its
first ledger entry; the house strategies are live on the public leaderboard at the
production URL.

## Honest limitations (surface in UI, never hide)

- Survivorship bias: auto-US universe = currently listed symbols; backtests note
  "results may be optimistic." Point-in-time universe = future upgrade. (Forward testing
  has NO survivorship bias — say so; it's a selling point.)
- Slippage assumption shown on every results page; adjustable for Pro.
- Forward fills are simulated at next open — paper trading, clearly labeled, never
  presented as real executions.
- yfinance dev-only; production requires `POLYGON_API_KEY`.
