-- Chat-to-Backtest: initial schema (Phase 5).
-- Apply with: supabase db push  (or paste into the Supabase SQL editor)

-- Profiles: one row per auth user, carries the billing plan.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'max')),
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

-- Strategies: saved/forked specs.
create table if not exists public.strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  spec jsonb not null,
  forked_from uuid references public.strategies (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Runs: immutable backtest results (mirrors the service's local run store).
create table if not exists public.runs (
  id text primary key,                        -- service run_id (timestamp + fingerprint)
  user_id uuid references public.profiles (id) on delete cascade,
  strategy_id uuid references public.strategies (id) on delete set null,
  parent_run_id text references public.runs (id) on delete set null,
  spec jsonb not null,
  params jsonb not null default '{}',
  stats jsonb not null,
  equity_curve jsonb not null default '[]',
  share_slug text unique,
  created_at timestamptz not null default now()
);

create index if not exists runs_user_created_idx on public.runs (user_id, created_at desc);
create index if not exists runs_share_slug_idx on public.runs (share_slug) where share_slug is not null;
create index if not exists strategies_user_idx on public.strategies (user_id, created_at desc);

-- Row level security: owners read/write their rows; share pages go through
-- the service role (which bypasses RLS) so shared runs stay private-by-default.
alter table public.profiles enable row level security;
alter table public.strategies enable row level security;
alter table public.runs enable row level security;

create policy "profiles are self-readable"
  on public.profiles for select using (auth.uid() = id);
create policy "profiles are self-updatable"
  on public.profiles for update using (auth.uid() = id);

create policy "strategies owner all"
  on public.strategies for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "runs owner select"
  on public.runs for select using (auth.uid() = user_id);
create policy "runs owner insert"
  on public.runs for insert with check (auth.uid() = user_id);

-- Auto-create a profile row on signup.
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
