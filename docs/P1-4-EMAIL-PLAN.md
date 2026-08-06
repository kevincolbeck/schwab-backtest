# P1-4 email sequences — implementation plan (DEFERRED, not built)

> **Status: deferred 2026-08-06 by Kevin.** Production had **2 total signups**,
> both already activated and deployed — so the branching onboarding funnel had
> zero eligible recipients by construction. Deferred in favour of acquisition
> work (P1-5). Nothing in this document is built.
>
> This is the output of a 10-agent audit + design pass (6 infrastructure audits,
> 3 independent design lenses, 1 synthesis). It is preserved so P1-4 is a build,
> not a re-investigation. **Re-verify file:line references before relying on
> them — the codebase moves.**

## Why the spec cannot be built as written

§P1-4 says to branch off the `backtest_run` and `deploy_completed` events. Those
are fire-and-forget PostHog captures (`service/analytics.py:64`) that are a hard
no-op without `POSTHOG_KEY` and are **never persisted anywhere**. There is no
first-party event store and no PostHog read client in the repo.

The triggers must instead be derived from records that DO exist:
`SERVICE_DATA_DIR/backtest_runs.jsonl` (per-run `owner` + `timestamp_utc`) and
`forward.db` deployments — the same sources `/admin/metrics` already reads.

## Approach

Build P1-4 entirely on the Python service tier, in guardrail-first order, as a new `python -m service.email_worker` cron entrypoint modelled on `service/worker.py`. Spine = the safety lens (nothing capable of sending exists before the send-log, suppression list, and kill switches do; every gate aborts the whole pass rather than truncating it; `--send` is opt-in). Architecture = the minimal lens (a pure `select_email()` decision function over first-party state, plain PostgREST inserts against a `unique (user_id, email_key)` index as the atomic claim — NO SECURITY DEFINER RPCs, which would re-open the exact PART3→PART4 default-`EXECUTE`-to-PUBLIC hazard for zero benefit; per-user GoTrue `/auth/v1/admin/users/{id}` lookups, the shape `service/identity.py:107-130` already proves in production, instead of the never-exercised paged list endpoint). Operator surface = the ops lens minus its web admin UI (`--render-all`, `--to`, masked audience/log endpoints, `EMAIL_PAUSE_KEYS`, requeue) — a CLI preview gallery gives Kevin the same eyeballing with no new PII proxy. Triggers are recomputed each pass from the three sources `/admin/metrics` already trusts (Supabase `profiles`, `SERVICE_DATA_DIR/backtest_runs.jsonl`, `forward.db`), NOT from `backtest_run`/`deploy_completed` — those are fire-and-forget PostHog captures (`service/analytics.py:64-79`), unqueryable and a no-op without `POSTHOG_KEY`. Six of the nine spec §6 copy blocks make claims the data cannot support and are rewritten. Steps 1-13 are all safe to ship dark; step 14 (setting `RESEND_API_KEY` + `EMAIL_ENABLED=true` on Railway) is the single act that mails real humans.

## Steps

### 1. Step 0 — Owner preflight (blocks the LIVE step only, not the build)

Files: `docs/HANDOFF.md`, `docs/CHATBACKTEST-BUILD.md`

Non-code, and steps 1-13 proceed without it. (1) ROTATE `RESEND_API_KEY` — docs/HANDOFF.md:172 records it was pasted in chat; treat as compromised. It currently exists only in the gitignored repo `.env`, which `service/env.py` loads for local dev only, so production has no email capability at all today. (2) Owner supplies a physical postal address + legal entity name for the CAN-SPAM footer — nothing in the repo contains one; this hard-blocks the five commercial messages. (3) Add a DMARC DNS record (HANDOFF.md:170 confirms only DKIM+SPF+MX are green; Gmail/Yahoo bulk-sender rules want DMARC). (4) Confirm From/Reply-To identity — `kevin@chatbacktest.com` (web/src/app/about/page.tsx:167) is the only real address in the repo. (5) Resolve the `[DECIDE — Resend or Loops]` markers at docs/CHATBACKTEST-BUILD.md:130 and :266 to Resend, and clear §10 blocker #1 (docs/HANDOFF.md:307).

### 2. Step 1 — Email state schema in Supabase Postgres, no RPCs [DARK]

Files: `supabase/APPLY_ME_PART5.sql`, `supabase/migrations/0003_email.sql`, `supabase/APPLY_ME_PART3.sql`, `supabase/APPLY_ME_PART4.sql`

Postgres, NOT the SQLite volume: the cron writes sends and the API writes unsubscribes, and `forward.db` lives on one Railway volume (`service/forward.py:49-50`). Follow the repo convention — `APPLY_ME_PART5.sql` is the file pasted into the SQL editor, mirrored to `migrations/0003_email.sql`. Fully idempotent (`create table if not exists` throughout).

Three tables:
- `public.email_sends (id bigint generated always as identity primary key, user_id uuid not null references public.profiles(id) on delete cascade, email_key text not null, variant smallint not null default 0, status text not null default 'claimed' check (status in ('claimed','sent','failed')), provider_message_id text, last_error text, claimed_at timestamptz not null default now(), sent_at timestamptz)` plus `create unique index if not exists email_sends_once on public.email_sends (user_id, email_key)` and `create index if not exists email_sends_user_recent on public.email_sends (user_id, claimed_at desc)`. That unique index IS the entire anti-duplicate guarantee — the same primitive as `credits_ref_unique` (APPLY_ME_PART3.sql:14-15). The recent index serves the frequency cap in step 8.
- `public.email_optouts (user_id uuid primary key references public.profiles(id) on delete cascade, scope text not null default 'all' check (scope in ('marketing','all')), unsubscribed_at timestamptz not null default now(), source text not null default 'link')` — keyed by user id, because the unsubscribe link carries one.
- `public.email_suppressions (email_sha256 text primary key, reason text not null, created_at timestamptz not null default now())` — keyed by a SHA-256 of the lowercased address, because Resend bounce/complaint webhooks identify the recipient by address only and we have no user id. Storing the hash rather than plaintext keeps the repo's no-raw-email-at-rest posture (`service/identity.py:4-11`) intact; this synthesis deliberately rejects the plaintext `email_lower` PK one of the source plans proposed.

DELIBERATE OMISSION — no SQL functions. Two of the three source plans proposed `claim_email_send`/`email_claim` SECURITY DEFINER RPCs. A PostgREST `POST` that returns 201 vs 409 on the unique index is already an atomic claim, and every function added to `public` re-opens the exact class of bug APPLY_ME_PART4.sql exists to fix (Postgres grants EXECUTE to PUBLIC by default; PART3 revoked only from anon/authenticated, a no-op). Zero functions means zero grant surface. PART4's `alter default privileges in schema public revoke execute on functions from public` (verified at APPLY_ME_PART4.sql:16) is a backstop, not a substitute for not adding functions.

RLS mirroring credits_ledger (APPLY_ME_PART3.sql:17-22): `enable row level security` on all three; a self-readable SELECT policy on `email_sends` and `email_optouts` (`auth.uid() = user_id`) so a future account preference pane works; NO policy at all on `email_suppressions`; `revoke insert, update, delete on ... from anon, authenticated` on all three. Only the service role writes.

This file must be applied in the SQL editor BEFORE the service code that references it deploys. Step 3 makes that ordering safe by failing closed.

### 3. Step 2 — Extract DISCLAIMER to a leaf constants module [DARK]

Files: `service/constants.py`, `service/chat.py`, `service/main.py`

New `service/constants.py` holding `DISCLAIMER`, moved verbatim from `service/chat.py:38-41`. I verified that string is BYTE-IDENTICAL to `web/src/lib/constants.ts:1-2` ("Historical simulation for research and education. Not financial advice. Past performance does not predict future results."). `service/chat.py` re-exports (`from service.constants import DISCLAIMER`) so `service/main.py:60` (`DISCLAIMER = chat_brain.DISCLAIMER`) keeps working untouched.

CORRECTION to one source plan's stated rationale: it claimed importing `service.chat` "drags in the anthropic SDK". It does not — `import anthropic` is lazy, inside a function at `service/chat.py:291`. The real reasons are smaller but still valid: the email layer should not depend on the chat brain's prompt corpus, and the byte-equality test in step 12 needs one obvious home. Two-line change; do not over-justify it.

### 4. Step 3 — service/email_store.py: Supabase I/O that FAILS CLOSED [DARK]

Files: `service/email_store.py`, `service/credits.py`, `service/identity.py`, `service/metrics.py`

Built BEFORE any transport exists. Reuse the header pair proven in production at `service/credits.py:128-131` / `service/metrics.py:65-68` / `service/identity.py:113-116`: `{apikey: auth.SUPABASE_SERVICE_KEY, Authorization: f'Bearer {auth.SUPABASE_SERVICE_KEY}'}` against `{auth.SUPABASE_URL}`. Gate everything on `auth.auth_configured()`. No new dependency: `httpx` is a DIRECT dep already (`engine/requirements.txt:4`, `httpx>=0.25.0`, installed in the image per `service/Dockerfile:11`) and is imported across `service/`.

INVERT credits.py's contract and say so in the module docstring. `credits.py:178` documents "Fail-open: if credits are unreachable, allow". Email must fail CLOSED — a missed onboarding email is recoverable next pass; a duplicate is not.

API:
- `available() -> bool` — `auth.auth_configured()` plus a cheap `GET /rest/v1/email_sends?select=id&limit=1` probe cached ~60s. False aborts the entire sweep (this is what makes step 1's ordering safe: deploy the code before the SQL and it simply no-ops).
- `claim(user_id, email_key, variant) -> bool` — `POST /rest/v1/email_sends` with `Prefer: return=minimal`. True on 201; False on 409 (unique violation, i.e. already claimed/sent — the concurrency guard); False on ANY other status or transport error (never send what we cannot record).
- `finalize(user_id, email_key, status, message_id=None, error=None)` — PATCH the claimed row.
- `release(user_id, email_key)` — DELETE the claim after a TRANSIENT send failure so the next pass retries. Permanent failures keep the row at `status='failed'` and are NOT auto-retried; re-sending requires the operator to call requeue (step 9).
- `optout_user_ids(user_ids) -> set[str]` and `suppressed_hashes(hashes) -> set[str]` — batched `in.()` queries CHUNKED at ~200 ids per request so a large audience cannot produce a URL PostgREST rejects. A failed suppression query must RAISE, never return an empty set — an empty set silently mails everyone who opted out.
- `recent_claim_days(user_ids) -> dict[str,int]` — most recent `claimed_at` per user for the frequency cap.
- `record_optout(user_id, scope, source)` — POST with `Prefer: resolution=ignore-duplicates` (the pattern `service/auth.py:97-101` already uses).
- `suppress(email_sha256, reason)` — same.
- `fetch_contact(client, user_id) -> dict | None` — `GET {SUPABASE_URL}/auth/v1/admin/users/{user_id}`, byte-for-byte the call at `service/identity.py:111-117` INCLUDING the `{user: {...}}`-vs-flat unwrap at `identity.py:120`. Returns `{email, email_confirmed_at}`. DO NOT touch `service/identity.py` — its docstring (`identity.py:4-11`) and `service/tests/test_identity.py:80` pin the rule that a raw address never leaves that module; this is a deliberately separate, PII-carrying path.
  REJECTED: the paged `GET /auth/v1/admin/users?page=&per_page=` enumerator one source plan proposed. No code in this repo has ever exercised the list form, so its pagination contract and per_page ceiling are unvalidated — and it is unnecessary, because the audience is computed from first-party data FIRST, so only a handful of ids per pass ever need an address. N small sequential calls on a daily job is the right trade, and it means no code path can page the whole user base into memory.
- `email_hash(address) -> str` = `sha256(address.strip().lower())`; `mask(address) -> 'k•••n@gmail.com'`.
- `unsub_token(user_id) -> str` = truncated `hmac.sha256(EMAIL_UNSUB_SECRET, user_id)`; `verify_unsub(user_id, token) -> bool` using `hmac.compare_digest` on bytes (same discipline as `_require_admin`, `service/main.py:1285-1290`). Stateless, no DB round-trip to mint. No expiry — CAN-SPAM requires the link work ≥30 days after send.

NEVER log a recipient address; log `user_id` + `email_key` only.

### 5. Step 4 — service/emailer.py: Resend transport, three independent gates [DARK]

Files: `service/emailer.py`, `service/analytics.py`

Structurally modelled on `service/analytics.py`'s dormant-without-key pattern (`analytics.py:50-51`) but with the OPPOSITE delivery contract, stated in the docstring: `analytics.py:64-66` says "analytics must never be load-bearing" and drops silently; a dropped onboarding email is a product failure that must be recorded. So `send()` is SYNCHRONOUS, returns a result, and has no background queue and no daemon thread.

Three gates, all of which must pass, checked in this order:
1. `RESEND_API_KEY` present — deploys dormant, exactly like `POSTHOG_KEY`.
2. `EMAIL_ENABLED == 'true'` — the redeploy-free kill switch. Unset means `send()` returns `('blocked', 'disabled')` and the sweep still runs and reports what it WOULD have sent.
3. `EMAIL_ALLOWLIST` — comma-separated addresses; when set, any recipient not in it is refused with `('blocked','not-allowlisted')`. This is the staged-rollout mechanism (step 14), not a debug flag.

`send(to, subject, html, text, unsubscribe_url, headers_extra) -> (status, detail, message_id)`. `POST https://api.resend.com/emails`, `Authorization: Bearer {RESEND_API_KEY}`, 15s timeout. ONE retry on 5xx/timeout only; 429 backs off and reports failure; NEVER retry a 4xx — a retried 422 is how you double-send. Classify 4xx as permanent, transport/5xx as transient; the caller uses this to decide release-vs-keep.

Every message carries `From: {EMAIL_FROM}` (default `Chat·Backtest <hello@chatbacktest.com>`), `Reply-To: {EMAIL_REPLY_TO}` (default `kevin@chatbacktest.com`), and RFC 8058 headers `List-Unsubscribe: <{unsubscribe_url}>, <mailto:unsubscribe@chatbacktest.com>` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. Required by the Gmail/Yahoo bulk-sender rules for the commercial messages; putting them on all nine costs nothing.

`send()` REFUSES any call with more than one recipient. There is no batch path in this design; a to-array is how a bulk leak happens. Sequential sends with a small sleep to stay under Resend's default rate limit.

### 6. Step 5 — Widen metrics.py's first-party readers (one manifest pass, existing callers untouched) [DARK]

Files: `service/metrics.py`, `service/forward.py`, `service/runs_store.py`, `service/run_snapshots.py`

Extend `service/metrics.py` — it already owns every first-party cohort reader and is already trusted by `/admin/metrics`. All three additions are backward-compatible; do NOT add a second scanner of the same file.

1. `fetch_profiles() -> Tuple[List[dict], bool]` — a copy of `fetch_signups()` (metrics.py:55-100) with `select=id,plan,created_at`. Keep `fetch_signups()` as a thin wrapper mapping to `(id, created_at)` tuples so `dashboard()` (metrics.py:221) is untouched. PRESERVE the `offset += len(rows)` discipline at metrics.py:96 and the comment explaining it — it exists to survive a Supabase Max-Rows setting below the page size.
2. `run_activity_by_owner() -> Dict[str, dict]` — ONE streaming pass over `runs_store.DATA_DIR / 'backtest_runs.jsonl'` returning `{owner: {first, last, runs, distinct_specs, runs_last_14d}}`. `distinct_specs` dedupes on `spec_hash_sha256` (written at `service/run_snapshots.py:139`) — SKIP `None`, which that field is for non-dict specs. `last` is max `timestamp_utc`, falling back to `_run_id_time` (metrics.py:45-52). Rewrite `first_runs_by_owner()` (metrics.py:103-128) to delegate, KEEPING the legacy-row fallback at metrics.py:119-122 (pre-P0-5 rows have no `owner` key and require opening the payload) and the `owner in (None,'house')` exclusion.
   DO NOT use `runs_store.list_runs_for_owner` for the Email-5 count: it is hard-capped at `limit: int = 50` (`service/runs_store.py:109`) AND opens every run payload — it would silently plateau and be slow.
3. `deploy_activity_by_owner() -> Dict[str, dict]` — extend `first_deploys_by_owner()` (metrics.py:131-148) to also return `last`, `count`, and the `(slug, name, visibility, deployed_at)` list from `forward.list_deployments('active'|'archived')`. Slugs are what Email 4 links and what W1's rank lookup keys on. Keep `first_deploys_by_owner()` as a wrapper.
4. `sources_healthy() -> Tuple[bool, str]` — the manifest file exists AND `forward._db_path()` exists AND `fetch_profiles()` returned `complete=True`. THIS IS THE SINGLE MOST IMPORTANT GUARDRAIL IN THE PLAN; see step 8 gate 1.

No new SQL and no writes to `public.runs` — that table exists (`supabase/migrations/0001_init.sql:23-37`) but nothing writes to it; the docstrings claiming a Supabase mirror (`runs_store.py:5-6`, `forward.py:21-22`) are aspirational. The manifest is the real source and this design must not pretend otherwise.

### 7. Step 6 — service/email_templates.py: nine templates, corrected copy, A/B subjects [DARK]

Files: `service/email_templates.py`, `service/constants.py`, `templates/_stats.json`, `docs/CHATBACKTEST-BUILD.md`

Pure content, zero I/O, so the compliance test in step 12 imports it freely. Plain Python functions — do NOT add Jinja; `service/requirements.txt` is deliberately four packages. A frozen `SEQUENCE` list of dataclasses: `key`, `kind` ('transactional'|'commercial'), `subjects` (an A/B 2-tuple), `required_ctx` (merge fields that MUST resolve or the send is skipped), `render(ctx) -> (subject, html, text)`. Keys: `welcome`, `d1_no_backtest`, `d2_no_deploy`, `d4_deployed`, `d7_free_active`, `d14_power`, `winback_14`, `winback_30`, `winback_45`.

One `_layout()` wrapper, table-based HTML with inline styles only (no external assets), plus a real text/plain part, injecting on ALL NINE: `constants.DISCLAIMER`, "You're getting this because you created a Chat·Backtest account", the unsubscribe URL, `EMAIL_POSTAL_ADDRESS`, and links to /privacy and /terms. `_layout()` RAISES if `EMAIL_POSTAL_ADDRESS` is unset and `kind == 'commercial'`, so the sweep aborts rather than shipping a non-compliant message. `html.escape` every merge field.

Links use a new `PUBLIC_WEB_URL` env (default `https://chatbacktest.com`) — the service has no notion of the public site origin today, only `ALLOWED_ORIGINS` (`service/main.py:55`). All links carry `?utm_source=lifecycle&utm_campaign=<key>&utm_content=<variant>`.

A/B: `variant = int(sha256(f'{user_id}:{email_key}'.encode()).hexdigest()[:8], 16) % 2`. Deterministic, stateless, and PERSISTED to `email_sends.variant` — that column IS the attribution record. `analytics.capture('lifecycle_email_sent', user_id, {email_key, variant})` is emitted best-effort for funnel joins but CANNOT be the record: `analytics.py:64-79` drops events by design.

SIX COPY DEVIATIONS from spec §6 — all three source plans converged on these independently; each is required because the data cannot support the written claim. Record them inline in docs/CHATBACKTEST-BUILD.md §6 as implemented-with-deviation so a future reader does not "restore" the spec wording:
1. Email 1's "4-second win" is false for golden-cross. I read `templates/_stats.json`: golden-cross `elapsed_seconds` is 18.1 (buy-the-dip is 2.21, 52-week-high 29.68). AND the deep link only PRE-LOADS the spec — `web/src/app/playground/page.tsx:242-250` sets state, there is no auto-run. Use "Run the Golden Cross backtest →" + "ten years of data replays in seconds". The id `golden-cross` and the `?template=` param are both confirmed real.
2. Email 2's "the 3 most popular templates" is not computable: the `backtest_run` event records `template` as a BOOLEAN (`service/main.py:455`), no template id, and no popularity counter exists anywhere. Link three NAMED starters (`golden-cross`, `rsi2-mean-reversion`, `buy-the-dip`) as `/playground?template=<id>` and say "three to start with" — never "most popular" (CLAUDE.md:77 cherry-picked-stats ban; spec §9:259 accuracy). Note §4's `/backtest/[slug]` pages do not exist (confirmed absent from `web/src/app`), so /playground and /library are the only valid destinations.
3. Email 4: `VERIFY_DAYS = 20` (`web/src/lib/server/recordCard.ts:37`, mirroring `forward.py:44 MIN_LEADERBOARD_DAYS`), so a card linked four days after deploy ALWAYS renders "warming up". Copy must say so. "When it wins, you called it in public" MUST GO — a conditional promise of profit is squarely inside CLAUDE.md:76's ban list. Replace with "Win or lose, it's timestamped and verifiable." Links `{PUBLIC_WEB_URL}/strategy/{slug}` and `/strategy/{slug}/card` (both confirmed to exist).
4. Email 5's `[N]` uses `distinct_specs` from step 5, and the send is SKIPPED entirely when N < 1 — a wrong N in a subject line is both a §9:259 accuracy breach and CAN-SPAM deceptive-subject exposure.
5. W1's "[strategy] moved to [rank]" implies rank history, which is stored NOWHERE — `forward.db` has exactly four tables (deployments, forward_signals, forward_equity, worker_runs) and rank exists only as a render-time array index at `web/src/app/leaderboard/page.tsx:203`. Re-derive the PRESENT rank as the 1-based position of the slug in `forward.leaderboard()` (already sorted by `forward_return_pct` desc, `forward.py:600`) and OMIT the rank clause entirely when the slug is absent (below `MIN_LEADERBOARD_DAYS`) — the omit-when-unknown precedent is `web/src/components/ShareToX.tsx:39-44`. Copy is "is currently #N", not "moved to". Label the number "verified forward" IN TEXT, never colour alone (CLAUDE.md:32-33, spec:42 — mail clients strip CSS anyway).
6. W2's "a notable recent result" is cherry-picking by construction (CLAUDE.md:76). Use one disclosed deterministic rule — the top verified entry from `forward.leaderboard()` — and say so in the copy.
Also: Emails 5 and 6 carry the pricing-page qualifier verbatim, "Research and education only — never trade recommendations" (spec:171). Email 6 must not drift toward follower-monetization framing — that is attorney-gated (spec:260). No countdown/urgency framing anywhere (CLAUDE.md:76; and the launch date the §P0-1 countdown depends on is still an open owner blocker at spec:269). Any email quoting a return/Sharpe/rank is a results surface under CLAUDE.md:30-31 and carries the disclaimer via the shared footer.

### 8. Step 7 — service/email_sequences.py: the pure trigger selector [DARK]

Files: `service/email_sequences.py`

Pure over plain dicts — no network, no Supabase, no clock beyond the injected `as_of`. This is where the tests live.

`select_email(profile, run_activity, deploy_activity, sent_keys, as_of_date) -> str | None`, returning AT MOST ONE key per user per pass, priority-ordered (welcome > onboarding > win-back). Each trigger names its OWN ANCHOR:
- `welcome` — `0 <= days_since_signup < LOOKBACK`. Backstop for a failed instant hook (step 10).
- `d1_no_backtest` — day 1 since signup, user absent from run_activity.
- `d2_no_deploy` — day 2 since signup, runs >= 1, deploys == 0.
- `d4_deployed` — 4 days since FIRST DEPLOY, not since signup.
- `d7_free_active` — day 7 since signup, `plan == 'free'`, `distinct_specs >= 1`.
- `d14_power` — day 14 since signup, deploys >= 1, AND `runs_last_14d >= EMAIL_HIGH_USAGE_RUNS` (env, default 10). "High usage" is undefined in the spec and must be an explicit tunable, not a magic number. The in-process daily counter at `service/auth.py:127-144` is explicitly non-durable, so the manifest is the only usable proxy.
- `winback_14 / winback_30 / winback_45` — 14/30/45 days since `last_activity = max(last_run, last_deploy)`, AND runs >= 1. Never-active users already got d1/d2; win-backs are not a second nudge. `winback_14` additionally requires deploys >= 1, because its copy claims "your strategies are still scoring" — false without a deployment.

RESOLVED DISAGREEMENT — WINDOWS, NOT `>=`. One source plan used open-ended `days >= N` for its self-healing replay property (mirroring `forward.run_worker`). Rejected: combined with the once-ever unique index, `>=` means a user who signs up and never runs gets "Did the market break your idea yet?" on day 200, and it is precisely what makes the first-enable blast catastrophic. Use a half-open window `N <= days < N + EMAIL_LOOKBACK_DAYS` (default 2): one missed cron day still delivers, a week-long outage cannot produce a backlog blast. Because the windows overlap at the boundaries, the one-email-per-user-per-pass priority ordering is load-bearing, not cosmetic.

RESOLVED DISAGREEMENT — EMAIL 4 ANCHOR. Anchored to first deploy, not signup. The content is about the record, that anchoring makes the warming-up state coherent, and signup-anchored + windowed would silently skip every user who deploys after day 5.

COLD-START FLOOR: `EMAIL_SEQUENCES_START` (ISO date). Exclude every user whose `profiles.created_at` predates it. This means the existing base gets NOTHING, ever — the conservative default, and the right one given there is no consent record anywhere in `web/src`. Overridable by a deliberate `--since` for a one-off backfill.

Days are computed on UTC dates (`created_at` is tz-aware after `metrics._parse_iso`). Note in the docstring: there is NO last-login signal anywhere — `auth.users.last_sign_in_at` is never fetched — so "inactive" means "no backtest runs and no deploys". A user who browses the leaderboard daily will receive all three win-backs.

### 9. Step 8 — service/email_worker.py: the sweep, where every safety gate lives [DARK]

Files: `service/email_worker.py`, `service/worker.py`, `service/forward.py`

`sweep(as_of=None, send=False, limit=None, only_user=None, only_key=None, redirect_to=None) -> dict`. Every gate below aborts BEFORE the first send, not partway through:
1. `metrics.sources_healthy()` false → abort with reason. THE critical guard: if the cron container lacks the `/data` volume, the manifest and `forward.db` are absent, EVERY user looks like "signed up, never ran a backtest", and the sweep mails the entire base a Day-1 nudge. Refusing to run on missing inputs makes both Railway topologies safe.
2. `email_store.available()` false → abort. Fail-closed.
3. `EMAIL_SEQUENCES_START` unset → abort.
4. Load `metrics.fetch_profiles()` (abort if not complete — a partial user list must never drive sends, the same rule `metrics.dashboard` applies to caching at metrics.py:223), `run_activity_by_owner()`, `deploy_activity_by_owner()`, and the full `email_sends` key set. Call `forward.leaderboard()` AT MOST ONCE and only if a `winback_14` candidate exists — it is expensive (`forward_summary` per deployment, a fresh SQLite connection per `list_deployments` call); reduce it to `{slug: rank}`.
5. `select_email` per user → candidates. One email per user per pass.
6. Global frequency cap via `email_store.recent_claim_days()`: never two emails to one user inside `EMAIL_MIN_GAP_DAYS` (default 2).
7. Drop opted-out users (`email_optouts`) for `kind == 'commercial'`; drop `scope='all'` opt-outs for everything. Resolve contacts (`fetch_contact`), drop unconfirmed addresses (see below), drop hash-suppressed addresses for ALL kinds including transactional — a hard bounce or complaint suppresses everything.
8. Drop any candidate whose `required_ctx` did not resolve; drop `owner == 'house'`.
9. `EMAIL_MAX_PER_PASS` (default 50): if the final audience exceeds it, ABORT the pass and report loudly. Do NOT truncate — truncation silently strands users outside the look-back window, and an unexpectedly large audience is exactly the signal something upstream is wrong. (One source plan truncated; rejected.)
10. `EMAIL_PAUSE_KEYS=winback_14,winback_30` skips specific keys without a redeploy.

THE UNCONFIRMED-EMAIL FILTER IS LOAD-BEARING. `email_confirmed_at` must be non-null. `profiles.created_at` is stamped by the `on_auth_user_created` trigger at `auth.users` INSERT (APPLY_ME_PART3.sql:76-79), which for magic-link/OTP is when the email is SENT, not clicked — documented at `web/src/app/auth/callback/route.ts:7-17`, the exact reason the existing `signup` event keys off `email_confirmed_at`. Without this filter the Day-1 email targets abandoned signups and bounces against a domain with no sending reputation.

Per candidate the order is CLAIM → RENDER → SEND → FINALIZE. Claiming first means a crash between claim and send loses that email permanently rather than sending it twice — the correct failure direction. Transient failure → `release()` so the next pass retries; permanent failure → `finalize(status='failed')`, left in place, NOT auto-retried. An exception on one user must never abort the pass — collect into `errors` the way `forward.run_worker` does (`forward.py:501-502`). Return `{as_of, dry_run, evaluated, audience, sent, skipped_reasons, failed, errors}` — user ids and MASKED addresses only, never a raw address.

CLI, argparse shim in the exact shape of `service/worker.py` (JSON to stdout, exit 1 iff errors), but with the default INVERTED: **`--send` is required to actually transmit.** Anything without it computes the audience, renders every message, and prints what WOULD go out. Flags: `--as-of`, `--send`, `--limit`, `--only-user`, `--only-key`, `--to <address>` (render the real audience but redirect every message to one inbox; forces no-ledger-write), `--render-all --out <dir>` (write all 18 subject/body combinations as .html to open in a browser — the offline preview gallery), `--since`.

Do NOT bolt this onto `forward.run_worker`: its contract is "iterate deployments" and its result dict (`forward.py:513-514`) has no place for per-user outcomes. More importantly, its entire idempotency model is replay-and-upsert — safe for rows, catastrophic for email.

### 10. Step 9 — service/main.py endpoints: welcome hook, admin ops, unsubscribe, webhook [DARK]

Files: `service/main.py`

All new routes go beside the existing three admin routes (`main.py:1295-1316`).

Behind the unchanged `_require_admin` (`main.py:1281-1292` — 404 when `ADMIN_TOKEN` is unset so the surface stays hidden, constant-time `hmac.compare_digest` on bytes):
- `POST /admin/email-sweep?as_of=&send=false&limit=` — mirrors `/admin/run-worker`'s shape (`main.py:1304`). DEFAULT `send=false`.
- `GET /admin/email/preview?key=&variant=&user=` — rendered subject + html + text; with no user id, renders against a synthetic fixture so it works before anyone qualifies.
- `GET /admin/email/audience?as_of=` — today's computed audience: user id, MASKED address, email_key, variant, and the reason each user qualified. The "what is about to happen" surface.
- `GET /admin/email/log?limit=` and `POST /admin/email/requeue` — read the send ledger and recover `failed` rows. Requeue must refuse to touch `status='sent'`.

CRITICALLY: do NOT add a `web/src/app/api/admin/email/...` proxy. `/admin/metrics` is safely proxied (`web/src/app/api/admin/metrics/route.ts`) because `metrics.weekly_cohorts` returns pure aggregates and no user id leaves the process. These responses carry user ids and masked PII and include a WRITE; keep them curl-only against the Railway origin. (One source plan proposed a full web admin UI for this — deferred; the `--render-all` gallery gives the same eyeballing at zero risk.)

Public routes:
- `POST /me/welcome-email`, `user: Optional[dict] = Depends(current_user)` (`main.py:107`). 401 if anonymous. The service resolves `{id, email, plan}` from the Bearer token itself via `auth.get_user` (`auth.py:59-81`), so the caller never asserts an identity and NO new shared secret is introduced. Body: `claim('welcome')` → render → send → finalize → capture. Returns `{sent: bool}`. RESOLVED DISAGREEMENT: one source plan ran the cron HOURLY to avoid a second send path. Rejected — hourly means every gate runs 24×/day and "instant" still means "up to 60 minutes". Instead there is ONE send IMPLEMENTATION (`_send_one(user_id, key)`, shared with the sweep) invoked from two places; the `email_sends` unique index makes the double path provably safe, and the sweep's `welcome` window is the backstop.
- `POST /email/unsubscribe` — PUBLIC, no bearer, verified SOLELY by the step-3 HMAC token. Accepts `scope=marketing|all`. Writes `email_optouts`. Returns 200 with no body for the RFC 8058 one-click case. Never reveals whether the user id exists.
- `POST /email/webhook` — Resend calls Railway directly, no Vercel hop. RESOLVED DISAGREEMENT: two source plans put this on the web tier; the service wins because the suppression table, the sha256 helper, and every other email-state write already live here, and the web tier uses a DIFFERENT Supabase URL var name (`NEXT_PUBLIC_SUPABASE_URL` vs the service's `SUPABASE_URL`), which is an easy way to ship a silently broken writer. Verify the Svix signature BY HAND — HMAC-SHA256 over `{id}.{timestamp}.{body}` with the base64-decoded `RESEND_WEBHOOK_SECRET`, `hmac.compare_digest` on bytes, plus a timestamp-freshness check — rather than adding the `svix` package to a four-line requirements file. An unverified webhook is an anyone-can-suppress-anyone endpoint; reject unsigned requests, and no-op entirely when the secret is unset. On `email.bounced` (hard only) and `email.complained` → `email_store.suppress(sha256(address), reason)`. Soft bounces do not suppress.

### 11. Step 10 — Fire the welcome email instantly from the auth callback [DARK]

Files: `web/src/app/auth/callback/route.ts`, `web/src/lib/server/backend.ts`

Inside the EXISTING `after(async () => {...})` block at `web/src/app/auth/callback/route.ts:91-94` (which already runs post-redirect, so it can never slow or break login), add a fetch to `${BACKTEST_API_URL}/me/welcome-email` with `Authorization: Bearer ${accessToken}`, wrapped in try/catch, ignoring the result.

I verified the session is available: `exchangeCodeForSession` and `verifyOtp` both return `AuthTokenResponse` = `{ user: User, session: Session }` (checked in `web/node_modules/@supabase/auth-js/dist/module/lib/types.d.ts:223-226` and `GoTrueClient.d.ts:858-860`). Capture `data.session?.access_token` alongside `data.user` at lines 50-56.

It sits inside the `isSignup` branch, so it inherits the existing 10-minute-confirmation-window + `cb_su` same-device dedup guard; the service's unique index catches the rest. Use `BACKTEST_API_URL` from `web/src/lib/server/backend.ts:2-3` DIRECTLY rather than `proxyJSON` — there is no Request to forward and we do not want the client-IP/proxy-secret headers on this call.

READ (do not modify) the TRIPWIRE comment at lines 13-17: if Phase E ever adds email+password, client-side `signUp()` bypasses this route entirely and the welcome hook must move. The sweep's `welcome` window covers that case anyway. Note this file is Next.js 16.2.12 — check `node_modules/next/dist/docs/` before editing, per `web/AGENTS.md`.

### 12. Step 11 — Unsubscribe page + preference toggle on the web tier [DARK]

Files: `web/src/app/unsubscribe/page.tsx`, `web/src/app/api/unsubscribe/route.ts`, `web/src/app/account/page.tsx`

Read `node_modules/next/dist/docs/` first — this is Next 16.2.12 and `web/AGENTS.md` warns it differs from training data. Nothing here exists today: a repo-wide grep for "unsubscribe" returns only an RxJS teardown at `playground/page.tsx:192`.

`web/src/app/unsubscribe/page.tsx` (server component): reads `?u=` and `?t=`, renders either "Invalid link" or a CONFIRM FORM that POSTs. It performs NO WRITE. Corporate mail scanners and link prefetchers follow every GET in a message; a mutating GET produces phantom unsubscribes. Scanners do not POST. Offer "marketing only" vs "all lifecycle email" as separate choices. No login required — CAN-SPAM forbids requiring anything beyond a single web page. Mark `noIndex: true` via the existing `pageMetadata()` helper (the pattern at `web/src/app/account/page.tsx:9-15`).

`web/src/app/api/unsubscribe/route.ts`: `export async function POST` handling both the form submit and the RFC 8058 one-click body (`List-Unsubscribe=One-Click`). Proxies to the service's `POST /email/unsubscribe`; returns 200 with no body for one-click, a redirect to a confirmation for the form.

`web/src/app/account/page.tsx`: add a preference toggle beside the existing Plan block (around lines 51-80), writing through the same route. RLS from step 1 already allows the self-read.

### 13. Step 12 — Tests: pin the guardrails, not the happy path [DARK]

Files: `service/tests/test_email_sequences.py`, `service/tests/test_email_templates.py`, `service/tests/test_email_worker_safety.py`, `service/tests/test_analytics_events.py`, `service/tests/test_supabase_grants.py`

Follow the conventions in `service/tests/test_analytics_events.py` — module docstring stating the contract under test, monkeypatched collaborators, FastAPI TestClient for routes. Suite is currently 237 green.

`test_email_sequences.py` (pure, no network): each of the nine triggers fires on its own cohort and NOT the day before or after; at most one key per user per pass; already-sent keys skipped; a user who ran a backtest never gets `d1_no_backtest`; a deployed user never gets `d2_no_deploy`; `d7_free_active` skipped when `distinct_specs == 0` and never fires for pro/max; win-backs never fire for a user with zero runs; `owner == 'house'` never appears; `EMAIL_SEQUENCES_START` excludes back-catalogue users; the look-back window covers a one-day gap but not a 200-day-old signup; `d4_deployed` fires for a user who deploys on day 30 (anchor check); `run_activity_by_owner()` produces the SAME first-run map as the pre-refactor `first_runs_by_owner` so the /admin/metrics change is behaviour-preserving.

`test_email_templates.py` — the compliance gate, and the ONLY automated enforcement of CLAUDE.md's ban list that will ever exist for email copy (the ban list at CLAUDE.md:76-77 is never restated in the spec §6 an implementer reads): every rendered body and BOTH subject variants scanned, case-insensitive, for `edge|autopilot|execute|guaranteed|will win|when it wins|most popular|risk-free|buy now|sell now` and countdown phrasing; no template names a ticker with a buy/sell verb; every one of the nine bodies contains the disclaimer, an unsubscribe URL and the postal address in BOTH html and text; the disclaimer asserted BYTE-EQUAL against the string read out of `web/src/lib/constants.ts:1-2` (I verified they currently match); commercial templates raise when `EMAIL_POSTAL_ADDRESS` is unset; variant assignment stable per (user_id, email_key) and the two variants non-identical; a strategy named `<script>` renders escaped; all nine keys present (the spec acceptance criterion, CHATBACKTEST-BUILD.md:211).

`test_email_worker_safety.py` — the important one. With a stubbed transport recording calls, assert ZERO sends when: `--send` is absent; `EMAIL_ENABLED` unset; `RESEND_API_KEY` unset; `sources_healthy()` false; `email_store.available()` false; `EMAIL_SEQUENCES_START` unset; the candidate predates the start date; the user is opted out, hash-suppressed, or unconfirmed; the audience exceeds `EMAIL_MAX_PER_PASS` (ABORTS, does not truncate); the address is not in a set `EMAIL_ALLOWLIST`; `claim()` returned False. Plus: a second sweep over identical data sends nothing; at most one message per user per pass; no `/admin/email/*` response contains an `@` (the mirror of the PII pin at `test_identity.py:80`).

Extend `test_analytics_events.py`'s admin-guard assertions to the new `/admin/email/*` routes (404 without `ADMIN_TOKEN`, 403 on a bad one). Extend `test_supabase_grants.py` with a test asserting PART5 declares NO `create function` at all — that is the structural reason this design is immune to the PART3→PART4 incident.

### 14. Step 13 — Privacy, Terms, footer links (owner content required) [DARK]

Files: `web/src/app/privacy/page.tsx`, `web/src/app/terms/page.tsx`, `web/src/app/layout.tsx`, `web/src/app/sitemap.ts`

I confirmed neither route exists — `web/src/app` contains about, account, admin, api, auth, blog, dashboard, docs, leaderboard, library, login, markets, playground, pricing, runs, s, stocks, strategy, and nothing else. So email footers currently have nothing to link to, while Resend's AUP, Google's bulk-sender guidance and GDPR Arts. 13-14 all assume they exist.

Add both as static pages using the existing `pageMetadata()` + `Card` patterns. Add them to the footer at `web/src/app/layout.tsx:57-83` (which today carries only Leaderboard / Pricing / The Lab plus the `DISCLAIMER` constant) and to `web/src/app/sitemap.ts`.

Privacy must state what is collected (email, plan, run/deployment history, the `cb_aid` analytics id), that PostHog is a processor, and how to exercise access/erasure. Flag in the copy — and in HANDOFF — the unresolved tension: the forward ledger is deliberately append-only and frozen-spec immutable (CLAUDE.md:32, spec:253) and W3's copy promises the record persists, while GDPR erasure may require deleting it. That is an owner decision, not an implementation one.

This step is content-blocked on the owner, which is why it is separated from the code steps — but it MUST land before step 14 enables the five commercial messages.

### 15. Step 14 — Deploy config, cron, and the staged rollout runbook [THIS IS THE STEP THAT MAILS REAL HUMANS]

Files: `docs/deploy.md`, `docs/HANDOFF.md`, `docs/CHATBACKTEST-BUILD.md`, `web/.env.example`

docs/deploy.md §0: add "run `supabase/APPLY_ME_PART5.sql`" (the file currently lists only PART1 and PART2 at lines 7-9 — PART3/PART4 are already undocumented there, worth fixing in the same pass).

Railway env table (currently lines 20-30, with NO email var at all): add `RESEND_API_KEY`, `EMAIL_ENABLED` (ships unset), `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_SEQUENCES_START`, `EMAIL_ALLOWLIST`, `EMAIL_MAX_PER_PASS`, `EMAIL_LOOKBACK_DAYS`, `EMAIL_MIN_GAP_DAYS`, `EMAIL_HIGH_USAGE_RUNS`, `EMAIL_PAUSE_KEYS`, `EMAIL_UNSUB_SECRET`, `EMAIL_POSTAL_ADDRESS`, `PUBLIC_WEB_URL`, `RESEND_WEBHOOK_SECRET`. Vercel table (lines 46-52): nothing new is strictly required, since the unsubscribe route proxies to the service.

New deploy.md step 1.8: a THIRD Railway cron service on the same image (the existing two are `0 23 * * 1-5` and `0 1 * * 2-6` running `python -m service.worker`, deploy.md:34-37). Command `python -m service.email_worker --send`, schedule `0 14 * * *` UTC (≈10am ET). DAILY, not weekday-only — day-14/30/45 offsets do not respect market days, and deliberately not the 23:00/01:00 forward-worker slots.
CRITICAL PRE-FLIGHT TO DOCUMENT: this cron MUST mount the SAME `/data` volume as the API (`SERVICE_DATA_DIR=/data`, `service/Dockerfile:20`), because `backtest_runs.jsonl` and `forward.db` are the ENTIRE activation signal. Verify with `python -m service.email_worker` (no `--send`) in a Railway shell BEFORE anything else. Railway attaches a volume to a single service, so this may not be possible — if it is not, gate 1 in step 8 makes the pass safely no-op, and the fallback is to change the cron command to a curl of `POST /admin/email-sweep?send=true` with the `x-admin-token` header, which always executes inside the API container. Everything else is identical either way.

docs/CHATBACKTEST-BUILD.md: resolve `[DECIDE — Resend or Loops]` at :130 and :266 to Resend, and record the six step-6 copy deviations inline in §6.
docs/HANDOFF.md: P1-4 → shipped-but-gated; drop §10 blocker #1 at :307; keep the key-rotation item live; record the new invariants (cold-start floor, volume pre-flight, unconfirmed-email filter, abort-not-truncate).

ROLLOUT RUNBOOK — each stage held until the previous is clean:
1. Apply PART5. Deploy service + web with `EMAIL_ENABLED` UNSET and no `RESEND_API_KEY`. Everything above is inert. Run `--render-all --out ./preview` and open the 18 HTML files in a browser.
2. Set `RESEND_API_KEY` (the ROTATED one) on Railway. Still no `EMAIL_ENABLED`. Run a dry pass; read `/admin/email/audience`; verify audience sizes are single-digit and every merge field resolved.
3. Set `EMAIL_SEQUENCES_START` to tomorrow, `EMAIL_ALLOWLIST` to Kevin's address only, `EMAIL_MAX_PER_PASS=5`, then `EMAIL_ENABLED=true`. **This is the moment mail can leave the building.** Sign up a fresh test account and walk all nine triggers with `--as-of` overrides. Confirm the unsubscribe page, the one-click POST, and the Resend webhook end to end.
4. Clear `EMAIL_ALLOWLIST`. Leave `EMAIL_MAX_PER_PASS` at 50 for the first two weeks and watch the Resend dashboard — 0.3% complaint rate is the deliverability cliff.
Recovery, all documented: `EMAIL_PAUSE_KEYS` stops one bad template without a redeploy; `EMAIL_ENABLED=false` stops everything; `/admin/email/log` + requeue recovers failed rows; and the `(user_id, email_key)` unique index means a re-run can never double-send even after a bad pass.

## Risks

- FIRST LIVE PASS MAILS THE ENTIRE BACK CATALOGUE — irreversible. Every existing user is "day N" for some N, and any user with no runs in 45 days matches winback_45 immediately. FOUR independent stops are required and all four are in this plan: the EMAIL_SEQUENCES_START floor, the half-open look-back window (not open-ended `days >= N`), the EMAIL_MAX_PER_PASS abort, and EMAIL_ALLOWLIST. If only one ships, this is a mass mailing to a domain warmed days ago. Sent mail cannot be recalled.
- VOLUME BLINDNESS. backtest_runs.jsonl and forward.db live only on the single Railway /data volume (service/Dockerfile:20). If the new cron service cannot mount it, run_activity_by_owner() returns {} and EVERY user classifies as "signed up, never ran a backtest" — a wrong email to every real user at once that also looks correct in the logs. metrics.sources_healthy() is the mitigation; the topology must be confirmed with a dry run before --send.
- PARTIAL-DATA SENDS. If fetch_profiles() returns partially the sweep under-sends (safe), but if the email_sends key read returns partially, previously-sent emails look unsent and DUPLICATE. Both must abort; the unique index is the last line of defence. Suppression queries must RAISE on failure rather than return an empty set.
- UNCONFIRMED ADDRESSES → HARD BOUNCES. profiles.created_at is stamped when Supabase INSERTs the auth row, which for magic-link is when the mail is SENT, not clicked (web/src/app/auth/callback/route.ts:7-17). Every abandoned signup is in profiles. The email_confirmed_at filter is load-bearing for domain reputation — and if that field is absent from the admin payload shape, the filter silently passes everyone.
- SHIPPING §6's COPY VERBATIM IS A COMPLIANCE BREACH. Four of the nine emails as specified violate CLAUDE.md:28-31/76-77 or state facts the codebase cannot produce (the "4-second win" — golden-cross is actually 18.1s and there is no auto-run; "the 3 most popular templates" — the backtest_run event stores `template` as a boolean; "when it wins"; "[strategy] moved to [rank]" — no rank history exists anywhere). The template lint test catches the vocabulary but not the unsourceable merge fields; those depend on the step-6 rewrites actually landing.
- CAN-SPAM EXPOSURE UNTIL THE POSTAL ADDRESS AND POLICY PAGES EXIST. Emails 5, 6, W1, W2, W3 are plainly commercial. No physical address, no legal entity name, no /privacy, no /terms and no consent record exist anywhere in the repo. Sending any of them before steps 0 and 13 land is a per-message violation regardless of how well the send path is built.
- PII SURFACE EXPANSION. This is the first code in the repo to pull raw addresses into the service process in bulk; service/identity.py:46-47 was deliberately built to make that impossible and test_identity.py:80 pins it. Risks: addresses in logs, in an /admin response, or in an exception traceback shipped to a log aggregator. The plan masks everything and bans a web proxy for /admin/email/*, but this needs review-gate attention.
- UNSUBSCRIBE GET/POST SPLIT AND WEBHOOK SIGNATURE. If unsubscribe mutates on GET, corporate mail scanners and link prefetchers silently unsubscribe users who never clicked. If the Svix signature is not verified, the webhook is an anyone-can-suppress-anyone endpoint. Both are one-line mistakes with irreversible user-visible effects.
- MIS-TARGETED "no backtest" EMAIL. Anonymous runs store owner=null (service/main.py:440) and the anon→account link exists only inside PostHog, so a user who ran backtests anonymously before signing up counts as un-activated and gets Email 2. Consistent with the definition /admin/metrics already uses, but user-visible and wrong.
- NO LAST-LOGIN SIGNAL. auth.users.last_sign_in_at is never fetched anywhere, so "inactive" means "no runs and no deploys". A user who visits the leaderboard daily but runs nothing receives all three win-backs. Also, win-back cadence is one-shot: a user who goes dormant, returns, and goes dormant again gets nothing further — all three keys are consumed.
- AT-MOST-ONCE, NOT EXACTLY-ONCE, BY DESIGN. If Resend returns 2xx but the finalize PATCH fails, or a permanent failure keeps the claim, a user silently never receives that email. Deliberate — a missed email is strictly better than a duplicate — but there is no retry queue, only the manual requeue endpoint.
- LEAKED KEY. docs/HANDOFF.md:172 records RESEND_API_KEY was pasted in chat. Anyone holding it can send from the verified chatbacktest.com domain and torch its reputation. It is also not on Railway at all today (only in the local gitignored .env, which service/env.py loads for dev only), so the worker would run permanently dormant and look like it is working. Rotate AND provision before the first send.
- PHASE E COLLISION. Adding email+password auth (CLAUDE.md:43/131) would trigger Supabase confirmation and reset emails on the same domain AND void the tripwire at web/src/app/auth/callback/route.ts:7-17 that the instant welcome hook sits inside. The sweep's welcome window covers the gap, but the hook itself would go dead silently.

## Open questions — OWNER DECISIONS

- Physical postal address and legal entity name for the CAN-SPAM footer. Nothing in the repo contains one, and five of the nine emails cannot legally ship without it. A registered agent or PO box is fine; a home address is a choice only you can make. The plan makes _layout() RAISE for commercial templates when EMAIL_POSTAL_ADDRESS is unset, so the sweep aborts rather than shipping non-compliant mail.
- Cold start: the plan defaults to emailing ONLY accounts created on/after EMAIL_SEQUENCES_START — the existing base gets nothing, ever. This is the conservative reading given no one has ever opted into marketing and no consent record exists anywhere in web/src. The alternative is a deliberate one-off `--since` backfill, which risks a burst against a freshly-warmed domain. Confirm.
- Consent basis for the five commercial emails. Add an opt-in checkbox to AuthModal/login (cleanest, shrinks the audience), or rely on legitimate interest with an easy opt-out (standard for product lifecycle mail, weaker under GDPR/PECR for EU/UK recipients, and the site has no geo-exclusion)? This is a legal call, not a code one.
- Does the Railway cron service share the /data volume with the API service? This decides whether the sweep runs as `python -m service.email_worker --send` in the cron container or as a curl of POST /admin/email-sweep against the API. Everything else in the plan is identical either way — but it must be answered before --send.
- Approve the six copy deviations in step 6 (the 4-second promise, the popularity claim, the warming-up card + removing "when it wins", the N<1 skip rule, the W1 "is currently #N" rewrite, the W2 deterministic selection rule) — or supply alternative wording. Shipping §6 verbatim puts inaccurate claims in front of users.
- Email 6's "high usage" has no definition in the spec. Proposal: >=1 deployment AND >=10 runs in the trailing 14 days, env-tunable via EMAIL_HIGH_USAGE_RUNS. Confirm the number.
- Email 5's N: distinct strategies (deduped on spec_hash_sha256) or raw run count? The plan uses distinct — a re-run of the same spec is not a new strategy — and the number is in the subject line, so it has to be right. Confirm.
- Email 2's three starter templates: the plan proposes golden-cross, rsi2-mean-reversion, buy-the-dip since no popularity data exists. A different three?
- From/Reply-To identity and who monitors replies. Proposal: `Chat·Backtest <hello@chatbacktest.com>` with Reply-To kevin@chatbacktest.com (the only real address in the repo, web/src/app/about/page.tsx:167). Is hello@ deliverable? CAN-SPAM requires accurate headers and a monitored reply path.
- Does the opt-out suppress the welcome email? It is arguably transactional and CAN-SPAM-exempt. The plan gives the opt-out a `scope` column so 'marketing' spares it and 'all' suppresses it, defaulting the unsubscribe link to 'marketing'. Confirm that split.
- Rotate RESEND_API_KEY before or after the build? The plan assumes before, and that the rotated value goes to Railway — it appears in neither deploy.md env table today.
- Add the DMARC DNS record before the first send? HANDOFF.md:170 confirms only DKIM+SPF+MX are green, and Gmail/Yahoo bulk-sender rules want DMARC.
- Privacy policy and terms content — owner-supplied text or a reviewed template? Neither route exists and step 14 cannot go live without them.
- GDPR erasure versus the immutable forward ledger. W3's copy explicitly promises the record persists, while CLAUDE.md:32 and spec:253 require the ledger stay append-only. What happens to a user's public record on an erasure request? This needs an answer before the privacy page can be written honestly.
- Send hour: proposal `0 14 * * *` UTC (≈10am ET), daily, deliberately clear of the forward worker's 23:00/01:00 slots. Users have no timezone recorded anywhere. Confirm.
