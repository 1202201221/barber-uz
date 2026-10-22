-- Development helper: demo accounts + demo data.
-- NOT for production. Run after schema.sql, then seed.sql.
-- Demo password for all three accounts: Barber#Dev2026
--
-- Notes learned from a real Supabase project (why a plain INSERT into
-- auth.users is not enough):
--   * GoTrue rejects the login with "Database error querying schema" unless
--     the token columns are '' instead of NULL and raw_app_meta_data is set.
--   * A row in auth.identities is required (its "email" column is generated,
--     so it must not be listed in the INSERT).
--   * ON CONFLICT (email) cannot be used: the unique index is on lower(email).

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_role public.app_role;
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  select role into v_current_role
  from public.profiles
  where id = auth.uid();

  if auth.uid() is null
     or v_current_role = 'admin'
     or (select current_setting('role', true)) = 'postgres' then
    return new;
  end if;

  raise exception 'Rolni faqat administrator o''zgartiradi';
end;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, reauthentication_token,
  email_change, email_change_token_current, email_change_token_new,
  phone_change, phone_change_token,
  created_at, updated_at, is_sso_user, is_anonymous
)
select
  '00000000-0000-0000-0000-000000000000',
  v.user_id,
  'authenticated',
  'authenticated',
  v.email,
  crypt('Barber#Dev2026', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object(
    'sub', v.user_id::text, 'email', v.email,
    'full_name', v.full_name, 'email_verified', true, 'phone_verified', false
  ),
  '', '', '', '', '', '', '', '',
  now(), now(), false, false
from (values
  ('28d32eb8-0000-4000-8000-000000000001'::uuid, 'admin@barber.dev',    'Demo Administrator'),
  ('28d32eb8-0000-4000-8000-000000000002'::uuid, 'owner@barber.dev',    'Demo Salon Egasi'),
  ('28d32eb8-0000-4000-8000-000000000003'::uuid, 'customer@barber.dev', 'Demo Mijoz')
) as v(user_id, email, full_name)
where not exists (
  select 1 from auth.users u where lower(u.email) = lower(v.email)
);

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  u.id::text,
  u.id,
  jsonb_build_object(
    'sub', u.id::text, 'email', u.email,
    'email_verified', true, 'phone_verified', false
  ),
  'email', now(), now(), now()
from auth.users u
where u.email like '%@barber.dev'
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );

insert into public.profiles (id, full_name, role)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', ''), 'customer'
from auth.users u
where u.email like '%@barber.dev'
  and not exists (select 1 from public.profiles p where p.id = u.id);

update public.profiles set role = 'admin'
where id = (select id from auth.users where lower(email) = 'admin@barber.dev');

update public.profiles set role = 'owner'
where id = (select id from auth.users where lower(email) = 'owner@barber.dev');

select p.id, u.email, p.full_name, p.role
from public.profiles p
join auth.users u on u.id = p.id
where u.email like '%@barber.dev'
order by p.role;
