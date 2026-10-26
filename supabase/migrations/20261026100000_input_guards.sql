-- B4-C: bad-input defence in the database, so the rules hold even when someone skips the app and calls the API
-- with the public key. Mirrors src/lib/validate.ts. Error codes: 23514 check_violation (permanent: the phone drops
-- the write), 53400 rate limit (temporary: the offline queue keeps it and retries later).

-- ---------------------------------------------------------------- text rules
-- Clean text: no control, zero-width or bidi-override characters, at least one letter, within a length.
create or replace function public.clean_text_ok(v text, max_len int) returns boolean
language sql immutable parallel safe set search_path = '' as $$
  select v is null or (
    char_length(v) between 1 and max_len
    and v ~ '[[:alpha:]]'
    and v !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]'
    and v = btrim(v)
  )
$$;

alter table public.transactions add constraint transactions_note_clean check (public.clean_text_ok(note, 140)) not valid;
alter table public.obligations drop constraint if exists obligations_name_check;
alter table public.obligations add constraint obligations_name_clean check (name is not null and public.clean_text_ok(name, 40)) not valid;
alter table public.goals drop constraint if exists goals_name_check;
alter table public.goals add constraint goals_name_clean check (name is not null and public.clean_text_ok(name, 40)) not valid;
alter table public.profiles drop constraint if exists profiles_display_name_check;
alter table public.profiles add constraint profiles_display_name_clean check (public.clean_text_ok(display_name, 40)) not valid;
alter table public.profiles add constraint profiles_city_clean check (public.clean_text_ok(city, 60)) not valid;
alter table public.profiles add constraint profiles_ignored_patterns_small check (cardinality(ignored_patterns) <= 50) not valid;

-- ---------------------------------------------------------------- dates
alter table public.transactions add constraint transactions_date_floor check (occurred_on >= date '2024-01-01') not valid;
alter table public.goals add constraint goals_due_range check (due_on is null or due_on between date '2024-01-01' and date '2100-01-01') not valid;
alter table public.obligations add constraint obligations_due_date_range check (due_date is null or due_date between date '2024-01-01' and date '2100-01-01') not valid;

-- ---------------------------------------------------------------- realistic everyday costs and income plan
-- essentials: known keys only, each within a realistic range (cents). Daily transport R0–R1,000; weekly food R0–R10,000.
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
    elsif k in ('price_ref', 'mode') then
      if jsonb_typeof(v) not in ('string', 'null') or char_length(v #>> '{}') > 40 then return false; end if;
    elsif lim is null then
      return false; -- unknown key
    elsif jsonb_typeof(v) = 'null' then
      continue;
    elsif jsonb_typeof(v) <> 'number' or (v::text)::numeric < 0 or (v::text)::numeric > lim then
      return false;
    end if;
  end loop;
  return true;
end $$;

create or replace function public.income_plan_ok(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) <= 20 and not exists (
    select 1 from jsonb_array_elements(p) x
    where jsonb_typeof(x) <> 'object'
       or jsonb_typeof(x -> 'amount_cents') <> 'number'
       or (x ->> 'amount_cents')::numeric <= 0
       or (x ->> 'amount_cents')::numeric > 100000000
  )
$$;

alter table public.profiles add constraint profiles_essentials_ok check (public.essentials_ok(essentials)) not valid;
alter table public.profiles add constraint profiles_income_plan_ok check (public.income_plan_ok(income_plan)) not valid;

-- ---------------------------------------------------------------- writes that only trusted server code may do
-- "seed" rows are only written by seed_demo. A client claiming created_via = 'seed' could otherwise slip past the
-- demo account's entry cap (which ignores seed rows). Dates more than 7 days ahead are refused (SA time).
create or replace function public.guard_transaction_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('zaka.trusted', true), '') <> 'on' then
    if new.created_via = 'seed' then
      raise exception 'created_via seed is reserved' using errcode = '23514';
    end if;
    if new.occurred_on > (now() at time zone 'Africa/Johannesburg')::date + 7 then
      raise exception 'date too far in the future' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create or replace trigger guard_transaction_write before insert or update on public.transactions
  for each row execute function public.guard_transaction_write();

-- ---------------------------------------------------------------- spam limit: 30 new rows a minute per user per table
create or replace function public.throttle_user_writes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  if coalesce(current_setting('zaka.trusted', true), '') = 'on' or new.user_id is null then
    return new;
  end if;
  execute format('select count(*) from public.%I where user_id = $1 and created_at > now() - interval ''1 minute''', tg_table_name)
    into v_count using new.user_id;
  if v_count >= 30 then
    raise exception 'Too many entries in a minute. Please wait and try again.' using errcode = '53400';
  end if;
  return new;
end $$;
create or replace trigger throttle_transactions before insert on public.transactions for each row execute function public.throttle_user_writes();
create or replace trigger throttle_obligations before insert on public.obligations for each row execute function public.throttle_user_writes();
create or replace trigger throttle_goals before insert on public.goals for each row execute function public.throttle_user_writes();
create or replace trigger throttle_scam_checks before insert on public.scam_checks for each row execute function public.throttle_user_writes();

-- ---------------------------------------------------------------- seed_demo: demo account only, at most every 15 s
create or replace function public.seed_demo_guard(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
begin
  if v_role in ('service_role', '') then return; end if; -- SQL editor / migrations / service code
  if not exists (select 1 from auth.users where id = p_user and email = 'demo@zaka.app') then
    raise exception 'Only the demo account can be reset' using errcode = '42501';
  end if;
  if exists (select 1 from public.transactions where user_id = p_user and created_via = 'seed' and created_at > now() - interval '15 seconds') then
    raise exception 'Demo was just reset' using errcode = '53400';
  end if;
end $$;
revoke all on function public.seed_demo_guard(uuid) from public, anon, authenticated;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.seed_demo(uuid)'::regprocedure);
  if position('seed_demo_guard' in d) = 0 then
    d := replace(d, 'perform set_config(''zaka.trusted'', ''on'', true);',
                 'perform public.seed_demo_guard(p_user);' || chr(10) || '  perform set_config(''zaka.trusted'', ''on'', true);');
    execute d;
  end if;
end $$;

-- Existing rows were checked before this migration; make every new constraint fully valid.
alter table public.transactions validate constraint transactions_note_clean;
alter table public.transactions validate constraint transactions_date_floor;
alter table public.obligations validate constraint obligations_name_clean;
alter table public.obligations validate constraint obligations_due_date_range;
alter table public.goals validate constraint goals_name_clean;
alter table public.goals validate constraint goals_due_range;
alter table public.profiles validate constraint profiles_display_name_clean;
alter table public.profiles validate constraint profiles_city_clean;
alter table public.profiles validate constraint profiles_ignored_patterns_small;
alter table public.profiles validate constraint profiles_essentials_ok;
alter table public.profiles validate constraint profiles_income_plan_ok;
