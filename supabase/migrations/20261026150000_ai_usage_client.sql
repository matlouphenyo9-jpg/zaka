-- Demo account: AI limits per person (a salted, daily-rotating hash of the network address; never the address).
alter table public.ai_usage add column if not exists client text check (client is null or char_length(client) <= 64);
create index if not exists ai_usage_user_fn_client_time on public.ai_usage (user_id, fn, client, created_at desc);
