-- LOCAL DEVELOPMENT ONLY. Never run against a hosted project.
-- Creates one login per role. Password for all: lantana-dev-2026
-- Principals use the real names (demo data looks them up by full_name);
-- the manager and staff accounts exist only for RLS testing.

do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('c0000000-0000-4000-8000-000000000001'::uuid, 'maimouna@lantana.test', 'Maimouna Baba Danpullo', 'principal'),
      ('c0000000-0000-4000-8000-000000000002'::uuid, 'fai@lantana.test',      'Fai Shey Derick',        'principal'),
      ('c0000000-0000-4000-8000-000000000003'::uuid, 'manager@lantana.test',  'Test Manager',           'manager'),
      ('c0000000-0000-4000-8000-000000000004'::uuid, 'staff@lantana.test',    'Test Staff',             'staff')
    ) as t(id, email, full_name, role)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('lantana-dev-2026', extensions.gen_salt('bf')), now(),
      jsonb_build_object('provider', 'email', 'providers', array['email'], 'role', u.role),
      jsonb_build_object('full_name', u.full_name), now(), now(),
      '', '', '', '', '', '', '', '');

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now());
  end loop;

  update public.profiles set title = 'Founder & Managing Director' where id = 'c0000000-0000-4000-8000-000000000001';
  update public.profiles set title = 'Principal, Strategy & Business Development' where id = 'c0000000-0000-4000-8000-000000000002';

  -- Local convenience: don't force TOTP for principals in dev. Hosted
  -- environments keep the default (true).
  update public.company set require_principal_mfa = false;
end $$;
