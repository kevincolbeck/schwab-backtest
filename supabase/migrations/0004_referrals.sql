-- §8 referral mechanic: "Give a friend 1 extra deployment slot, get 1."
--
-- Denominated in deployment slots on purpose — the spec's reasoning is that
-- the reward should reinforce the core behaviour (putting a frozen strategy on
-- a public record), not hand out a generic currency.
--
-- THIS GRANTS FREE CAPACITY, so the abuse surface is the design. Every rule
-- below exists because of a specific way this gets farmed:
--
--   * self-referral         → redeemer_id <> referrer_id CHECK
--   * redeem-many-times     → primary key on redeemer_id (one redemption per
--                             account, ever — you are referred once)
--   * throwaway-account farm→ the per-referrer cap in service/auth.py, which
--                             is the only defence that actually bites given
--                             there is no email-confirmation gate on deploy
--   * replay/double-grant   → append-only rows + the composite key, mirroring
--                             the (user_id, reason, ref) idempotency pattern
--                             credits_ledger already uses
--
-- A code is not a secret: it is derived from the user id, so there is no code
-- table to keep in sync and nothing to leak. Redemption is the only state.

create table if not exists public.referral_redemptions (
  -- One row per REDEEMER. Being referred is a once-per-account event, so the
  -- primary key is the natural guard against redeeming several codes.
  redeemer_id uuid primary key references public.profiles (id) on delete cascade,
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  -- Self-referral is the first thing anyone tries.
  constraint referral_no_self check (redeemer_id <> referrer_id)
);

create index if not exists referral_redemptions_referrer_idx
  on public.referral_redemptions (referrer_id);

alter table public.referral_redemptions enable row level security;

-- A user may see redemptions they are party to, and nothing else. Counting
-- another person's referrals is not anyone's business.
drop policy if exists referral_redemptions_own on public.referral_redemptions;
create policy referral_redemptions_own
  on public.referral_redemptions for select
  using (auth.uid() = redeemer_id or auth.uid() = referrer_id);

-- Writes go through the service role only. A client that could insert its own
-- redemption row could mint deployment slots directly.
revoke insert, update, delete on public.referral_redemptions from anon, authenticated;

-- Append-only: a redemption is a historical fact. Deleting one would silently
-- revoke a slot someone is already using.
create or replace function public.referral_redemptions_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'referral_redemptions is append-only';
end;
$$;

drop trigger if exists referral_redemptions_no_change on public.referral_redemptions;
create trigger referral_redemptions_no_change
  before update or delete on public.referral_redemptions
  for each row execute function public.referral_redemptions_immutable();
