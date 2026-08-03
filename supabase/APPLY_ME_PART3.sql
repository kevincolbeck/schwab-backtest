-- Part 3: the credit system (Claude-style usage billing). Idempotent.

create table if not exists public.credits_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta integer not null,
  reason text not null,
  ref text,
  created_at timestamptz not null default now()
);

create index if not exists credits_user_idx on public.credits_ledger (user_id, created_at desc);
-- Idempotency for grants that carry a reference (webhooks retry!).
create unique index if not exists credits_ref_unique
  on public.credits_ledger (user_id, reason, ref) where ref is not null;

alter table public.credits_ledger enable row level security;
drop policy if exists "credits self readable" on public.credits_ledger;
create policy "credits self readable"
  on public.credits_ledger for select using (auth.uid() = user_id);
-- No insert/update/delete policies: only the service role writes credits.
revoke insert, update, delete on public.credits_ledger from anon, authenticated;

-- Atomic balance / grant / spend (service-role only; advisory lock kills races).
create or replace function public.credit_balance(p_user uuid)
returns integer language sql security definer set search_path = public as $$
  select coalesce(sum(delta), 0)::integer from public.credits_ledger where user_id = p_user;
$$;

create or replace function public.grant_credits(
  p_user uuid, p_amount integer, p_reason text, p_ref text default null
) returns integer language plpgsql security definer set search_path = public as $$
begin
  if p_amount <= 0 then raise exception 'grant must be positive'; end if;
  insert into public.credits_ledger (user_id, delta, reason, ref)
  values (p_user, p_amount, p_reason, p_ref)
  on conflict do nothing;  -- ref-carrying grants are idempotent
  return public.credit_balance(p_user);
end;
$$;

create or replace function public.spend_credits(
  p_user uuid, p_amount integer, p_reason text, p_ref text default null
) returns integer language plpgsql security definer set search_path = public as $$
declare bal integer;
begin
  if p_amount <= 0 then raise exception 'spend must be positive'; end if;
  perform pg_advisory_xact_lock(hashtext(p_user::text));
  bal := public.credit_balance(p_user);
  if bal < p_amount then return -1; end if;  -- insufficient: sentinel, no write
  insert into public.credits_ledger (user_id, delta, reason, ref)
  values (p_user, -p_amount, p_reason, p_ref);
  return bal - p_amount;
end;
$$;

-- Revoke from public too: Postgres grants EXECUTE to PUBLIC on new functions by
-- default, so revoking only anon/authenticated leaves the RPCs callable via the
-- anon key. (Existing installs: run APPLY_ME_PART4.sql to apply the same fix.)
revoke execute on function public.credit_balance(uuid) from public, anon, authenticated;
revoke execute on function public.grant_credits(uuid, integer, text, text) from public, anon, authenticated;
revoke execute on function public.spend_credits(uuid, integer, text, text) from public, anon, authenticated;

-- Signup grant: new users start with 250 credits (a session or two of play).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.credits_ledger (user_id, delta, reason, ref)
  values (new.id, 250, 'signup_grant', 'signup')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
