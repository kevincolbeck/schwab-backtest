# HANDOFF — resume point for the next build session

> Last updated: **2026-08-06**, /about + two production defects fixed. Live on
> chatbacktest.com with Stripe LIVE mode, Resend verified, analytics flowing.
> Tree clean at `1418c4b`.
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

- **§5 PRICING RESTRUCTURE: SHIPPED.** Per-action credits retired for flat
  capability tiers — Free $0 / **Pro $39/mo · $390/yr** / **Max $99/mo ·
  $990/yr** (annual = 2 months free). Capabilities gate what you may run
  (intraday = Pro+, ALL_US + crypto = Max, symbol caps, deployment slots);
  quiet per-day fair-use caps meter it; credits survive ONLY as invisible
  overflow past a cap. Lab usage meter **deleted**. Intraday deploy fees
  **retired**. New crypto plan gate (previously advertised but unenforced).
  Truth: `service/auth.py::PLAN_LIMITS` + `web/src/lib/pricing.ts`.
  Checkout verifies each Stripe price's `unit_amount` against
  `lib/pricing.ts` before charging, and there is deliberately **no fallback**
  to the retired $29/$79 prices — checkout 503s until the new env vars are
  set rather than silently mischarging.

- **P1-2 PER-PAGE SEO: SHIPPED (`1ad99da`), prod-verified.** Every route now
  sets its own title/description/canonical/OG/twitter via
  `web/src/lib/seo.ts::pageMetadata()`. Six routes previously had NO metadata
  and no route had ANY Open Graph tags. Spec titles verbatim for all five
  mandated pages. Site-wide OG card at `web/src/app/opengraph-image.tsx`.
  noIndex on /login /account /dashboard /admin /runs/[id] /s/[slug].
  Sitemap gained /playground + 16 live strategy-record pages (fetched from
  /leaderboard, revalidate 3600) and honest `lastModified` dates — 156 URLs
  on prod. **Acceptance is executable: `cd web && npm run seo -- <url>`.**
  Prod run: 31 routes, 30 unique titles, 30 unique descriptions, 0 problems.
  Adversarial review (14 agents, 4 lenses): 12 candidates -> 9 verified -> 3
  confirmed, all one defect — early-return branches in `generateMetadata`
  built bare `{ title, description }` objects and so inherited the ROOT's
  openGraph block + canonical. Worst case was `/stocks/[ticker]` in its
  "unavailable" state: a LIVE INDEXABLE page canonicalising to "/". Fixed in
  `4f08fee`. Deliberately NOT noIndexed that branch (a reviewer suggested it):
  those URLs are in the sitemap. **REVERSED on 2026-08-06 by the Google-docs
  pass**: `getStockBundle` degrades to "unavailable" on ANY non-ok response,
  so one blip during a crawl could publish up to 112 near-identical thin 200s
  and let Google pick its own canonical. That risk beats the sitemap-mismatch
  concern, and a noindex Google can READ is handled as "skip for now" rather
  than a permanent exclusion, so the sitemap entry stays honest. The `not_found` branches call `notFound()`
  and return real 404s, so their metadata never renders (fixed anyway,
  defensively).

- **P1-3 SHAREABLE RECORD CARDS: SHIPPED (`60d72ab`), prod-verified.** Landscape
  card gained CAGR + Sharpe (spec-required, were missing), labelled "backtest
  (hypothetical)" and kept subordinate to the verified forward number; the
  forward figure now carries "verified · N days" only past the 20-day window,
  otherwise "warming up · day N of 20". NEW square 1080x1080 card at
  `/strategy/[slug]/card` + a "Share this record" button (copy link +
  download). Both render from `web/src/lib/server/recordCard.ts` so claims
  can't drift between them.
  **BUG FOUND + FIXED: `/strategy/[slug]/opengraph-image` had been returning
  HTTP 500 in production since Phase G** — every shared record link previewed
  blank. Cause: Satori needs an explicit `display` on any element with >1
  child (`spec {hash}`). `check_seo.mjs` now FETCHES each og:image and asserts
  a 2xx image, which is why it missed this before.
- **GOOGLE SEO DOCS PASS: SHIPPED (`323b90e`).** Real brand icon
  (`app/icon.svg` + generated apple-icon) replacing the create-next-app Vercel
  triangle that had shipped since the first frontend commit; `app/robots.ts`
  (sitemap + param disallows, deliberately NOT blocking the noindex routes —
  that would stop Google reading the directive); `max-image-preview:large` +
  `max-snippet:-1` on indexable pages. Honest degraded states: the leaderboard
  no longer renders a 200 with zero links when the service is unreachable (a
  broken board must not look like an empty one), degraded `/stocks/[ticker]`
  is noindex so a blip can't publish 112 thin pages, and the empty
  market-data-deep-dives hub is out of the sitemap AND noindex (they must
  agree). Two audit claims were WRONG and dropped after verification —
  notably "/playground has no H1"; it has exactly one.

## Shipped since the last handoff (2026-08-06, late session)

- **`/about` — SHIPPED (`56e0d5d`), prod-verified.** Founder story in Kevin's
  voice at `web/src/app/about/page.tsx`; portrait is a background-removed
  cutout (`web/public/kevin.png`, GrabCut) laid over a CSS accent disc, so the
  asset stays reusable and the colour follows our tokens. It's in the sitemap
  in its own right: it carries the expertise/accountability signal Google
  looks for on YMYL topics, and every article byline points at it.
- **Blog byline is the COMPANY, not a person** — `AUTHOR` in
  `web/src/lib/blog.ts` is `{ name: "Chat·Backtest", url: "/about" }`. Kevin's
  call: the company is what's accountable for the claims in the articles.

- **JSX SPACING BUG — 125 sites, every article and every /docs page.**
  Next 16's transform DROPS whitespace between a closing inline tag and the
  text after it, so `<strong>Entry:</strong> buy when…` shipped as
  "Entry:buy when…". Babel preserved that space, which is why the source
  reads as correct and why it will keep getting reintroduced. Fixed with
  explicit `{" "}`; **`web/src/lib/jsxSpacing.test.ts` fails the build on the
  pattern.** Found by scanning RENDERED HTML — a 6-agent source proofread had
  returned zero findings, because the source is not where the bug is.

- **80 of 155 SITEMAP URLS WERE SERVING 404** (`1418c4b`). Finnhub's free tier
  allows ~50 calls/min and each stock bundle spends up to three, so anything
  walking the sitemap's stock section — Googlebot included — exhausts the
  budget in seconds; after that `_get_profiles()` stops asking and every
  uncached symbol returns None. `company_bundle()` read that as found:false,
  the page called `notFound()`, and the route's 6h ISR froze the 404 in.
  Fixes: profiles now report WHY they're None, `company_bundle()` returns
  `retryable`, the web layer maps retryable misses to the existing
  degraded+noindex render, and a failed call is no longer cached as a miss.
  The sitemap now reads `GET /stocks` (symbols with cached bars — the one
  path that makes no Finnhub call and therefore always renders) instead of
  hardcoding 112 sector symbols. Pinned by
  `service/tests/test_stock_bundle_retryable.py`.

  **Standing lesson: `npm run seo` checks metadata, not liveness. Crawl the
  sitemap and assert 2xx before trusting it.**

## NEXT UP (in spec order)

1. ~~**P1-2 per-page SEO**~~ — **SHIPPED.** Every route sets its own
   title/description/canonical/OG/twitter through `web/src/lib/seo.ts`
   (`pageMetadata()`). That helper exists because Next merges metadata
   SHALLOWLY: a page setting `title` but not `openGraph` inherits the ROOT's
   whole openGraph block, so its social preview would show the homepage's
   title. Client-component routes (playground/pricing/login) carry metadata
   in a sibling `layout.tsx`. Docs pages now set FULL titles and the docs
   `title.template` was removed (it would double-append). Site-wide social
   card at `web/src/app/opengraph-image.tsx`; routes with their own
   data-driven card (`strategy/[slug]`, `stocks/[ticker]`) pass
   `ogImage: null` so the segment's file convention wins. Verify with
   `cd web && npm run seo -- <base-url>` — it fails the build on duplicate
   titles/descriptions, a missing/duplicated H1, og:title≠title, or a missing
   og:image/canonical. Remaining §P1-2 bullet: "Template pages: [Strategy]
   backtest — …" needs Section 4's `/backtest/[slug]` routes, which don't
   exist yet.
2. ~~**P1-3 shareable record cards**~~ — **SHIPPED** (see above).
3. **P1-4 email sequences** — **UNBLOCKED.** Resend account is live, domain
   `chatbacktest.com` VERIFIED (DKIM+SPF+MX green), key in gitignored `.env`
   as `RESEND_API_KEY`. Nine emails + triggers specified in spec §6; branch
   off the P0-5 `backtest_run` / `deploy_completed` events. Kevin should
   rotate the key (it was pasted in chat) before/after building.
4. **P1-5 comparison pages** (6 competitors, factual tone).
5. Section 4 programmatic template pages `/backtest/[slug]` — when built,
   re-point blog article template-links, add per-template backlinks, add them
   to the sitemap, and satisfy §P1-2's last bullet ("Template pages:
   [Strategy] backtest — 10-year CAGR, drawdown & Sharpe"), which is the ONLY
   part of P1-2 still outstanding and is blocked on this.
6. ~~§5 pricing restructure~~ — **SHIPPED** (see above). Follow-ups it left:
   build the Max features §5 advertises but we refused to sell unbuilt
   (priority engine queue, verified-record badge, public profile page, early
   access), then add them to the pricing card in the same commit.

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
- SEO (P1-2): `web/src/lib/seo.test.ts` STATICALLY forbids hand-rolled
  metadata objects — a crawler cannot catch this, because degraded branches
  only run when the backend fails. If that test starts failing, the fix is to
  route the offending branch through `pageMetadata()`, never to relax the test.
- SEO (P1-2): Next merges metadata SHALLOWLY — setting `openGraph` in a page
  REPLACES the root's block. Never hand-write page metadata; always use
  `pageMetadata()` from `web/src/lib/seo.ts`, or og:title silently becomes the
  homepage's. Routes with their own `opengraph-image.tsx` must pass
  `ogImage: null`. Anything added to the sitemap must be indexable, and
  anything indexable should be in the sitemap — `npm run seo` enforces both.
- Pricing truth (§5): NOTHING is priced per action. Plans sell capabilities;
  quiet per-day caps meter usage; credits are invisible overflow only. Never
  reintroduce a usage counter into the lab, and never advertise a capability
  that isn't built (Max's "priority engine", "verified-record badge",
  "public profile", "early access" are in the §5 spec but NOT built — do not
  put them on the pricing page until they ship). Exports are free on every
  plan; only SHARE LINKS carry the free-tier watermark.

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

## Owed by Kevin (owner DECISIONS, not clicks — these block real SEO work)

- **An /about page.** Google holds financial ("Your Money or Your Life")
  topics to a higher experience/expertise/trust bar than anything technical we
  can ship. It needs the operating entity, who is behind it, why that person
  can build a backtesting engine, the business model, and a real support
  channel. I will not invent an identity — give me the facts and I'll write
  and wire it, plus the Organization JSON-LD that depends on it.
- **Blog bylines + AI-production disclosure.** The 6 articles have no author.
  Adding one means deciding how to characterise authorship honestly, since
  they were AI-drafted under your direction. That is a disclosure call, not an
  implementation detail — tell me the framing you want and I'll implement it.

## Owed by Kevin (owner clicks)

- **Stripe LIVE mode is CONFIGURED (2026-08-05).** Account verified:
  `charges_enabled`/`payouts_enabled` true, no outstanding requirements.
  Live webhook live at `https://chatbacktest.com/api/stripe/webhook` with the
  4 required events. Live prices created + amount-verified against
  `web/src/lib/pricing.ts` (price IDs are not secret):
  `STRIPE_PRICE_PRO_V2=price_1U1HiaEBdF4ChpMQ9ptKStTU`,
  `STRIPE_PRICE_PRO_ANNUAL=price_1U1HiaEBdF4ChpMQ4joh07E3`,
  `STRIPE_PRICE_MAX_V2=price_1U1HiaEBdF4ChpMQJ3VA2QkH`,
  `STRIPE_PRICE_MAX_ANNUAL=price_1U1HiaEBdF4ChpMQEzSQyqRb`,
  `STRIPE_PRICE_PACK_SMALL=price_1U1HibEBdF4ChpMQYt11miVH`,
  `STRIPE_PRICE_PACK_LARGE=price_1U1HibEBdF4ChpMQplt5jT8Q`.
  Local `.env` keeps `STRIPE_SECRET_KEY` on TEST and holds the live key only
  as `STRIPE_SECRET_KEY_LIVE` (read solely by `setup_stripe_v2.py --live`), so
  pytest and `npm run dev` can never touch real money. REMAINING: paste the
  six IDs into Vercel Production + redeploy. **DONE 2026-08-05** — verified
  from outside: apex serves 200 with no redirect, www 308s to it, the Stripe
  webhook answers 400 (signature check reached, no redirect), and checkout
  returns 401 "sign in first" (env loaded). The legacy $29/$79 env vars were
  deleted from Vercel and `scripts/setup_stripe.py` removed from the repo.
  Supabase Auth is repointed at the new domain (callback route verified live).
  Sitemap: 200 at the apex, 139 URLs, all apex-hosted; submitted to GSC (a
  "couldn't fetch" right after submission is normal queueing).
- ~~**Stripe LIVE-mode switch (in progress 2026-08-05).**~~ Kevin created a live
  Stripe account. Test and live are separate object graphs: the six test price
  IDs in local `.env` DO NOT exist in live. Sequence in docs/deploy.md §4
  "TEST vs LIVE": put the live key in `.env` as `STRIPE_SECRET_KEY_LIVE`
  (leave `STRIPE_SECRET_KEY` on TEST so pytest/dev never touch real money),
  run `python scripts/setup_stripe_v2.py --live` (prints six live IDs, writes
  nothing locally), create the LIVE webhook, then set in Vercel Production:
  live `STRIPE_SECRET_KEY`, the six live `STRIPE_PRICE_*`, and
  `STRIPE_WEBHOOK_SECRET`. **Until those are set, prod checkout returns 503 by
  design** (no fallback to $29/$79; the route verifies each price's
  `unit_amount` against `web/src/lib/pricing.ts`, so a test/live mix-up fails
  closed rather than mischarging). NOTE: the test-mode webhook still exists
  and is enabled — nothing was lost; webhooks are per-mode.
- Decide `FREE_CHAT_PER_DAY` (ships at 5; the case for 10 is in
  docs/pricing-model.md §5 — it's the one growth-vs-COGS dial).

- **Google Search Console** — property verified and sitemap submitted
  (2026-08-05). After P1-2 the sitemap grew 139 -> 156 URLs (added
  /playground + 16 strategy-record pages) and every page's title/description
  changed, so Google needs to re-crawl. Nothing to resubmit — Google refetches
  a known sitemap on its own schedule and the new `lastmod` dates signal the
  change. To speed up the pages that matter: URL Inspection -> "Request
  indexing" on `/`, `/library`, `/leaderboard`, `/playground` and the top blog
  posts (roughly 10/day quota). Expect Coverage/Pages counts to move over
  days, not hours.
- Archive prod duplicate `golden-cross-ddb5a4-5186` (SQL on Railway; status
  column is mutable).
- §10 blockers: #1 email provider (Resend/Loops) + key → unblocks P1-4;
  (#2 PostHog: DONE. #3 Stripe §5 prices: DONE — created in test mode; just set them in Vercel, see above.)
- Stripe is still test-mode (live-mode switch pending).

## Run / verify commands

- Service: port 8787, `BACKTEST_CACHE_DB=engine/backtest_data.db`,
  `SERVICE_DATA_DIR=service_data`. Web: `npm run dev` in `/web`
  (proxies via `BACKTEST_API_URL`).
- Tests: `python -m pytest` from repo root (237 green);
  `cd web && npm test -- --run` (43 green); `npm run build` green;
  `npm run lint` has exactly 3 pre-existing errors + 1 warning.
- SEO acceptance: `cd web && npm run seo -- https://chatbacktest.com`
  (or a local `npx next start` URL). Exits non-zero on any violation.
- Prod: web `chatbacktest.com` (canonical; `schwab-backtest.vercel.app` still
  resolves and should 308-redirect once the domain is primary in Vercel),
  service
  `schwab-backtest-production.up.railway.app` (`/healthz`). Admin ops need
  `x-admin-token` (value in gitignored `.env`).
