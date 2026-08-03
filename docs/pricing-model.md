# Pricing model (tunable source of truth)

Constants live in `service/credits.py` (COSTS / MONTHLY_GRANTS / PACKS) and the
Stripe prices created by `scripts/setup_stripe.py`. Tune here, change there.

## Credits

| Action | Credits |
|---|---|
| AI chat message | 5 |
| AI explanation (uncached) | 5 |
| Backtest, daily bars | 10 |
| Backtest, 15m/30m/60m | 25 |
| Backtest, 1m/5m | 50 |

## Grants

| Event | Credits |
|---|---|
| Signup | 250 (≈ a full evening of building) |
| Pro monthly ($29) | 2,500 |
| Max monthly ($79) | 10,000 |
| Pack small ($10) | 500 |
| Pack large ($25) | 1,500 |

Design intent (Kevin): free grant runs out fast; packs priced ~2× the
subscription's effective rate so subscribing is always the better deal.

## Mechanics

- Ledger: `credits_ledger` (append-only) + atomic `spend_credits`/`grant_credits`
  RPCs (advisory-locked, ref-idempotent) — `supabase/APPLY_ME_PART3.sql`.
- Service spends BEFORE running, refunds on engine failure; responses carry
  `credits_remaining` so the UI meter stays live.
- Fail-open: if the RPCs are missing/unreachable, credits disable themselves
  and the old per-day limits still gate everything.
- Monthly refresh: Stripe `invoice.payment_succeeded` webhook (ref = invoice id).
- Intraday history is capped at 60 days (data-plan reality; lift later).
