-- Part 2 of the schema (the first paste truncated partway).
-- Safe to run repeatedly: everything below is guarded.

-- ── Remainder of migration 0001: RLS + signup trigger ─────────────────────────
alter table public.profiles enable row level security;
alter table public.strategies enable row level security;
alter table public.runs enable row level security;

drop policy if exists "profiles are self-readable" on public.profiles;
create policy "profiles are self-readable"
  on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles are self-updatable" on public.profiles;
create policy "profiles are self-updatable"
  on public.profiles for update using (auth.uid() = id);

drop policy if exists "strategies owner all" on public.strategies;
create policy "strategies owner all"
  on public.strategies for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "runs owner select" on public.runs;
create policy "runs owner select"
  on public.runs for select using (auth.uid() = user_id);
drop policy if exists "runs owner insert" on public.runs;
create policy "runs owner insert"
  on public.runs for insert with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Migration 0002: forward-testing ledger (append-only) ─────────────────────
create table if not exists public.deployments (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid references public.strategies (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  spec_frozen jsonb not null,
  spec_hash text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  slug text unique not null,
  starting_capital numeric not null default 100000,
  archived_reason text,
  replaced_by uuid references public.deployments (id) on delete set null,
  deployed_at timestamptz not null default now()
);

create table if not exists public.forward_signals (
  id bigint generated always as identity primary key,
  deployment_id uuid not null references public.deployments (id) on delete cascade,
  signal_date date not null,
  action text not null check (action in ('entry', 'exit', 'stop', 'time_exit')),
  symbol text not null,
  price numeric not null,
  shares numeric not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (deployment_id, signal_date, action, symbol)
);

create table if not exists public.forward_equity (
  deployment_id uuid not null references public.deployments (id) on delete cascade,
  date date not null,
  equity numeric not null,
  open_positions jsonb not null default '[]',
  primary key (deployment_id, date)
);

create index if not exists deployments_public_active_idx
  on public.deployments (visibility, status, deployed_at desc);
create index if not exists forward_signals_deploy_date_idx
  on public.forward_signals (deployment_id, signal_date desc);

alter table public.deployments enable row level security;
alter table public.forward_signals enable row level security;
alter table public.forward_equity enable row level security;

drop policy if exists "deployments owner select" on public.deployments;
create policy "deployments owner select"
  on public.deployments for select using (auth.uid() = user_id or visibility = 'public');
drop policy if exists "deployments owner insert" on public.deployments;
create policy "deployments owner insert"
  on public.deployments for insert with check (auth.uid() = user_id);
drop policy if exists "deployments owner update" on public.deployments;
create policy "deployments owner update"
  on public.deployments for update using (auth.uid() = user_id);

drop policy if exists "forward_signals readable" on public.forward_signals;
create policy "forward_signals readable"
  on public.forward_signals for select using (
    exists (
      select 1 from public.deployments d
      where d.id = deployment_id
        and (d.visibility = 'public' or d.user_id = auth.uid())
    )
  );
drop policy if exists "forward_equity readable" on public.forward_equity;
create policy "forward_equity readable"
  on public.forward_equity for select using (
    exists (
      select 1 from public.deployments d
      where d.id = deployment_id
        and (d.visibility = 'public' or d.user_id = auth.uid())
    )
  );

revoke update, delete on public.forward_signals from anon, authenticated;
revoke update, delete on public.forward_equity from anon, authenticated;

create or replace function public.prevent_spec_mutation()
returns trigger language plpgsql as $$
begin
  if new.spec_frozen is distinct from old.spec_frozen
     or new.spec_hash is distinct from old.spec_hash
     or new.deployed_at is distinct from old.deployed_at then
    raise exception 'deployed specs are immutable — create a new deployment instead';
  end if;
  return new;
end;
$$;

drop trigger if exists deployments_spec_immutable on public.deployments;
create trigger deployments_spec_immutable
  before update on public.deployments
  for each row execute function public.prevent_spec_mutation();
