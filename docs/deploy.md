# Deploying Chat-to-Backtest

Three pieces: the Python service (Railway), the web app (Vercel), the database (Supabase).

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

5. Warm the cache after first deploy (Railway shell):
   `python engine/import_market_data.py --source polygon` for the template symbols,
   then `python scripts/build_template_stats.py` to refresh gallery stats.

## 2. Vercel — Next.js app

1. Import the repo, set **Root Directory = `web`**.
2. Environment variables:

   | Variable | Value |
   |---|---|
   | `BACKTEST_API_URL` | the Railway service URL (server-side only) |

   Later (Phase 5): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
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
