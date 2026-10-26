-- B4: tamper-proof spam limit. Paste into Supabase Dashboard → SQL Editor → Run.
-- The current limit counts existing rows, so a script could "insert 30, delete 30, repeat". This counts writes in a
-- log the user cannot read or delete. (The automatic apply timed out waiting for dashboard approval.)
create table if not exists public.write_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  tbl text not null,
  at timestamptz not null default now()
);
create index if not exists write_log_user_at on public.write_log (user_id, at desc);
alter table public.write_log enable row level security;
revoke all on public.write_log from anon, authenticated;

create or replace function public.throttle_user_writes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  if coalesce(current_setting('zaka.trusted', true), '') = 'on' or new.user_id is null then
    return new;
  end if;
  -- Counted in a log the user cannot read or delete, so "insert 30, delete 30, repeat" does not reset the limit.
  -- Seed rows are written with zaka.trusted on and never reach this point.
  delete from public.write_log where user_id = new.user_id and at < now() - interval '2 minutes';
  select count(*) into v_count from public.write_log where user_id = new.user_id and at > now() - interval '1 minute';
  if v_count >= 30 then
    raise exception 'Too many entries in a minute. Please wait and try again.' using errcode = '53400';
  end if;
  insert into public.write_log (user_id, tbl) values (new.user_id, tg_table_name);
  return new;
end $$;

-- B4 fix 2: the app's car-cost editor stores km_each_way / l_per_100km (short strings). Allow them.
create or replace function public.essentials_ok(e jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare k text; v jsonb; lim bigint;
begin
  if jsonb_typeof(e) <> 'object' then return false; end if;
  for k, v in select * from jsonb_each(e) loop
    lim := case k
      when 'transport_daily_cents' then 100000
      when 'fare_single_cents' then 50000
      when 'food_weekly_cents' then 1000000
      when 'electricity_weekly_cents' then 500000
      when 'data_weekly_cents' then 200000
      when 'trips_per_day' then 10
      else null end;
    if k = 'workdays' then
      if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 7 then return false; end if;
      if exists (select 1 from jsonb_array_elements(v) x where jsonb_typeof(x) <> 'number' or x::text::numeric not in (0,1,2,3,4,5,6)) then return false; end if;
    elsif k in ('price_ref', 'mode', 'km_each_way', 'l_per_100km') then
      if jsonb_typeof(v) not in ('string', 'null') or char_length(v #>> '{}') > 40 then return false; end if;
    elsif lim is null then
      return false;
    elsif jsonb_typeof(v) = 'null' then
      continue;
    elsif jsonb_typeof(v) <> 'number' or (v::text)::numeric < 0 or (v::text)::numeric > lim then
      return false;
    end if;
  end loop;
  return true;
end $$;

-- B4-G2: in-app feedback. Owner may INSERT only; nobody can read rows back through the API (no select policy).
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (public.clean_text_ok(comment, 280)),
  may_quote boolean not null default false,
  locale text check (locale in ('en', 'zu', 'xh', 'nso', 'af')),
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
drop policy if exists "feedback: insert own" on public.feedback;
create policy "feedback: insert own" on public.feedback for insert to authenticated with check ((select auth.uid()) = user_id);
revoke all on public.feedback from anon;
grant insert on public.feedback to authenticated;

-- 3 a day per person (the shared demo account: 50, so judges are not blocked by each other).
create or replace function public.limit_feedback() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_count int; v_limit int := 3;
begin
  if exists (select 1 from public.profiles where user_id = new.user_id and is_demo) then v_limit := 50; end if;
  select count(*) into v_count from public.feedback where user_id = new.user_id and created_at > now() - interval '1 day';
  if v_count >= v_limit then
    raise exception 'Feedback limit reached for today' using errcode = '53400';
  end if;
  return new;
end $$;
create or replace trigger limit_feedback before insert on public.feedback for each row execute function public.limit_feedback();

-- For the deck (run any time in the SQL Editor):
--   select count(*) as feedback, round(avg(rating), 2) as avg_stars, count(*) filter (where may_quote) as quotable from public.feedback;
--   select comment, rating, locale, created_at from public.feedback where may_quote and comment is not null order by created_at desc;
--   select count(*) as real_signups from auth.users where email <> 'demo@zaka.app' and email not like '%@zaka-qa.test';

-- B4-E cleanup: delete the QA accounts used for today's live tests (their rows cascade). Run LAST.
delete from auth.users where email in ('qa-owner@zaka-qa.test', 'qa-other@zaka-qa.test', 'qa-new@zaka-qa.test');
