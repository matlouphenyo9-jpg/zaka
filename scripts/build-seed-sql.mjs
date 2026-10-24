// Writes supabase/migrations/*_seed_demo.sql from the generated rows.
import { readFileSync, writeFileSync } from 'node:fs';
const rows = readFileSync(new URL('./seed-rows.sql.txt', import.meta.url), 'utf8').trimEnd();
const sql = `-- seed_demo(p_user): loads Lerato's synthetic 10-week history ending on today's date (Africa/Johannesburg).
-- Every row is shifted by whole days so the demo state is the same on any judging date. The two stokvel
-- payments are re-anchored to the day of month of the next contribution (due in 5 days). Mirrors src/data/demo.ts.
-- Callable only for yourself (auth.uid()) or by the service role. Wipes and replaces that user's data.
create or replace function public.seed_demo(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Africa/Johannesburg')::date;
  v_stokvel_due date := v_today + 5;
  v_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
begin
  if p_user is null then raise exception 'user required'; end if;
  if v_role <> 'service_role' and (auth.uid() is null or auth.uid() <> p_user) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  perform set_config('zaka.trusted', 'on', true);

  delete from public.transactions where user_id = p_user;
  delete from public.obligations where user_id = p_user;
  delete from public.goals where user_id = p_user;
  delete from public.scam_checks where user_id = p_user;

  insert into public.transactions (user_id, direction, amount_cents, category, source, note, occurred_on, created_via, confirmed)
  select p_user, r.direction, r.cents, r.category, r.source, r.note,
         case when r.category = 'stokvel'
              then (v_stokvel_due - make_interval(months => (case when r.id = 24 then 2 else 1 end)))::date
              else v_today + r.offset_days end,
         'seed', true
  from (values
${rows}
  ) as r(id, offset_days, direction, category, source, cents, note);

  insert into public.obligations (user_id, name, amount_cents, due_kind, due_day, category, active)
  values (p_user, 'Stokvel', 20000, 'monthly', extract(day from v_stokvel_due)::smallint, 'stokvel', true);

  insert into public.goals (user_id, name, target_cents, due_on, kind)
  values (p_user, 'School shoes', 50000, v_today + 56, 'savings');

  insert into public.profiles (user_id, display_name, locale, city, transport_mode, reserve_amount, income_plan, essentials, ignored_patterns, consent_at, onboarded_at, is_demo)
  values (p_user, 'Lerato', 'xh', 'Cape Town', 'taxi', 0, '[]'::jsonb,
          '{"transport_daily_cents":4800,"workdays":[1,2,3,4,5],"fare_single_cents":2400,"trips_per_day":2}'::jsonb,
          '{}', now(), now(), (select email = 'demo@zaka.app' from auth.users where id = p_user))
  on conflict (user_id) do update set
    display_name = excluded.display_name, locale = excluded.locale, city = excluded.city, transport_mode = excluded.transport_mode,
    reserve_amount = 0, income_plan = '[]'::jsonb, essentials = excluded.essentials, ignored_patterns = '{}',
    consent_at = coalesce(public.profiles.consent_at, now()), onboarded_at = coalesce(public.profiles.onboarded_at, now()),
    is_demo = excluded.is_demo;
end $$;

revoke all on function public.seed_demo(uuid) from public, anon;
grant execute on function public.seed_demo(uuid) to authenticated, service_role;

-- delete_my_data(): POPIA deletion route. Deletes the caller's auth user; every table cascades.
-- The shared judge account cannot be deleted (it can be reset with seed_demo instead).
create or replace function public.delete_my_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where user_id = v_uid and is_demo) then
    raise exception 'The demo account cannot be deleted' using errcode = '42501';
  end if;
  delete from auth.users where id = v_uid;
end $$;

revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;
`;
writeFileSync(new URL('../supabase/migrations/20261024110000_seed_demo.sql', import.meta.url), sql);
console.log('written');
