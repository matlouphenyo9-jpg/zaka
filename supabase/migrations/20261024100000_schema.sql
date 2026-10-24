-- Zaka schema v1. Every user-data table: RLS on, owner-only (auth.uid() = user_id).
-- Money is always integer cents. Calendar dates are Africa/Johannesburg local dates.

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  locale text not null default 'en' check (locale in ('en', 'zu', 'xh', 'nso', 'af')),
  city text check (char_length(city) <= 60),
  transport_mode text check (transport_mode in ('taxi', 'bus', 'metrorail', 'gautrain', 'car', 'walk', 'other')),
  -- user-set safety floor, in cents (spec name kept: reserve_amount)
  reserve_amount integer not null default 0 check (reserve_amount between 0 and 100000000),
  -- how money usually arrives: [{source, amount_cents, rule:{kind,day|weekday}}]
  income_plan jsonb not null default '[]'::jsonb check (jsonb_typeof(income_plan) = 'array' and pg_column_size(income_plan) < 8192),
  -- everyday costs presets: {transport_daily_cents, workdays, food_weekly_cents, electricity_weekly_cents, data_weekly_cents, fare_single_cents, trips_per_day, price_ref}
  essentials jsonb not null default '{}'::jsonb check (jsonb_typeof(essentials) = 'object' and pg_column_size(essentials) < 8192),
  -- patterns the user said are wrong (by pattern key)
  ignored_patterns text[] not null default '{}',
  is_demo boolean not null default false,
  consent_at timestamptz,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- transactions
create table public.transactions (
  id uuid primary key default gen_random_uuid(), -- client may supply its own uuid so offline replays are idempotent
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000000),
  category text not null check (category in (
    'opening_balance', 'income', 'grant', 'piece_job', 'salary', 'trade', 'gift',
    'transport', 'food', 'electricity', 'data_airtime', 'rent', 'school', 'stokvel',
    'savings_goal', 'funeral', 'debt', 'health', 'household', 'other')),
  source text not null default 'cash' check (source in ('cash', 'bank', 'grant', 'piece_job', 'trade', 'other')),
  note text check (char_length(note) <= 140),
  occurred_on date not null check (occurred_on between date '2020-01-01' and date '2100-01-01'),
  created_via text not null default 'manual' check (created_via in ('manual', 'ai_parsed', 'seed')),
  confirmed boolean not null default true,
  created_at timestamptz not null default now()
);
create index transactions_user_date on public.transactions (user_id, occurred_on desc);

-- ---------------------------------------------------------------- obligations
create table public.obligations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 100000000),
  -- due_rule: once (due_date) | monthly (due_day 1..31) | weekly (due_weekday 0=Sun..6)
  due_kind text not null check (due_kind in ('once', 'monthly', 'weekly')),
  due_date date,
  due_day smallint check (due_day between 1 and 31),
  due_weekday smallint check (due_weekday between 0 and 6),
  category text not null default 'other' check (category in ('rent', 'school', 'electricity', 'stokvel', 'funeral', 'other')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint obligation_rule_complete check (
    (due_kind = 'once' and due_date is not null) or
    (due_kind = 'monthly' and due_day is not null) or
    (due_kind = 'weekly' and due_weekday is not null))
);
create index obligations_user on public.obligations (user_id);

-- ---------------------------------------------------------------- goals
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  target_cents integer not null check (target_cents > 0 and target_cents <= 100000000),
  due_on date,
  kind text not null default 'savings' check (kind in ('savings', 'stokvel')),
  created_at timestamptz not null default now()
);
create index goals_user on public.goals (user_id);

-- ---------------------------------------------------------------- price_book (public reference data, no user data)
create table public.price_book (
  id text primary key,
  item text not null,
  mode text,            -- taxi | bus | metrorail | gautrain | car | walk | food | electricity | data | grant
  city text,            -- null = national
  unit text not null,
  price_cents integer,  -- null = no verified price (ask the user)
  low_cents integer,
  high_cents integer,
  as_of date not null,
  source_url text,
  confidence text not null check (confidence in ('high', 'medium-high', 'medium', 'low')),
  note text
);

-- ---------------------------------------------------------------- scam_checks (never the message text)
create table public.scam_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  risk_level text not null check (risk_level in ('high', 'medium', 'low')),
  flags jsonb not null default '[]'::jsonb check (jsonb_typeof(flags) = 'array' and pg_column_size(flags) < 2048),
  created_at timestamptz not null default now()
);
create index scam_checks_user on public.scam_checks (user_id, created_at desc);

-- ---------------------------------------------------------------- ai_usage (rate limiting; service role only, no content)
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  fn text not null,
  created_at timestamptz not null default now()
);
create index ai_usage_user_fn_time on public.ai_usage (user_id, fn, created_at desc);

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.obligations enable row level security;
alter table public.goals enable row level security;
alter table public.price_book enable row level security;
alter table public.scam_checks enable row level security;
alter table public.ai_usage enable row level security;

create policy "own profile: select" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "own profile: insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own profile: update" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own profile: delete" on public.profiles for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own transactions: select" on public.transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy "own transactions: insert" on public.transactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own transactions: update" on public.transactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own transactions: delete" on public.transactions for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own obligations: select" on public.obligations for select to authenticated using ((select auth.uid()) = user_id);
create policy "own obligations: insert" on public.obligations for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own obligations: update" on public.obligations for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own obligations: delete" on public.obligations for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own goals: select" on public.goals for select to authenticated using ((select auth.uid()) = user_id);
create policy "own goals: insert" on public.goals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own goals: update" on public.goals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own goals: delete" on public.goals for delete to authenticated using ((select auth.uid()) = user_id);

-- scam_checks: users may read/insert/delete their own; no updates
create policy "own scam checks: select" on public.scam_checks for select to authenticated using ((select auth.uid()) = user_id);
create policy "own scam checks: insert" on public.scam_checks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own scam checks: delete" on public.scam_checks for delete to authenticated using ((select auth.uid()) = user_id);

-- price_book: anyone may read; nobody may write through the API
create policy "price book: public read" on public.price_book for select to anon, authenticated using (true);

-- ai_usage: no policies => no API access at all; edge functions use the service role.

-- Tighten default grants: anon gets nothing on user tables.
revoke all on public.profiles, public.transactions, public.obligations, public.goals, public.scam_checks, public.ai_usage from anon;
revoke all on public.ai_usage from authenticated;
revoke insert, update, delete on public.price_book from anon, authenticated;

-- ---------------------------------------------------------------- updated_at trigger
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- is_demo can only be set by trusted server code (seed_demo sets zaka.trusted for its transaction), never by the client
create or replace function public.protect_profile_flags() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('zaka.trusted', true), '') <> 'on'
     and coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.is_demo := false;
    elsif new.is_demo is distinct from old.is_demo then
      new.is_demo := old.is_demo;
    end if;
  end if;
  return new;
end $$;
create trigger profiles_protect before insert or update on public.profiles for each row execute function public.protect_profile_flags();
