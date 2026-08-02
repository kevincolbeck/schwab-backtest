# CLAUDE.md — Pivot `schwab-backtest` into "Chat-to-Backtest" SaaS

## What we are building

Pivot the existing repo (`kevincolbeck/schwab-backtest`) from a personal Windows desktop
trading bot into a **web SaaS product**: an AI-powered backtesting playground where users
pick a template strategy, see 10 years of results in seconds, then use chat to modify the
strategy in plain English ("what if the stop was 5% instead of 8%?") and instantly re-run.

**The product loop (this is the whole product — protect it):**
1. User picks a template strategy from a gallery (or starts from chat)
2. Backtest runs and renders results fast (the engine does 10yr × 4 symbols in ~5s — speed IS the product feel)
3. Chat panel next to results: user asks for a change → Claude edits the strategy spec JSON → re-run → show diff vs previous run
4. Every run is saved, reproducible, and shareable via public link

**What this product is NOT (hard rules):**
- NO live trading, NO order execution, NO broker connections of any kind. All broker/execution code gets deleted.
- NO "signals," NO "buy this stock" recommendations. This is a research/education tool.
- Every results page carries a disclaimer: "Historical simulation for research and education. Not financial advice. Past performance does not predict future results."

---

## Current repo state (verified working)

- ~19k lines of Python. All 89 tests pass (`pytest tests/`).
- End-to-end backtest verified working via `run_backtest_cli.py`: loads a strategy spec JSON,
  pulls OHLCV via yfinance (with SQLite caching in `backtest_data.db`), runs the
  `RuleBasedBacktestEngine`, outputs full stats (CAGR, Sharpe, Sortino, max DD, win rate,
  profit factor, expectancy_r), saves an immutable run snapshot.
- The strategy is fully described by a JSON spec (see "Strategy spec format" below). The AI
  chat layer already knows how to propose/edit these specs — repurpose, don't rebuild.

## Phase 0 — Surgery (delete the trading bot)

**DELETE entirely:**
- `broker/` (Schwab API, auth, reconciler)
- `execution/` (order_manager, trade_manager, kill_switch)
- `gui/` (entire PySide6 desktop app — all of it, including chat_panel/chat_controller UI. NOTE: before deleting, extract the prompt-building + response-parsing logic from `gui/chat_controller.py` into the new `service/chat.py` — the spec-editing prompt logic there is good and gets reused)
- `core/engine.py`, `core/scheduler.py` (live trading loop)
- `strategy/live_rule_based.py`, `strategy/signals.py`, `strategy/sizing.py`, `strategy/regime.py`, `strategy/filters.py`, `strategy/universe.py` (live-bot strategy path; keep only what the backtester imports — verify imports before deleting, `backtest/rule_based_engine.py` is self-contained for indicators)
- `main.py`, `main_headless.py`, `setup_wizard.py`, `build.bat`, `build_exe.py`, `create_icon.py`, `create_shortcut.ps1`, `Launch Backtester.bat`, `Launch Trading Bot.bat`, `optimize_intraday_ict.py`
- All Schwab references in `backtest/data_provider.py` (there's a Schwab-as-data-source fallback — strip it; yfinance/Polygon paths stay)
- Live-trading tables in `data/models.py` (orders, fills, AI decisions tied to live loop). Keep/replace with the new Supabase-backed models below.
- Remove `schwab-py`, `PySide6` and any GUI/broker deps from requirements.

**KEEP (the product engine):**
- `backtest/` — `rule_based_engine.py`, `order_simulator.py`, `portfolio.py`, `statistics.py`, `data_provider.py`, `data_adapter.py`, `config_overrides.py` (BacktestConfig)
- `strategy/indicators.py`, `strategy/computed_scanners.py` (Qullamaggie scanner translations — used by templates later)
- `ai/strategist.py`, `ai/analyzer.py` — repurpose as the chat brain (see Phase 2)
- `data/us_universe.py`, `data/market_data.py` (cache layer), `import_market_data.py`
- `run_backtest_cli.py` (becomes the reference for the service layer)
- Run snapshot / replay system (`backtest_runs.jsonl`, `apply_backtest_snapshot.py` logic) — this becomes the "saved runs + share links + diff" feature
- `tests/` for everything kept. All kept tests must still pass after surgery. Delete tests for deleted modules.

**Acceptance for Phase 0:** repo has zero references to Schwab/broker/orders/live trading; `pytest` green; `run_backtest_cli.py` still runs end-to-end.

---

## Target architecture

**IMPORTANT — Vercel reality check:** The Python engine (pandas, SQLite cache, multi-second
runs, full-universe scans) does not fit Vercel serverless functions (size limits, execution
limits, no persistent disk). Do not fight this. The architecture is:

- **Vercel** — Next.js frontend + lightweight API routes (auth session handling, Stripe webhooks)
- **Railway** (or Fly.io — pick Railway for simplicity) — Python FastAPI service wrapping the
  backtest engine, with a persistent volume for the OHLCV cache DB
- **Supabase** — Postgres (users, strategies, runs), Auth, and storage for run snapshots
- **Stripe** — subscriptions (Checkout + customer portal, keep it simple)
- **Anthropic API** — chat brain (model: `claude-sonnet-4-6`)

Monorepo layout after pivot:
```
/engine          # the kept Python code (backtest/, strategy/, ai/, data/)
/service         # NEW FastAPI app wrapping the engine
/web             # NEW Next.js app (deployed to Vercel)
/templates       # strategy template JSON specs (see Phase 3)
```

---

## Phase 1 — FastAPI service (`/service`)

Wrap the engine in an HTTP API. Reference `run_backtest_cli.py` for the exact invocation
pattern (spec → BacktestConfig → HistoricalDataProvider → RuleBasedBacktestEngine → stats).

**Endpoints:**
- `POST /backtest` — body: `{ spec: <strategy spec JSON>, start_date, end_date, starting_capital }`.
  Validates spec, enforces plan limits (see Gating), runs backtest, returns
  `{ run_id, stats, equity_curve, trades[], spec }`. Persist run to Supabase.
  Runs under ~15s execute synchronously; longer runs (full universe / intraday) return a
  `run_id` immediately and process via a background worker (use FastAPI BackgroundTasks or
  a simple RQ/Redis queue on Railway) with a `GET /runs/{run_id}` polling endpoint.
- `POST /chat` — body: `{ messages[], current_spec, last_run_stats }`. Calls Anthropic API
  with a system prompt that (a) explains the spec format, (b) includes current spec + last
  results, (c) instructs Claude to return STRICT JSON: `{ reply: string, updated_spec: object|null, should_rerun: bool }`.
  Reuse the prompt scaffolding from `ai/strategist.py` and the parsing from the old
  `gui/chat_controller.py`, but strip all "live config" / auto-apply behavior. The chat NEVER
  gives buy/sell advice on real tickers going forward — it only edits strategy specs and
  explains historical results. Refuse prediction requests in the system prompt.
- `GET /runs/{run_id}` — full run detail (stats, equity curve, trades, spec, parent_run_id)
- `GET /templates` — list template specs from `/templates`
- `GET /share/{share_slug}` — public, read-only run result (no auth)

**Engine changes needed:**
- Add an `equity_curve` (list of `{date, equity}`) to backtest results — the frontend needs it
  for charting. `backtest/portfolio.py` tracks equity; expose the series in the result dict.
- Add per-trade list to the result payload (entry/exit date, price, symbol, R, pnl) if not
  already in the run snapshot.
- Concurrency: the SQLite OHLCV cache must handle parallel requests — set
  `check_same_thread=False` + WAL mode, or serialize data-loading with a lock. Keep it simple.
- Run diffing: `GET /runs/{id}/diff/{other_id}` returning both stat blocks side-by-side.
  (Frontend renders the comparison; no fancy logic needed server-side.)

**Data source:** keep yfinance for local dev. Add `POLYGON_API_KEY` env-var support for
production (the data_provider already has Polygon paths — make it the primary source when the
key is present). Do NOT ship a paid product on yfinance.

---

## Phase 2 — Chat brain rules

System prompt for `/chat` must enforce:
1. Claude may ONLY: explain results, suggest/apply spec edits, explain trading concepts,
   compare runs. Claude may NOT: predict future prices, recommend real-money trades,
   claim a strategy "will" make money.
2. Spec edits must stay within validation bounds (mirror `PARAM_BOUNDS` idea from
   `ai/strategist.py`): position_size_pct 1–100, max_positions 1–20, stop_loss_pct 0–50,
   max_holding_days 1–365, symbols must be valid tickers or "ALL_US".
3. When user asks a vague question ("make it better"), Claude proposes ONE concrete change
   with reasoning, not a rewrite.
4. Always return the strict JSON contract. Server-side: validate `updated_spec` against the
   spec schema before running; on invalid spec, return the validation error to chat so Claude
   can self-correct (one retry max).

## Strategy spec format (already exists — document it in the repo README)

```json
{
  "name": "string",
  "description": "string",
  "symbols": ["AAPL", "..."] | ["ALL_US"],
  "indicators": [{"type": "sma|ema|rsi|zscore|atr|stddev", "length": 20}],
  "entry_rule_long": "close > sma_20 & rsi_14 > 55",
  "exit_rule": "close < sma_20",
  "entry_price_field": "open|high|low|close",
  "backtest_timeframe": "1d|5m|15m|30m|60m",
  "position_size_mode": "notional_pct|risk_pct",
  "position_size_pct": 25,
  "max_positions": 4,
  "stop_loss_pct": 8,
  "take_profit_pct": null,
  "max_holding_days": 60
}
```

---

## Phase 3 — Template gallery (`/templates/*.json`)

Ship 8 templates. Each is a spec JSON + a `meta` block (`display_name`, `category`,
`difficulty`, `one_liner`, `explainer_md` — 3-4 sentences on the idea behind it, in plain
English for beginners). Pre-run each template once at build time and cache the headline stats
so the gallery shows real numbers before the user clicks anything.

1. **Golden Cross** — SMA50 crosses above SMA200, exit on cross-down. Symbols: SPY, QQQ, AAPL, MSFT, NVDA.
2. **RSI-2 Mean Reversion** (Connors-style) — `rsi_2 < 10` entry, exit `close > sma_5`. Liquid large caps.
3. **Qullamaggie-style Momentum Breakout** — use `strategy/computed_scanners.py` logic: big prior move, consolidation, breakout over recent high. This is the flagship template.
4. **Minervini Trend Template** — price > sma_50 > sma_150 > sma_200, rsi confirmation, 8% stop.
5. **52-Week-High Momentum** — buy near 52wk highs (close within 5% of rolling 252-day max), trail with sma_50.
6. **Buy the Dip (tested)** — SPY/QQQ down 3%+ in 5 days while above sma_200, exit +5% or 10 days.
7. **Sell in May** — seasonal: long SPY Nov–Apr only. (Simple, famous, shareable.)
8. **Turtle-style Breakout** — 40-day high entry, 20-day low exit, ATR stop.

Categories in the gallery UI: "Momentum", "Mean Reversion", "Trend Following", "Famous Claims — tested".

---

## Phase 4 — Next.js frontend (`/web`, deploys to Vercel)

Stack: Next.js 14+ App Router, TypeScript, Tailwind, shadcn/ui, Recharts (equity curves),
Supabase JS client for auth.

**Pages:**
- `/` — landing: one-line pitch ("Test any trading strategy in plain English"), template
  gallery grid with pre-computed headline stats, big CTA into the playground. No login needed
  to run a template (anonymous session, limited runs).
- `/playground` — THE product. Layout: left = chat panel; right = results (equity curve chart,
  stats grid, trade table below fold). Top bar: strategy name, template selector, date range,
  "Run" button, run-history dropdown. When chat returns `updated_spec`, show a compact
  "Changes: stop_loss 8% → 5%" pill, auto-rerun, and render new results with a small
  before/after stats strip (prev run vs this run).
- `/runs/[id]` — saved run detail (auth) with "Share" button → generates `/s/[slug]`.
- `/s/[slug]` — public share page: strategy description, stats, equity curve, "Fork this
  strategy" CTA into the playground (this is the growth loop — make it clean and
  screenshot-friendly, subtle product watermark on free tier).
- `/pricing`, `/account` (Stripe customer portal link).

**Design:** dark theme, financial-terminal aesthetic but friendly — this sells to beginners,
not quants. Numbers big, jargon tooltipped (hover "Sharpe" → one-sentence plain-English
explanation). Disclaimer footer on every results view.

---

## Phase 5 — Auth, gating, billing

**Supabase tables:** `profiles` (user, plan, stripe_customer_id), `strategies` (user_id, spec
jsonb, name, forked_from), `runs` (id, user_id, strategy_id, spec jsonb, stats jsonb,
equity_curve jsonb, parent_run_id, share_slug nullable, created_at).

**Plan gating (enforce in the FastAPI service, not just the UI):**
- **Free:** templates + 10 custom runs/day, max 10 symbols per run, daily timeframe only,
  2016+ date range, share links watermarked.
- **Pro $29/mo:** unlimited runs, 100 symbols, full date range, run history + diffs, clean
  share links.
- **Max $79/mo:** `ALL_US` universe, intraday timeframes, robustness check (auto re-run
  across 3 date windows — 2016-2019, 2020-2022, 2023-present — and flag if profitable in
  fewer than 2; label it "Overfitting check").

Stripe: two products, Checkout for signup, webhook on Vercel API route updates
`profiles.plan`. Use Stripe customer portal for cancel/upgrade — build nothing custom.

---

## Phase 6 — Deploy

1. **Railway:** deploy `/service` (Dockerfile: python:3.12-slim, install engine + service
   deps, mount volume at the OHLCV cache path, env: `ANTHROPIC_API_KEY`, `POLYGON_API_KEY`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`). Health endpoint `/healthz`.
2. **Vercel:** deploy `/web`. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `BACKTEST_API_URL` (Railway URL), Stripe keys. Frontend calls the Railway API through a
   Next.js route handler proxy (keeps the service URL/key server-side, lets us rate-limit).
3. CORS on the service locked to the Vercel domain. Basic per-user rate limiting in the
   service (free tier especially).
4. Warm the data cache: after deploy, run `import_market_data.py` for the ~60 symbols used
   across all templates so template runs are instant for every visitor.

---

## Build order & acceptance criteria

Work in this order; each phase must be green before the next:

1. **Phase 0 surgery** — repo clean of trading-bot code, tests pass, CLI backtest works
2. **Phase 1 service** — `curl POST /backtest` with the Golden Cross spec returns stats + equity curve in <10s
3. **Phase 3 templates** — all 8 specs run successfully via the API with plausible results
4. **Phase 4 frontend (playground + gallery only, no auth)** — full loop works locally: pick template → results → chat edit → re-run → diff strip
5. **Phase 2 chat hardening** — prompt rules enforced, invalid-spec self-correction works, prediction requests refused
6. **Phase 5 auth + billing + share pages**
7. **Phase 6 deploy** — live URL, template run works logged-out on production

**Definition of done for v1:** a logged-out visitor can run the Sell-in-May template, ask the
chat "what if I stayed long all year instead?", watch it re-run, see the comparison, and share
a link — all on the production URL.

## Notes & known honest limitations (surface these in the UI, don't hide them)

- Survivorship bias: the auto-US universe uses currently listed symbols. Add a small info
  note on full-universe results: "Universe reflects currently listed stocks; results may be
  optimistic." Point-in-time universe data is a future upgrade, not v1.
- Slippage/fees: order simulator models slippage; expose the slippage assumption in the UI
  and let Pro users adjust it.
- yfinance is dev-only. Production requires POLYGON_API_KEY set.
