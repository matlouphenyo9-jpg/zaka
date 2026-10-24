-- B2 steps 6–7: protect the shared judge account and slow down account farming.

-- 1) The demo account's login can't be changed or deleted through the API (password, email, phone).
create or replace function public.guard_demo_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(old.email, '') <> 'demo@zaka.app' then
    return coalesce(new, old);
  end if;
  -- Auth API calls arrive as supabase_auth_admin, PostgREST as authenticator; only the dashboard/SQL editor may manage it.
  if session_user in ('postgres', 'supabase_admin') then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    raise exception 'The demo account cannot be deleted' using errcode = '42501';
  end if;
  if new.encrypted_password is distinct from old.encrypted_password
     or new.email is distinct from old.email
     or coalesce(new.email_change, '') is distinct from coalesce(old.email_change, '')
     or new.phone is distinct from old.phone
     or coalesce(new.phone_change, '') is distinct from coalesce(old.phone_change, '') then
    raise exception 'The demo account login cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace trigger guard_demo_auth_user before update or delete on auth.users
  for each row execute function public.guard_demo_auth_user();

-- 2) Cap what one demo session can add (it is reset to Lerato's seed on every "Try the demo").
create or replace function public.cap_demo_rows() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_limit int := case tg_table_name when 'transactions' then 60 when 'scam_checks' then 100 else 15 end;
  v_count int;
begin
  if not exists (select 1 from public.profiles where user_id = new.user_id and is_demo) then
    return new;
  end if;
  if tg_table_name = 'transactions' then
    select count(*) into v_count from public.transactions where user_id = new.user_id and created_via <> 'seed';
  elsif tg_table_name = 'obligations' then
    select count(*) into v_count from public.obligations where user_id = new.user_id;
  elsif tg_table_name = 'goals' then
    select count(*) into v_count from public.goals where user_id = new.user_id;
  else
    select count(*) into v_count from public.scam_checks where user_id = new.user_id;
  end if;
  if v_count >= v_limit and coalesce(current_setting('zaka.trusted', true), '') <> 'on' then
    raise exception 'Demo limit reached: reset the demo from the Me screen' using errcode = '54000';
  end if;
  return new;
end $$;

create or replace trigger cap_demo_transactions before insert on public.transactions for each row execute function public.cap_demo_rows();
create or replace trigger cap_demo_obligations before insert on public.obligations for each row execute function public.cap_demo_rows();
create or replace trigger cap_demo_goals before insert on public.goals for each row execute function public.cap_demo_rows();
create or replace trigger cap_demo_scam_checks before insert on public.scam_checks for each row execute function public.cap_demo_rows();

-- 3) Sign-up throttle: at most 60 new accounts per hour across the whole project (account farming to burn AI quota).
create or replace function public.throttle_signups() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if session_user in ('postgres', 'supabase_admin') then
    return new; -- dashboard / SQL editor
  end if;
  if (select count(*) from auth.users where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Too many sign-ups right now. Please try again later.' using errcode = '54000';
  end if;
  return new;
end $$;

create or replace trigger throttle_signups before insert on auth.users for each row execute function public.throttle_signups();

revoke all on function public.guard_demo_auth_user() from public, anon, authenticated;
revoke all on function public.cap_demo_rows() from public, anon, authenticated;
revoke all on function public.throttle_signups() from public, anon, authenticated;
