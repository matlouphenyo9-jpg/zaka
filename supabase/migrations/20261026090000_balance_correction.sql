-- B4-H: "Count my cash" writes a clearly labelled balance correction entry.
alter table public.transactions drop constraint if exists transactions_category_check;
alter table public.transactions add constraint transactions_category_check check (category in (
  'opening_balance', 'balance_correction', 'income', 'grant', 'piece_job', 'salary', 'trade', 'gift',
  'transport', 'food', 'electricity', 'data_airtime', 'rent', 'school', 'stokvel',
  'savings_goal', 'funeral', 'debt', 'health', 'household', 'other'));
