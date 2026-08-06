# Deploying Chat-to-Backtest

Three pieces: the Python service (Railway), the web app (Vercel), the database (Supabase).
`railway.json` at the repo root pre-configures the Railway build (Dockerfile + healthcheck).

## 0. Supabase one-time setup (dashboard)

1. SQL editor → run these **in order**. Every one is idempotent, so re-running
   a file that already applied is safe and is the fastest way to check.

   | # | File | What it creates | Required? |
   |---|---|---|---|
   | 1 | `supabase/APPLY_ME_IN_SQL_EDITOR.sql` | `profiles`, `strategies`, `runs` (+ the ledger tables) | yes — auth breaks without `profiles` |
   | 2 | `supabase/APPLY_ME_PART2.sql` | `deployments`, `forward_signals`, `forward_equity` | yes |
   | 3 | `supabase/APPLY_ME_PART3.sql` | `credits_ledger` + the credit RPCs | yes — billing needs it |
   | 4 | `supabase/APPLY_ME_PART4.sql` | **security fix**: revokes PUBLIC EXECUTE on the credit RPCs | **yes — without it the anon key can mint credits** |
   | 5 | `supabase/migrations/0003_section9_groundwork.sql` | §9 groundwork columns + `forward_returns` | optional (see below) |
   | 6 | `supabase/migrations/0004_referrals.sql` | `referral_redemptions` | only if you want referrals live |

   To verify what's applied, query each table with the service key — a missing
   one returns PGRST205. To verify #4 specifically, call `rpc/grant_credits`
   with the ANON key: it must answer `42501 permission denied`. Anything
   else means the lockdown is not in place.

   **On #5:** the Postgres ledger tables are the mirror TARGET, not an active
   mirror — the service writes SQLite (`SERVICE_DATA_DIR/forward.db`) and
   nothing writes these. Applying it keeps the schemas in parity for Phase 2;
   the tables will sit empty, exactly like `deployments` does today. No rush.

   **On #6:** this one IS read and written at runtime (`service/referrals.py`,
   over PostgREST). Without it the referral endpoints fail closed — zero bonus
   slots, no crash — so skipping it is safe if you don't want the feature.

   Files 1–4 use the `APPLY_ME_*` naming from before `migrations/` existed;
   5–6 are the canonical migration files and paste into the SQL editor the
   same way. Numbering is chronological across both.
2. Authentication → URL Configuration: set **Site URL** to the Vercel domain and add
   `https://<vercel-domain>/auth/callback` to **Redirect URLs** (magic links break without this).

## 1. Railway — FastAPI service

1. New project → Deploy from GitHub → `kevincolbeck/schwab-backtest`.
2. Settings → Build: root directory `.`, Dockerfile path `service/Dockerfile`.
3. Add a **volume** mounted at `/data` (holds `backtest_data.db` — plan ~5 GB).
4. Environment variables:

   | Variable | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | chat brain (rotate the old desktop key first!) |
   | `POLYGON_API_KEY` | production data source — do not ship on yfinance |
   | `ALLOWED_ORIGINS` | `https://<your-vercel-domain>` |
   | `MAX_SYMBOLS_PER_RUN` | `200` (raise later for Max-plan universe runs) |
   | `CHAT_MODEL` | optional override, defaults to `claude-sonnet-4-6` |
   | `POSTHOG_KEY` | P0-5 analytics — service events (backtest_run, ai_message_sent, deploy_completed, share_link_created) stay dormant no-ops until set |
   | `POSTHOG_HOST` | optional, defaults to `https://us.i.posthog.com` |
   | `ANALYTICS_SALT` | optional — salts the anonymous IP-hash distinct ids; falls back to `PROXY_SHARED_SECRET` (already set), so only needed if you want a dedicated salt |
   | `REFERRAL_SECRET` | optional — **the referral feature is OFF until this is set.** Any long random string (`openssl rand -hex 32`). Codes are derived from it, so **changing it invalidates every code already in circulation** — already-redeemed bonuses survive, because redemptions are stored by user id, but a link someone is holding stops working. Set once, don't rotate casually. Service only; the web app never sees it. |
   | `REFERRAL_MAX_BONUS` | optional, default `3` — most bonus deployment slots one referrer can earn. This grants free capacity that costs money to serve, so keep it low. |

5. Warm the cache after first deploy (Railway shell):
   `python engine/import_market_data.py --source polygon` for the template symbols,
   then `python scripts/build_template_stats.py` to refresh gallery stats.
6. **Forward-test worker (cron):** add a Railway cron service on the same image,
   schedule `0 23 * * 1-5` UTC (≈7 PM ET weekdays), command `python -m service.worker`,
   plus a retry at `0 1 * * 2-6` (≈9 PM ET). The worker is idempotent and backfills
   missed days automatically, so overlapping/repeat runs are safe.
7. **House deployments (day one):** `python scripts/deploy_house_templates.py <today>` —
   deploys the 8 templates as owner "house" so the leaderboard is alive before the
   first user arrives.

## 2. Vercel — Next.js app

1. Import the repo, set **Root Directory = `web`**.
2. Environment variables:

   | Variable | Value |
   |---|---|
   | `BACKTEST_API_URL` | the Railway service URL (server-side only) |
   | `STRIPE_PRICE_PRO_V2` · `STRIPE_PRICE_PRO_ANNUAL` · `STRIPE_PRICE_MAX_V2` · `STRIPE_PRICE_MAX_ANNUAL` | §5 flat-tier price IDs (printed by `scripts/setup_stripe_v2.py`). **Required** — there is deliberately NO fallback to the retired $29/$79 prices, so checkout 503s until these are set rather than silently charging the old amount. Checkout also verifies each price's `unit_amount` against `web/src/lib/pricing.ts` before charging. |
   | `POSTHOG_KEY` | P0-5 analytics — web events (signup, upgrade_viewed/completed, result_viewed, deploy_started) stay dormant no-ops until set. Same project key as Railway. Server-side env, NOT `NEXT_PUBLIC_` |
   | `POSTHOG_HOST` | optional, defaults to `https://us.i.posthog.com` |

   Later (Phase 5): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

   **Operator dashboard (P0-5):** `/admin` (unlinked, noindex) renders weekly
   cohort activation/deployment computed by the service's `/admin/metrics` —
   authenticate with the service's `ADMIN_TOKEN`. Works with no PostHog key.
3. Deploy. The browser only ever calls the Next.js `/api/*` proxy — the Railway URL
   stays server-side.

## 3. Supabase (Phase 5)

1. Create a project; run `supabase/migrations/0001_init.sql` in the SQL editor.
2. Enable email (magic link) auth to start.
3. Service gets `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` to mirror runs and resolve
   share slugs; the web app gets the public URL + anon key.

## 4. Stripe (Phase 5)

Two products (Pro $39/mo · $390/yr, Max $99/mo · $990/yr — §5 flat tiers, created by
`scripts/setup_stripe_v2.py`; the retired $29/$79 prices still exist because Stripe
prices are immutable) → Checkout links; a webhook → Vercel route updates
`profiles.plan`. Use the Stripe customer portal for cancel/upgrade — build
nothing custom.

### TEST vs LIVE mode (read before switching)

Stripe keeps **entirely separate** products, prices, customers, webhooks and API
keys per mode. Test-mode price IDs **do not exist in live mode** — a live key
with test price IDs makes checkout fail closed (503, by design: the route
verifies each price's `unit_amount` against `web/src/lib/pricing.ts`).

Going live is a per-mode repeat of the same setup:

1. Activate the Stripe account (business details + bank) — live charges fail
   until it is.
2. Put the live secret key in `.env` as `STRIPE_SECRET_KEY_LIVE` (keep
   `STRIPE_SECRET_KEY` on the **test** key so local dev and pytest never touch
   real money), then run `python scripts/setup_stripe_v2.py --live`. It creates
   the six live prices and PRINTS them without writing to local env files.
3. Create a **live** webhook endpoint at `<site>/api/stripe/webhook` with
   events `checkout.session.completed`, `invoice.payment_succeeded`,
   `customer.subscription.updated`, `customer.subscription.deleted`. Copy its
   signing secret. (Editing an existing endpoint's URL later **preserves** its
   signing secret — handy during a domain migration.)
4. In Vercel (Production): `STRIPE_SECRET_KEY` = the live key, the six live
   `STRIPE_PRICE_*` IDs, and `STRIPE_WEBHOOK_SECRET` = the live signing secret.
   Redeploy. **Without the webhook secret, production webhooks 503 and paid
   upgrades never reach `profiles.plan`.**

## Local development

```bash
# terminal 1 — service
set ANTHROPIC_API_KEY=...            # or export on mac/linux
set BACKTEST_CACHE_DB=engine/backtest_data.db
set SERVICE_DATA_DIR=service_data
python -m uvicorn service.main:app --port 8787

# terminal 2 — web
cd web && npm run dev                 # BACKTEST_API_URL defaults to 127.0.0.1:8787
```

## Pre-launch checklist

- [ ] Rotate the Anthropic API key that lived in the old desktop `config.yaml`
- [ ] Decommission the old live-bot server if it is still running
- [ ] `POLYGON_API_KEY` set in Railway (yfinance is dev-only)
- [ ] CORS locked to the Vercel domain
- [ ] Template stats rebuilt on production data
- [ ] Supabase SQL editor: paste `supabase/APPLY_ME_PART4.sql` (RPC lockdown — revokes PUBLIC execute on the credit RPCs)
