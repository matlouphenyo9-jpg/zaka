-- B6 audit (Supabase advisor): two trigger-only functions were also callable through the API (/rest/v1/rpc/...).
-- Triggers still fire without EXECUTE, so only the direct API calls go away.
revoke execute on function public.throttle_user_writes() from public, anon, authenticated;
revoke execute on function public.limit_feedback() from public, anon, authenticated;
