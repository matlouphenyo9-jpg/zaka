-- B6 audit: the AI rate limits counted and then inserted in two steps, so a burst of simultaneous requests could all
-- see the old count (25 concurrent scans let 14 through a 10-an-hour limit). ai_take() locks per function, checks the
-- per-user (or, on the demo account, per-network and whole-account) limits and the project's daily budget, and records
-- the call in one transaction. Only the Edge Functions (service role) can call it.
create or replace function public.ai_take(
  p_user uuid, p_fn text, p_client text,
  p_per_hour int, p_per_day int, p_account_per_day int, p_global_per_day int
) returns text
language plpgsql security definer set search_path = public as $$
declare h int; d int; a int; g int;
begin
  perform pg_advisory_xact_lock(hashtext('ai_take:' || p_fn));
  if p_client is not null then
    select count(*) into h from ai_usage where user_id = p_user and fn = p_fn and client = p_client and created_at > now() - interval '1 hour';
    select count(*) into d from ai_usage where user_id = p_user and fn = p_fn and client = p_client and created_at > now() - interval '1 day';
    select count(*) into a from ai_usage where user_id = p_user and fn = p_fn and created_at > now() - interval '1 day';
    if h >= p_per_hour or d >= p_per_day or a >= p_account_per_day then return 'demo_limit'; end if;
  else
    select count(*) into h from ai_usage where user_id = p_user and fn = p_fn and created_at > now() - interval '1 hour';
    select count(*) into d from ai_usage where user_id = p_user and fn = p_fn and created_at > now() - interval '1 day';
    if h >= p_per_hour or d >= p_per_day then return 'limit'; end if;
  end if;
  select count(*) into g from ai_usage where fn = p_fn and created_at > now() - interval '1 day';
  if g >= p_global_per_day then return 'global_budget'; end if;
  insert into ai_usage (user_id, fn, client) values (p_user, p_fn, p_client);
  return 'ok';
end $$;
revoke all on function public.ai_take(uuid, text, text, int, int, int, int) from public, anon, authenticated;
grant execute on function public.ai_take(uuid, text, text, int, int, int, int) to service_role;

create index if not exists ai_usage_fn_time on public.ai_usage (fn, created_at desc);
create index if not exists feedback_user_id_idx on public.feedback (user_id);
