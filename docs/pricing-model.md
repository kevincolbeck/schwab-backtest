# Pricing model — unit economics (tunable source of truth)

> **§5 UPDATE (2026-08-05) — flat capability tiers superseded per-action credit
> pricing.** Read `## §5` at the bottom FIRST: it states the live model (what
> a plan can do, what the quiet fair-use caps are, and how the worst case is
> now bounded by CAPS rather than by prices). Sections (a)–(e) below describe
> the retired credits model and are kept because the *marginal-cost* analysis
> in (b) is unchanged and still the basis for the cap math.

Owner directive: **every credit-priced action must carry a large gross margin over
its worst-case marginal cost — extremely profitable no matter what.** This doc is
the math that proves it and the map of where each constant lives. Tune numbers
here first, then change the constants in `service/credits.py` (and the Stripe
prices created by `scripts/setup_stripe.py`).

All margins below are computed at the **Max rate — the cheapest price a credit is
ever sold at**. If an action clears its cost at the Max rate, it clears it at
every rate.

## (a) Credit face values

| Source | Price | Credits | $/credit |
| --- | --- | --- | --- |
| Pro monthly | $29 | 2,500 | $0.0116 |
| **Max monthly — the margin floor** | $79 | 10,000 | **$0.0079** |
| Pack small | $10 | 500 | $0.0200 |
| Pack large | $25 | 1,500 | $0.0167 |
| Signup grant | $0 | 250 | — (marketing cost; worst-case COGS ≈ $1.22 if burned entirely on worst-case chat, see (d)) |

Packs stay ~1.4–2.5× the subscription rates by design — subscribing is always the
better deal. Every margin claim below uses $0.0079/credit; pack-funded credits
only widen the margins.

## (b) Marginal-cost model

| Input | Billing shape | Marginal cost per action |
| --- | --- | --- |
| Polygon market data | Flat monthly subscription | **≈ $0.** Bars are cached in SQLite (`BACKTEST_CACHE_DB`); a run reads cache and at worst triggers API calls already covered by the flat sub. Intraday history is capped at 60 days, which bounds cache volume too. |
| Railway (service + worker), Vercel (web) | Flat monthly | ≈ $0 per action — CPU headroom, no per-request billing. |
| Supabase (auth, ledger) | Flat tier | ≈ $0 per action. |
| Stripe | 2.9% + $0.30 per charge | Per *purchase*, not per action — netted out in (d). |
| **Anthropic API** | **Per token** | **The only per-action variable cost.** |

**Model:** `claude-sonnet-4-6` (`DEFAULT_CHAT_MODEL` in `service/chat.py`,
overridable via the `CHAT_MODEL` env var). List price: **$3.00 / 1M input tokens,
$15.00 / 1M output tokens** → $0.000003 per input token, $0.000015 per output
token.

Token spend is bounded server-side, which is what makes the worst case computable:

- Chat context: capped at **12 messages × 2,000 chars** (~6K tokens at 4 chars/token;
  ≤ 12K tokens even for adversarial ~2-chars/token text).
- Chat system prompt: ~3–5K tokens (the spec JSON inside it is clamped/validated).
- Chat output: `max_tokens=2048` (`service/chat.py::call_claude` default).
- Explain: clamped/projected spec prompt ≤ ~2K input tokens, `max_tokens=500` output.

**Chat is billed on a deterministic PRE-call estimate**, not the API usage
report: `estimated_tokens = request_chars / 2.5 + 1,500 output allowance`
(`credits.estimate_chat_tokens`), then `max(12, ceil(estimated / 800))` credits,
spent before the model is called. The 2.5 chars/token divisor is deliberately
below English's ~4 so the billed token count stays close to (or above) the real
one even for dense-token text (CJK, minified code) — the margin floor is designed
for adversarial inputs, not just prose.

(Anthropic prompt caching is *not* used today; enabling it on the system prompt
would cut chat input cost ~90% on cache hits. Treated as upside — none of the
math below assumes it.)

## (c) Per-action economics (revenue at the Max rate, $0.0079/credit)

| Action | Credits | Revenue @Max | Worst-case marginal cost | Gross margin |
| --- | --- | --- | --- | --- |
| Backtest, 1d, ≤ 10 resolved symbols | **0 — free capability on every plan (P0-4)** | $0 | ≈ $0 (cached bars, flat compute) | — (COGS ≈ $0 makes the giveaway safe) |
| Backtest, 1d, 11+ symbols / ALL_US | 10 × symbol multiplier | ≥ $0.158 (×2 floor) | ≈ $0 (cached bars, flat compute) | ≈ 100% |
| Backtest, 15m/30m/60m | 25 × symbol multiplier | ≥ $0.198 | ≈ $0 | ≈ 100% |
| Backtest, 1m/5m | 50 × symbol multiplier | ≥ $0.395 | ≈ $0 | ≈ 100% |
| AI chat message | max(12, ⌈est. tokens ÷ 800⌉) | ≥ $0.0948 | ≤ $0.0611 (adversarial worst point, math below) | ≥ 36% adversarial worst; ~78% typical |
| AI explanation, cache miss | 5 | $0.0395 | ≤ $0.0135 (≤2K in + 500 out) | ≥ 66% |
| AI explanation, cache hit (behavior-hash) | 0 — returns before billing | $0 | ≈ $0 | — (free by design) |
| Intraday forward deployment 15m/30m/60m (Pro/Max only) | 100, one-time | $0.79 | ≈ $0 (daily worker pass over cached bars) | ≈ 100% |
| Intraday forward deployment 1m/5m (Pro/Max only) | 250, one-time | $1.98 | ≈ $0 (largest replay windows — hence the premium) | ≈ 100% |

**Symbol multiplier** (runs): ×1 per 10 **resolved** symbols, capped at ×20 —
10 symbols ×1, 11 ×2, the ALL_US universe hits the cap (1d ALL_US = 10 × 20 =
**200 credits**). `SYMBOL_BLOCK` / `SYMBOL_MULTIPLIER_CAP` in
`service/credits.py`. Because run marginal cost is ≈ $0, the multiplier exists
for fairness/capacity, not COGS recovery — margin holds at any multiplier ≥ 1.

**Daily-data exemption (P0-4, interim toward the §5 flat-tier model).** A 1d
run inside one symbol block (≤ 10 resolved UNIQUE symbols — duplicates count
once, matching what the engine simulates) — or inside any TEMPLATE's universe,
whatever its size (three shipped daily templates hold 11–19 symbols; their
chat-edited variants must stay as free signed-in as they are anonymously) —
never spends credits, on any plan. It is metered quietly by per-day fair-use
caps instead (`FREE_RUNS_PER_DAY`, default 50, for the free plan; Pro/Max
uncapped; anon stays `ANON_RUNS_PER_DAY` = 10/IP). This is safe because 1d
cached-bar runs are the ≈ $0-COGS action: the giveaway costs nothing
measurable and removes credit anxiety from the free experience. Everything
with real COGS or real capacity weight — chat, explain cache-misses, intraday
timeframes, multi-block CUSTOM universes, ALL_US, intraday deploys — still
bills as above. When a BILLED run can't charge (credits dormant/failing open),
the per-day backstop tightens to `BILLED_FALLBACK_RUNS_PER_DAY` (default 10)
so a credits outage never widens intraday exposure to the quiet cap. Per-run
compute is structurally bounded too: `MAX_INDICATORS` = 30 in
`engine/ai/strategist.py::validate_spec`.

**Chat, in detail.** Billed BEFORE the call on the deterministic estimate above:
charge = `max(12, ceil((chars/2.5 + 1500) / 800))` credits.

- A marginal 800 estimated tokens = 2,000 request chars bills 1 credit
  ($0.0079); even fully adversarial text (2 chars/token → 1,000 real tokens)
  costs $0.003 → ≥ 62% margin on every token past the floor.
- Output is hard-capped at 2,048 tokens → max output cost $0.0307, absorbed by
  the 12-credit floor ($0.0948). The floor exists precisely for that plus
  prompt overhead.
- **Adversarial worst point:** the largest request that still bills only the
  floor is 9,600 estimated tokens = 20,250 chars. At 2 chars/token that's
  ~10,125 real input tokens ($0.0304) + capped output ($0.0307) = **$0.0611**
  against $0.0948 revenue = **36% gross margin** — and reaching it requires
  deliberately crafted dense-token payloads that also max the output cap.
  A typical message (~14K chars ≈ 3.5K real input + ~700 out → 12 credits)
  costs ~$0.021 → **78% margin**.
- **Tuning invariant** — with floor `F` credits, divisor `D` est-tokens/credit,
  chars-per-token divisor `C` (2.5), output cap `O`, token prices `Pin`/`Pout`,
  credit value `V` = $0.0079, and worst real-chars-per-token 2: keep
  `F·V ≥ O·Pout + ((F·D − 1500)·C/2)·Pin` and `D·(C/2)·Pin ≤ V`. Today:
  $0.0948 ≥ $0.0611 ✓ and $0.003 ≤ $0.0079 ✓. **Warning:** switching
  `CHAT_MODEL` to a pricier tier (e.g. $5/$25 per MTok) requires re-running
  both inequalities — F, D, C, and `max_tokens` in `service/chat.py` are all
  part of this invariant.

**Explain, in detail.** 5 credits = $0.0395 @Max. Worst-case uncached call:
2,000 in × $3/M + 500 out × $15/M = $0.006 + $0.0075 = $0.0135 → 66% margin.
Results are cached by behavior hash (`service_data/explanations.json`), so repeat
requests for the same strategy behavior cost $0 — realized margin trends to 100%
as the cache warms.

**Intraday deploy.** One-time fee, Pro/Max plans only: 100 credits for
15m/30m/60m, **250 for 1m/5m** (their replay windows compound fastest in the
daily worker — the premium prices the data class, available day one). Ongoing
evaluation is the cron worker reading cached bars — flat-cost infrastructure,
≈ $0 marginal.

## (d) Worst-case subscriber P&L

Adversarial assumption: the subscriber burns their **entire** monthly allowance on
the thinnest-margin action (chat), and *every single message* is deliberately
crafted to land on the worst point of the curve ($0.0611 per 12-credit message =
$0.00509/credit). Real users can't do better than this against us — the floor,
the context caps, and the conservative chars/2.5 estimate bound it.

| | Pro | Max |
| --- | --- | --- |
| Revenue | $29.00 | $79.00 |
| Credits / worst-case messages | 2,500 / 208 | 10,000 / 833 |
| Worst-case Anthropic COGS ($0.00509/cr) | $12.73 | $50.90 |
| Stripe fee (2.9% + $0.30) | $1.14 | $2.59 |
| **Worst-case gross profit** | **$15.13 (52%)** | **$25.51 (32%)** |
| Typical all-chat COGS (~$0.00175/cr) | $4.38 | $17.50 |
| Typical all-chat gross profit | $23.48 (81%) | $58.91 (75%) |

The adversarial case still clears a solid positive margin on both plans — and it
requires every message to simultaneously use dense-token payloads, hit the
2,048-token output cap, and sit exactly on the floor boundary; it is an attacker
profile, not a usage pattern. Real heavy chatters land at 75–81%. Any credits
spent on backtests or cached explanations (≈ $0 COGS) push the month toward
≈ 100% margin. The free signup grant's worst case is ~20 such messages ≈
**$1.27** — a bounded acquisition cost, not an open tap. (Anthropic prompt
caching on the system prompt remains untapped upside that would cut chat input
COGS ~90% on cache hits.)

## (e) Knobs — where each constant lives

| Knob | Current value | Lives in |
| --- | --- | --- |
| Action base costs (`COSTS`) | 1d run 10 · 15m/30m/60m 25 · 1m/5m 50 · explain 5 · chat floor 12 · intraday deploy 100 / fast 250 | `service/credits.py` |
| Chat token divisor / chars-per-token | 800 tokens/credit · 2.5 chars/token (conservative) | `service/credits.py` |
| Chat credit floor | 12 credits | `service/credits.py` |
| Symbol multiplier schedule | ×1 per 10 resolved symbols, cap ×20 (ALL_US 1d = 200) | `service/credits.py` |
| Chat context caps | 12 messages × 2,000 chars | service chat request handling |
| Chat output cap | `max_tokens=2048` | `service/chat.py::call_claude` |
| Explain output cap | `max_tokens=500` | `service/main.py` explain endpoint |
| Model + token prices | `claude-sonnet-4-6` · $3/$15 per MTok | `service/chat.py` (`CHAT_MODEL` env) — re-run the (c) invariants on any change |
| Grants (`SIGNUP_GRANT`, `MONTHLY_GRANTS`) | 250 signup · Pro 2,500 · Max 10,000 | `service/credits.py` |
| Free-plan quiet run cap | `FREE_RUNS_PER_DAY` env, default 50/day (1d runs, credit-exempt) | `service/auth.py` `PLAN_LIMITS` |
| Packs (`PACKS`) | 500/$10 · 1,500/$25 | `service/credits.py` + `scripts/setup_stripe.py` |

## Mechanics (unchanged)

- Ledger: `credits_ledger` (append-only) + atomic `spend_credits`/`grant_credits`
  RPCs (advisory-locked, ref-idempotent) — `supabase/APPLY_ME_PART3.sql`.
- Service spends BEFORE running, refunds on engine failure; responses carry
  `credits_remaining` so the UI meter stays live.
- Fail-open: if the RPCs are missing/unreachable, credits disable themselves
  and the old per-day limits still gate everything (which also bounds model
  spend while credits are dormant).
- Monthly refresh: Stripe `invoice.payment_succeeded` webhook (ref = invoice id).
- Intraday history is capped at 60 days (data-plan reality; lift later).

---

## §5 — Flat capability tiers (LIVE MODEL, 2026-08-05)

Per-action credit pricing is retired. Plans sell **capabilities**; usage is
metered by quiet per-day **fair-use caps** that are never displayed as a
countdown. Credits survive only as invisible **overflow** past those caps.

### Tiers

| | Free | Pro | Max |
| --- | --- | --- | --- |
| Price | $0 | **$39/mo · $390/yr** | **$99/mo · $990/yr** |
| Daily-data backtests | unlimited (cap 50/day) | unlimited (uncapped) | unlimited (uncapped) |
| Intraday 1m–60m | — | ✓ | ✓ |
| Symbols per run | 10 | 100 | 200 |
| ALL_US universe | — | — | ✓ |
| Crypto (`X:…`) | — | — | ✓ |
| Deployments | 1 (public only) | 10 | unlimited |
| Private deployments | — | ✓ | ✓ |
| Clean exports / no watermark | — | ✓ | ✓ |
| AI messages/day (published cap) | 5 | 15 | 40 |
| New AI explanations/day | 5 | 10 | 20 |

Annual = 10× monthly (two months free). Constants live in
`service/auth.py::PLAN_LIMITS` (every cap is env-overridable:
`FREE_RUNS_PER_DAY`, `FREE_CHAT_PER_DAY`, `PRO_CHAT_PER_DAY`,
`MAX_CHAT_PER_DAY`, `FREE/PRO/MAX_EXPLAIN_PER_DAY`). Stripe price IDs: `scripts/setup_stripe_v2.py`
(lookup keys `cb_pro_monthly_v2`, `cb_pro_annual_v2`, `cb_max_monthly_v2`,
`cb_max_annual_v2`).

### Why this is safe: the worst case is bounded by CAPS, not by prices

Section (b)'s marginal-cost model is unchanged — **Anthropic tokens are the
only per-action variable cost**; cached-bar backtests are ≈ $0. Under credits,
margin was defended per action. Under flat tiers it's defended by the chat cap,
because chat is the only action that can burn real money.

Worst-case AI cost is the (b) adversarial figure for chat (**$0.0611** —
~10k dense input tokens + the 2,048-token output cap) and **$0.0135** for an
uncached explain (≤2K in + 500 out). BOTH are model calls, so both count. The
ceiling on model COGS per subscriber-month is
`30 × (chat_cap × $0.0611 + explain_cap × $0.0135)`:

| Plan | Chat/day | Explain/day | Worst-case monthly AI COGS | Revenue | Worst-case gross |
| --- | --- | --- | --- | --- | --- |
| Free | 5 | 5 | $11.19 | $0 | **−$11.19** (acquisition ceiling) |
| Pro | 15 | 10 | $31.55 | $39.00 | +$7.45 (19%) |
| Max | 40 | 20 | $81.42 | $99.00 | +$17.58 (18%) |

Typical usage is ~3× cheaper than that adversarial point (§(c): ~$0.021/chat
message), and explanations are cached by behavior hash so realistic explain
COGS trends to zero. The adversarial row requires a subscriber to max BOTH
surfaces every day for a month with deliberately dense payloads.

> **Why Pro's chat cap is 15, not 20.** The first §5 draft used 20 and left
> `/explain` bounded only by a flat 50/day (a credits-era backstop, not a
> plan cap). Adversarial review caught it: that combination priced Pro at
> $56.91 of worst-case COGS against $39 of revenue — loss-making. Explain is
> now a per-plan cap sized by the same arithmetic, and Pro's chat cap came
> down to restore a real margin. **Any future cap change must re-run the
> table above** — the two caps are coupled through one budget.

**Free-tier exposure** is the number to watch: 5 chat + 5 explain per day is
an **$11.19/month** ceiling per free account if fully abused (typical: ~$3).
Bounded per account, but unbounded in aggregate. Mitigations in place:
accounts require auth, anonymous chat is 3/day/IP, and every AI payload is
size-capped (`ANON_CHAT_MAX_TOKENS`, `EXPLAIN_MAX_CHARS`).

> **OPEN BUSINESS DECISION — `FREE_CHAT_PER_DAY` (currently 5).** The one
> number here that trades growth against COGS, deliberately shipped
> conservative. Case for RAISING to ~10: §5's own promise is "Free is
> genuinely usable", the AI strategist is the differentiator, and a signed-in
> free user currently gets only 2 more messages/day than an anonymous visitor
> (3/day/IP) — a thin reward for the signup that P0-5 measures as activation.
> Cost of raising to 10: ~$6.30/month typical, +$9.17 worst case per fully
> active free account. Case for LOWERING: any sign of aggregate abuse. Either
> direction is one env var, no deploy. Decide with the activation rate on
> `/admin`, not by intuition.

### Tuning invariant (replaces the credits-era one)

For each paid plan, across EVERY model-call surface:
`price ≥ 30 × Σ(cap_i × worst_case_cost_i)`. Today: Pro $39 ≥ $31.55 ✓ (19%),
Max $99 ≥ $81.42 ✓ (18%). Pinned by
`service/tests/test_flat_tiers.py::test_plan_limits_match_the_published_pricing_table`,
which fails the build if a cap change breaks it.

**Warning:** any of these breaks the inequality — raising `PRO_CHAT_PER_DAY`
or `PRO_EXPLAIN_PER_DAY`, switching `CHAT_MODEL` to a pricier tier, or raising
`max_tokens` in `service/chat.py`. **Adding a NEW model-call endpoint adds a
term to the sum** — that is exactly the mistake the §5 review caught with
`/explain`. Prompt caching on the system prompt (~90% input cut, still
untapped) would roughly double the headroom.

### Overflow (what credits are now)

Past a fair-use cap, a held balance is spent instead of hard-stopping:
reasons `backtest_overflow` / `chat_overflow` in the ledger. Grants unchanged
(`SIGNUP_GRANT` 250; monthly 2,500 Pro / 10,000 Max, ×12 on annual invoices).
Packs unchanged (500/$10, 1,500/$25) and demoted to a collapsed footer section
on `/pricing`. Balance is visible ONLY on `/account`. Because overflow is
priced by the retired per-action table, its margin math is section (c)'s and
still holds.

### Migration note

Stripe prices are immutable, so the retired $29/$79 prices
(`ctb_pro`/`ctb_max`) still exist and any existing subscription keeps billing
on them until deliberately migrated. `STRIPE_PRICE_PRO`/`_MAX` remain as
fallbacks so a partial env rollout can't 503 checkout. **Owner action:** set
`STRIPE_PRICE_PRO_V2`, `STRIPE_PRICE_PRO_ANNUAL`, `STRIPE_PRICE_MAX_V2`,
`STRIPE_PRICE_MAX_ANNUAL` in Vercel; Stripe is still test-mode.
