# Pricing model — unit economics (tunable source of truth)

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
| Backtest, 1d | 10 × symbol multiplier | ≥ $0.079 | ≈ $0 (cached bars, flat compute) | ≈ 100% |
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
