-- Fix: the 30-a-minute spam limit counted the 100 seed rows written by "Try the demo", so a judge could not add an
-- entry for the first minute after opening the demo. Count only the user's own writes (B4 Issues found).
create or replace function public.throttle_user_writes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  if coalesce(current_setting('zaka.trusted', true), '') = 'on' or new.user_id is null then
    return new;
  end if;
  -- Seed rows (written by seed_demo when "Try the demo" resets Lerato) are not the user's own writes.
  if tg_table_name = 'transactions' then
    select count(*) into v_count from public.transactions
     where user_id = new.user_id and created_at > now() - interval '1 minute' and created_via <> 'seed';
  else
    execute format('select count(*) from public.%I where user_id = $1 and created_at > now() - interval ''1 minute''', tg_table_name)
      into v_count using new.user_id;
  end if;
  if v_count >= 30 then
    raise exception 'Too many entries in a minute. Please wait and try again.' using errcode = '53400';
  end if;
  return new;
end $$;
