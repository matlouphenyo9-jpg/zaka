-- B5: entries saved from a scanned slip are marked created_via = 'slip' (shown with a 📸 badge).
alter table public.transactions drop constraint transactions_created_via_check;
alter table public.transactions add constraint transactions_created_via_check check (created_via = any (array['manual','ai_parsed','seed','slip']));
