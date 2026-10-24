-- seed_demo(p_user): loads Lerato's synthetic 10-week history ending on today's date (Africa/Johannesburg).
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
      (1, -78, 'in', 'opening_balance', 'cash', 42000, 'Opening cash balance'),
      (2, -77, 'out', 'transport', 'cash', 5400, 'Taxi return to work'),
      (3, -76, 'in', 'piece_job', 'piece_job', 32000, 'Domestic work / piece job'),
      (4, -76, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (5, -75, 'out', 'food', 'cash', 23000, 'Groceries / food'),
      (6, -74, 'out', 'electricity', 'cash', 10000, 'Prepaid electricity'),
      (7, -73, 'in', 'piece_job', 'piece_job', 25000, 'Domestic work / piece job'),
      (8, -73, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (9, -72, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (10, -71, 'out', 'data_airtime', 'cash', 3500, 'Data / airtime bundle'),
      (11, -70, 'in', 'grant', 'grant', 58000, 'Child Support Grant'),
      (12, -70, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (13, -69, 'out', 'transport', 'cash', 5400, 'Taxi return to work'),
      (14, -68, 'out', 'food', 'cash', 18500, 'Groceries / food'),
      (15, -68, 'in', 'piece_job', 'piece_job', 38000, 'Domestic work / piece job'),
      (16, -67, 'out', 'electricity', 'cash', 8000, 'Prepaid electricity'),
      (17, -66, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (18, -65, 'out', 'savings_goal', 'cash', 4000, 'Set aside for goal'),
      (19, -65, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (20, -64, 'in', 'piece_job', 'piece_job', 28000, 'Domestic work / piece job'),
      (21, -63, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (22, -62, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (23, -61, 'out', 'food', 'cash', 26000, 'Groceries / food'),
      (24, -61, 'out', 'stokvel', 'cash', 20000, 'Stokvel contribution'),
      (25, -60, 'out', 'electricity', 'cash', 11000, 'Prepaid electricity'),
      (26, -59, 'out', 'transport', 'cash', 5400, 'Taxi return to work'),
      (27, -58, 'in', 'piece_job', 'piece_job', 35000, 'Domestic work / piece job'),
      (28, -58, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (29, -57, 'out', 'data_airtime', 'cash', 5000, 'Data / airtime bundle'),
      (30, -56, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (31, -55, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (32, -54, 'out', 'food', 'cash', 21000, 'Groceries / food'),
      (33, -54, 'in', 'piece_job', 'piece_job', 22000, 'Domestic work / piece job'),
      (34, -53, 'out', 'electricity', 'cash', 9000, 'Prepaid electricity'),
      (35, -52, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (36, -51, 'out', 'savings_goal', 'cash', 3000, 'Set aside for goal'),
      (37, -51, 'out', 'transport', 'cash', 5400, 'Taxi return to work'),
      (38, -49, 'in', 'piece_job', 'piece_job', 40000, 'Domestic work / piece job'),
      (39, -49, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (40, -48, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (41, -47, 'out', 'food', 'cash', 24000, 'Groceries / food'),
      (42, -46, 'out', 'electricity', 'cash', 10000, 'Prepaid electricity'),
      (43, -45, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (44, -44, 'in', 'piece_job', 'piece_job', 30000, 'Domestic work / piece job'),
      (45, -44, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (46, -43, 'out', 'data_airtime', 'cash', 3500, 'Data / airtime bundle'),
      (47, -42, 'out', 'transport', 'cash', 5400, 'Taxi return to work'),
      (48, -41, 'in', 'grant', 'grant', 58000, 'Child Support Grant'),
      (49, -41, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (50, -40, 'out', 'food', 'cash', 22500, 'Groceries / food'),
      (51, -39, 'out', 'electricity', 'cash', 9000, 'Prepaid electricity'),
      (52, -38, 'in', 'piece_job', 'piece_job', 35000, 'Domestic work / piece job'),
      (53, -38, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (54, -37, 'out', 'savings_goal', 'cash', 5000, 'Set aside for goal'),
      (55, -37, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (56, -35, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (57, -34, 'in', 'piece_job', 'piece_job', 26000, 'Domestic work / piece job'),
      (58, -34, 'out', 'transport', 'cash', 5400, 'Taxi return to work'),
      (59, -33, 'out', 'food', 'cash', 20000, 'Groceries / food'),
      (60, -32, 'out', 'electricity', 'cash', 11000, 'Prepaid electricity'),
      (61, -31, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (62, -30, 'out', 'stokvel', 'cash', 20000, 'Stokvel contribution'),
      (63, -30, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (64, -29, 'out', 'data_airtime', 'cash', 4500, 'Data / airtime bundle'),
      (65, -28, 'in', 'piece_job', 'piece_job', 42000, 'Domestic work / piece job'),
      (66, -28, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (67, -27, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (68, -26, 'out', 'food', 'cash', 27500, 'Groceries / food'),
      (69, -25, 'out', 'electricity', 'cash', 9500, 'Prepaid electricity'),
      (70, -24, 'out', 'transport', 'cash', 5400, 'Taxi return to work'),
      (71, -23, 'in', 'piece_job', 'piece_job', 24000, 'Domestic work / piece job'),
      (72, -23, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (73, -22, 'out', 'savings_goal', 'cash', 3000, 'Set aside for goal'),
      (74, -21, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (75, -20, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (76, -19, 'out', 'food', 'cash', 21000, 'Groceries / food'),
      (77, -18, 'out', 'electricity', 'cash', 10500, 'Prepaid electricity'),
      (78, -17, 'in', 'piece_job', 'piece_job', 32000, 'Domestic work / piece job'),
      (79, -17, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (80, -16, 'out', 'transport', 'cash', 5400, 'Taxi return to work'),
      (81, -15, 'out', 'data_airtime', 'cash', 3500, 'Data / airtime bundle'),
      (82, -14, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (83, -13, 'in', 'piece_job', 'piece_job', 30000, 'Domestic work / piece job'),
      (84, -13, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (85, -12, 'out', 'food', 'cash', 25000, 'Groceries / food'),
      (86, -11, 'out', 'electricity', 'cash', 10000, 'Prepaid electricity'),
      (87, -10, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (88, -9, 'in', 'grant', 'grant', 58000, 'Child Support Grant'),
      (89, -9, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (90, -8, 'out', 'savings_goal', 'cash', 5000, 'Set aside for goal'),
      (91, -7, 'out', 'transport', 'cash', 5400, 'Taxi return to work'),
      (92, -6, 'in', 'piece_job', 'piece_job', 38000, 'Domestic work / piece job'),
      (93, -6, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (94, -5, 'out', 'food', 'cash', 21500, 'Groceries / food'),
      (95, -4, 'out', 'electricity', 'cash', 9000, 'Prepaid electricity'),
      (96, -3, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (97, -2, 'in', 'piece_job', 'piece_job', 26000, 'Domestic work / piece job'),
      (98, -2, 'out', 'transport', 'cash', 4800, 'Taxi return to work'),
      (99, -1, 'out', 'data_airtime', 'cash', 4500, 'Data / airtime bundle'),
      (100, 0, 'out', 'transport', 'cash', 4800, 'Taxi return to work')
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
