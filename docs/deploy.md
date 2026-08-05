# Deploying Chat-to-Backtest

Three pieces: the Python service (Railway), the web app (Vercel), the database (Supabase).
`railway.json` at the repo root pre-configures the Railway build (Dockerfile + healthcheck).

## 0. Supabase one-time setup (dashboard)

1. SQL editor → run `supabase/APPLY_ME_IN_SQL_EDITOR.sql`, then `supabase/APPLY_ME_PART2.sql`
   (part 2 is idempotent — safe to run even if part 1 fully applied).
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

Two products (Pro $29/mo, Max $79/mo) → Checkout links; webhook → a Vercel route
updates `profiles.plan`. Use the Stripe customer portal for cancel/upgrade — build
nothing custom.

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
