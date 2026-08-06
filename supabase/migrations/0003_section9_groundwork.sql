-- Section 9 — Phase 2 groundwork. Columns ship NULL and UNUSED.
--
-- The point of adding them now is that a Phase 2 feature should not require a
-- migration against a live ledger later. Nothing reads or writes them, and
-- nothing may: the spec gates any follower-payment feature on a
-- securities-attorney review that has not happened.
--
--   "Before building any feature where users charge followers (Phase 2), the
--    owner consults a securities attorney on structure. That decision gates
--    the build; do not implement follower-payment features until it's made."
--
-- `subscription_price` and `terms` are the two columns most likely to be
-- misread as evidence the platform brokers something. It does not. Nothing is
-- executed here — see the record_kind CHECK on forward_returns below.
--
-- NOT added: `visibility`, which already exists (0002_forward_ledger.sql:13)
-- and is fully wired — plan-gated at deploy, 404s on private records, and
-- enforced by RLS. Section 9 lists it, but it shipped long ago.

alter table public.deployments
  -- Who AUTHORED the strategy, as distinct from user_id (who deployed THIS
  -- record). Identical today; they diverge the moment a strategy can be
  -- forked, which is what Phase 2 contemplates.
  add column if not exists creator_id uuid references public.profiles (id) on delete set null,
  add column if not exists follower_count integer not null default 0,
  add column if not exists subscription_price numeric,
  add column if not exists terms text;

-- Section 9: "store daily forward returns as immutable rows keyed by
-- (strategy_hash, date) so records can be independently audited later."
--
-- Separate from forward_equity, which is keyed by deployment_id and stores an
-- equity level. An outside auditor has neither our internal ids nor our trust
-- — they have the frozen spec, and they can hash it themselves. Keying on the
-- spec hash is what makes the record checkable by someone who assumes we are
-- lying, which is the whole reason the ledger exists.
create table if not exists public.forward_returns (
  spec_hash text not null,
  date date not null,
  -- Machine-enforced boundary (Section 9): every row states that it records a
  -- SIMULATED result. No order was placed, no broker was contacted, nothing
  -- was executed. A CHECK rather than a comment, because comments don't hold.
  record_kind text not null default 'simulated_forward_return'
    check (record_kind = 'simulated_forward_return'),
  daily_return_pct double precision not null,
  cumulative_return_pct double precision not null,
  recorded_at timestamptz not null default now(),
  primary key (spec_hash, date)
);

alter table public.forward_returns enable row level security;

-- Public read: these are published records. That is the product.
drop policy if exists forward_returns_public_read on public.forward_returns;
create policy forward_returns_public_read
  on public.forward_returns for select
  using (true);

-- Append-only, enforced the same way 0002 does it for forward_signals: no
-- client role may ever rewrite history, including us via the anon/auth keys.
revoke update, delete on public.forward_returns from anon, authenticated;

create or replace function public.forward_returns_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'forward_returns is append-only';
end;
$$;

drop trigger if exists forward_returns_no_update on public.forward_returns;
create trigger forward_returns_no_update
  before update or delete on public.forward_returns
  for each row execute function public.forward_returns_immutable();
