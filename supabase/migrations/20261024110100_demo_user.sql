-- Judge demo account: demo@zaka.app / Zaka2026!demo (synthetic data only). Idempotent.
do $$
declare v_id uuid;
begin
  select id into v_id from auth.users where email = 'demo@zaka.app';
  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', 'demo@zaka.app',
            extensions.crypt('Zaka2026!demo', extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', '{"display_name":"Lerato (demo)"}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id, v_id::text, jsonb_build_object('sub', v_id::text, 'email', 'demo@zaka.app', 'email_verified', true),
            'email', now(), now(), now());
  end if;
  perform public.seed_demo(v_id);
end $$;
