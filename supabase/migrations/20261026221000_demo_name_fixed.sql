-- B6 audit: anyone signed in to the shared demo could rename it, and every judge would then be greeted with that name.
-- Clients can no longer change the demo profile's display name; the demo reset (trusted) still sets it to Lerato.
create or replace function public.protect_profile_flags()
returns trigger language plpgsql set search_path to '' as $function$
begin
  if coalesce(current_setting('zaka.trusted', true), '') <> 'on'
     and coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.is_demo := false;
    else
      if new.is_demo is distinct from old.is_demo then
        new.is_demo := old.is_demo;
      end if;
      if old.is_demo then
        new.display_name := old.display_name;
      end if;
    end if;
  end if;
  return new;
end $function$;
