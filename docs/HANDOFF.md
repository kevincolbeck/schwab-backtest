# HANDOFF — resume point for the next build session

> Last updated: **2026-08-05**, tree clean at commit `49b3a54` on `master`.
> To resume: read this file top to bottom, then start the next item with the
> standard loop. Kevin's instruction to "resume where we left off" means:
> pick up at **NEXT UP** below.

## Where the build stands

Working spec: `docs/CHATBACKTEST-BUILD.md` — executed ONE item at a time,
top to bottom. Product direction: repo `CLAUDE.md`. Deployed state = pushed
state: **pushing to the `backtest` remote IS the deploy** (Vercel builds
`/web`, Railway builds the service, both from GitHub master).

- **P0-1 … P0-5: ALL SHIPPED + prod-verified.** Leaderboard sells day one
  (99ce254), winners-first homepage (c7f8130), signup-free first backtest
  (08855de), credit anxiety removed — daily runs are a free capability
  (4d908c5), analytics baseline — 9 events + /admin cohort dashboard
  (fa8f73a).
- **P1-1 blog: SHIPPED + prod-verified (49b3a54).** `/blog` + 4 category
  hubs + first 6 articles, engine-fed stats (no hardcoded numbers —
  `TemplateStatsBlock`), registry + invariants in `web/src/lib/blog.ts`
  (+ `.test.ts`), library backlinks, nav link, sitemap.
- **PostHog is LIVE** — Kevin set `POSTHOG_KEY` in Railway + Vercel
  (US cloud), events verified flowing. The `/admin` dashboard (ADMIN_TOKEN)
  computes activation/deployment cohorts from first-party data.
- **All 14 house templates are deployed on the prod ledger** (seeded
  2026-08-05; 15 rows incl. one user strategy; new ones show "warming up"
  until their 20-trading-day windows fill — by design).

## NEXT UP (in spec order)

1. **P1-2 per-page SEO** (`docs/CHATBACKTEST-BUILD.md` §3): unique
   title/description/H1 per page, OG site-wide. Known gaps: `/playground`
   and `/pricing` inherit root metadata today; spec lists exact titles.
2. **P1-3 shareable record cards** (dynamic OG image per strategy + download).
3. **P1-4 email sequences** — BLOCKED on owner: Resend-or-Loops decision +
   API key (spec §6 + §10 blocker #1).
4. **P1-5 comparison pages** (6 competitors, factual tone).
5. Section 4 programmatic template pages `/backtest/[slug]` — when built,
   re-point blog article template-links and add per-template backlinks.
6. §5 pricing restructure — BLOCKED on owner: Stripe $39/$99 + annual
   prices (§10 blocker #3).

## The per-item loop (unchanged — follow it exactly)

plan → (Kevin's go) → build → **adversarial review** (3 Agent lenses:
factual-honesty-vs-code+prod, spec/SEO or security, frontend/Next — refute
own findings before reporting) → fix ALL confirmed findings → commit (message
file via `git commit -F`, end with the Claude co-author line) →
`git push backtest master` → poll deploys → **prod smoke** → update
`docs/HANDOFF.md` + Claude's project memory.

## Hazards & invariants (do not relearn these the hard way)

- **GIT: `master`'s upstream is `origin` = Schwab-Autotradah — NEVER push
  there. Always `git push backtest master`.**
- Engine AST security allowlist (`test_expression_security.py`) must survive
  every engine change. Template spec hashes are load-bearing (template
  exemption + forward replays): never touch template `spec` contents.
- Non-negotiables: no live trading, no signals/predictions/advice, disclaimer
  on every results surface, ledger append-only, losers stay listed, never
  annualize sub-year windows on template cards/articles.
- The whole web app renders per-request (root layout reads cookies) — nothing
  is truly static except sitemap.xml; "it'll fail at build" reasoning is wrong.
- Anonymous analytics ids are ALWAYS `anon:`-prefixed (user-UUID collision =
  forgeable funnels). Client may only emit view events via `/api/t`.
- Free tier truth: daily runs ≤10 symbols or inside any template universe are
  credit-free on EVERY plan (quiet 50/day fair-use on free); intraday,
  multi-block custom, ALL_US still bill. Copy must never say "out of credits".

## Parked follow-ups (real, reviewed, deliberately deferred)

- **Engine open-fill convention:** open-fill strategies fill at the SIGNAL
  bar's open (price predates the signal's close) — flatters cross strategies.
  Fix = coordinated migration (cached stats, spec hashes, forward replays all
  move together). Articles/copy now disclose instead of deny.
- Playground `StatTiles` + leaderboard backtest-CAGR cell still annualize
  short windows (extend the `templateHero` refusal to them).
- Blog articles link `/playground?template=` until Section 4 pages exist.
- Strategy page hardcodes "(in-sample, 2016 →)" — false for 15m rows.
- docs/deploy.md says "8 templates" (14 now). Sitemap stock universe ~100
  (expand to 5k via service endpoint). 3 pre-existing eslint errors
  (pricing/strategy/ThemeToggle). Raw owner-id still in public payloads.
  Prompt caching on chat system prompt (~90% input COGS cut) untapped.

## Owed by Kevin (owner clicks)

- **Submit `https://schwab-backtest.vercel.app/sitemap.xml` in Google Search
  Console** (P1-1's last acceptance bullet).
- Archive prod duplicate `golden-cross-ddb5a4-5186` (SQL on Railway; status
  column is mutable).
- §10 blockers: #1 email provider (Resend/Loops) + key → unblocks P1-4;
  #3 Stripe $39/$99 + annual prices → unblocks §5. (#2 PostHog: DONE.)
- Stripe is still test-mode (live-mode switch pending).

## Run / verify commands

- Service: port 8787, `BACKTEST_CACHE_DB=engine/backtest_data.db`,
  `SERVICE_DATA_DIR=service_data`. Web: `npm run dev` in `/web`
  (proxies via `BACKTEST_API_URL`).
- Tests: `python -m pytest` from repo root (240 green);
  `cd web && npm test -- --run` (43 green); `npm run build` green;
  `npm run lint` has exactly 3 pre-existing errors + 1 warning.
- Prod: web `schwab-backtest.vercel.app`, service
  `schwab-backtest-production.up.railway.app` (`/healthz`). Admin ops need
  `x-admin-token` (value in gitignored `.env`).
