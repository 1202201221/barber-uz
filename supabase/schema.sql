-- BARBER.uz MVP schema
-- Run in Supabase -> SQL Editor (or supabase db push).

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.app_role as enum (
  'customer', 'barber', 'owner', 'admin'
);

create type public.booking_status as enum (
  'pending', 'confirmed', 'completed',
  'cancelled', 'no_show'
);

create type public.sms_status as enum (
  'pending', 'sent', 'failed', 'skipped'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  role public.app_role not null default 'customer',
  locale text not null default 'uz'
    check (locale in ('uz', 'ru', 'en')),
  created_at timestamptz not null default now()
);

create table public.salons (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  name text not null,
  slug text unique not null,
  description text not null default '',
  phone text,
  address text not null,
  city text not null,
  district text,
  latitude double precision,
  longitude double precision,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id),
  salon_id uuid not null references public.salons(id)
    on delete cascade,
  display_name text not null,
  phone text,
  bio text not null default '',
  experience_years integer not null default 0
    check (experience_years >= 0),
  photo_url text,
  is_active boolean not null default true
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id)
    on delete cascade,
  barber_id uuid references public.barbers(id)
    on delete cascade,
  name text not null,
  price integer not null check (price >= 0),
  duration_minutes integer not null
    check (duration_minutes between 5 and 480),
  is_active boolean not null default true
);

create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id)
    on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time),
  unique (barber_id, weekday)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id),
  barber_id uuid not null references public.barbers(id),
  service_id uuid not null references public.services(id),
  customer_name text not null,
  customer_phone text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price_snapshot integer not null check (price_snapshot >= 0),
  status public.booking_status not null default 'confirmed',
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  constraint no_double_booking
    exclude using gist (
      barber_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    )
    where (status in ('pending', 'confirmed'))
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id),
  customer_id uuid not null references public.profiles(id),
  barber_id uuid not null references public.barbers(id),
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

-- Outbox for barber notifications. Deliberately has no RLS policy:
-- only security definer functions touch it, so phone numbers never
-- reach a client through PostgREST.
create table public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  to_phone text not null,
  body text not null,
  status public.sms_status not null default 'pending',
  provider_id text,
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sms_messages_status_idx
  on public.sms_messages(status, created_at);

create index salons_city_status_idx
  on public.salons(city, status);
create index barbers_salon_idx
  on public.barbers(salon_id, is_active);

create index bookings_barber_time_idx
  on public.bookings(barber_id, starts_at);

create index bookings_customer_idx
  on public.bookings(customer_id, created_at desc);

-- Profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.phone
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Only an admin (or the postgres owner) may change a role.
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

  -- Server-side contexts (SQL editor, migrations, service_role) have no
  -- auth.uid(); anon/authenticated writes are already blocked by RLS, so the
  -- only client path that reaches this trigger is a logged-in user.
  if auth.uid() is null
     or v_current_role = 'admin'
     or (select current_setting('role', true)) = 'postgres' then
    return new;
  end if;

  raise exception 'Rolni faqat administrator o''zgartiradi';
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
before update on public.profiles
for each row execute procedure public.guard_profile_role();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'admin' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

----------------------------------------------------------------
-- Booking creation: validates salon/barber/service match,
-- working hours and rejects overlapping slots.
----------------------------------------------------------------
create or replace function public.create_booking(
  p_barber_id uuid,
  p_service_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_starts_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_id uuid;
  v_end_at timestamptz;
  v_price integer;
  v_duration integer;
  v_customer_id uuid := auth.uid();
  v_barber_phone text;
  v_service_name text;
  v_salon_name text;
  v_sms_id uuid;
  v_sms_body text;
begin
  if length(trim(p_customer_name)) < 2
     or length(trim(p_customer_phone)) < 7 then
    raise exception 'Mijoz ma''lumotlari noto''g''ri';
  end if;

  if p_starts_at <= now()
     or p_starts_at > now() + interval '90 days' then
    raise exception 'Bron vaqti noto''g''ri';
  end if;

  select s.price, s.duration_minutes, s.name, b.phone, salon.name
  into v_price, v_duration, v_service_name, v_barber_phone, v_salon_name
  from public.services s
  join public.barbers b on b.id = s.barber_id
    or (s.barber_id is null and s.salon_id = b.salon_id)
  join public.salons salon on salon.id = b.salon_id
  where b.id = p_barber_id
    and s.id = p_service_id
    and s.is_active
    and b.is_active
    and salon.status = 'approved'
  limit 1;

  if not found then
    raise exception 'Barber yoki xizmat mavjud emas';
  end if;

  v_end_at := p_starts_at + make_interval(mins => v_duration);

  if not exists (
    select 1
    from public.working_hours wh
    where wh.barber_id = p_barber_id
      and wh.weekday =
        extract(dow from p_starts_at at time zone 'Asia/Tashkent')::integer
      and (p_starts_at at time zone 'Asia/Tashkent')::time >= wh.start_time
      and (v_end_at at time zone 'Asia/Tashkent')::time <= wh.end_time
  ) then
    raise exception 'Tanlangan vaqt ish jadvaliga mos emas';
  end if;

  insert into public.bookings (
    customer_id, barber_id, service_id,
    customer_name, customer_phone,
    starts_at, ends_at, price_snapshot, status
  ) values (
    v_customer_id, p_barber_id, p_service_id,
    trim(p_customer_name), trim(p_customer_phone),
    p_starts_at, v_end_at, v_price, 'confirmed'
  )
  returning id into v_booking_id;

  if v_barber_phone is not null and length(trim(v_barber_phone)) >= 9 then
    v_sms_body := 'BARBER.uz — yangi bron: ' || trim(p_customer_name)
      || ' (' || trim(p_customer_phone) || '), ' || v_service_name || ', '
      || to_char(p_starts_at at time zone 'Asia/Tashkent', 'DD.MM HH24:MI')
      || '. ' || v_salon_name;

    insert into public.sms_messages (booking_id, to_phone, body)
    values (v_booking_id, trim(v_barber_phone), v_sms_body)
    returning id into v_sms_id;
  end if;

  return jsonb_build_object(
    'booking_id', v_booking_id,
    'sms_id', v_sms_id,
    'sms_to', nullif(trim(coalesce(v_barber_phone, '')), ''),
    'sms_body', v_sms_body
  );
end;
$$;

revoke all on function public.create_booking(
  uuid, uuid, text, text, timestamptz
) from public;

grant execute on function public.create_booking(
  uuid, uuid, text, text, timestamptz
) to anon, authenticated;

----------------------------------------------------------------
-- Records the result of handing an SMS to the provider. Called by the
-- web process right after create_booking; the 5 minute window keeps a
-- guessed uuid from touching older rows.
----------------------------------------------------------------
create or replace function public.mark_sms(
  p_sms_id uuid,
  p_status text,
  p_provider_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('sent', 'failed', 'skipped') then
    raise exception 'Noto''g''ri SMS holati';
  end if;

  update public.sms_messages
  set status = p_status::public.sms_status,
      provider_id = coalesce(p_provider_id, provider_id),
      error = nullif(coalesce(p_error, error, ''), ''),
      attempts = attempts + 1,
      updated_at = now()
  where id = p_sms_id
    and status = 'pending'
    and created_at > now() - interval '5 minutes';
end;
$$;

revoke all on function public.mark_sms(uuid, text, text, text) from public;

grant execute on function public.mark_sms(uuid, text, text, text)
to anon, authenticated;

----------------------------------------------------------------
-- Free slots for a barber (30 minute grid, next 14 days).
----------------------------------------------------------------
create or replace function public.available_slots(
  p_barber_id uuid,
  p_service_id uuid,
  p_days integer default 7
)
returns table (starts_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with svc as (
    select s.duration_minutes
    from public.services s
    where s.id = p_service_id and s.is_active
  ),
  cand as (
    select (date_trunc('day', now() at time zone 'Asia/Tashkent')
            + make_interval(days => d.n) + interval '8 hours')
      + make_interval(mins => (q.n * 30)) as local_start
    from generate_series(0, greatest(least(p_days, 14), 1)) d(n)
    cross join generate_series(0, 27) q(n)
  )
  select (c.local_start at time zone 'Asia/Tashkent')::timestamptz as starts_at
  from cand c
  cross join svc
  where c.local_start > now() at time zone 'Asia/Tashkent' + interval '15 minutes'
    and extract(dow from c.local_start)::integer in (
      select wh.weekday
      from public.working_hours wh
      where wh.barber_id = p_barber_id
        and wh.start_time <= c.local_start::time
        and wh.end_time >= (c.local_start
              + make_interval(mins => svc.duration_minutes))::time
    )
    and not exists (
      select 1
      from public.bookings b
      where b.barber_id = p_barber_id
        and b.status in ('pending', 'confirmed')
        and (b.starts_at at time zone 'Asia/Tashkent',
             b.ends_at at time zone 'Asia/Tashkent')
          overlaps (c.local_start,
                    c.local_start + make_interval(mins => svc.duration_minutes))
    )
  order by 1
  limit 60;
$$;

revoke all on function public.available_slots(uuid, uuid, integer) from public;
grant execute on function public.available_slots(uuid, uuid, integer)
  to anon, authenticated;

----------------------------------------------------------------
-- Customer cancels own future booking.
----------------------------------------------------------------
create or replace function public.cancel_own_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bookings
  set status = 'cancelled'
  where id = p_booking_id
    and customer_id = auth.uid()
    and status in ('pending', 'confirmed')
    and starts_at > now();

  if not found then
    raise exception 'Bekor qilib bo''lmadi';
  end if;
end;
$$;

revoke all on function public.cancel_own_booking(uuid) from public;
grant execute on function public.cancel_own_booking(uuid) to authenticated;

----------------------------------------------------------------
-- Owner/admin sets a booking status for their own salon.
----------------------------------------------------------------
create or replace function public.owner_update_booking(
  p_booking_id uuid,
  p_status public.booking_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bookings b
  set status = p_status
  from public.barbers br
  join public.salons s on s.id = br.salon_id
  where b.id = p_booking_id
    and br.id = b.barber_id
    and (s.owner_id = auth.uid() or public.is_admin());

  if not found then
    raise exception 'Ruxsat berilmagan';
  end if;
end;
$$;

revoke all on function public.owner_update_booking(uuid, public.booking_status)
  from public;

grant execute on function public.owner_update_booking(
  uuid, public.booking_status
) to authenticated;

----------------------------------------------------------------
-- Owner requests a salon (stays pending until admin approves).
----------------------------------------------------------------
create or replace function public.owner_create_salon(
  p_name text,
  p_description text,
  p_phone text,
  p_address text,
  p_city text,
  p_district text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_slug text;
  v_id uuid;
begin
  select role into v_role from public.profiles where id = auth.uid();

  if v_role is null or v_role not in ('owner', 'admin') then
    raise exception 'Salon faqat egasi yoki administrator tomonidan qo''shiladi';
  end if;

  if length(trim(p_name)) < 2 or length(trim(p_address)) < 3
     or length(trim(p_city)) < 2 then
    raise exception 'Salon ma''lumotlari noto''g''ri';
  end if;

  v_slug := trim(both '-' from regexp_replace(
    lower(concat(trim(p_name), '-', substr(md5(random()::text), 1, 6))),
    '[^a-z0-9]+', '-', 'g'
  ));

  insert into public.salons (
    owner_id, name, slug, description, phone, address, city, district, status
  ) values (
    auth.uid(), trim(p_name), v_slug, coalesce(trim(p_description), ''),
    nullif(trim(coalesce(p_phone, '')), ''), trim(p_address), trim(p_city),
    nullif(trim(coalesce(p_district, '')), ''), 'pending'
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.owner_create_salon(
  text, text, text, text, text, text
) from public;

grant execute on function public.owner_create_salon(
  text, text, text, text, text, text
) to authenticated;

----------------------------------------------------------------
-- Admin approval
----------------------------------------------------------------
create or replace function public.admin_approve_salon(
  p_salon_id uuid,
  p_approved boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Ruxsat berilmagan';
  end if;

  update public.salons
  set status = case when p_approved then 'approved' else 'rejected' end
  where id = p_salon_id
    and status = 'pending';

  if not found then
    raise exception 'Salon topilmadi yoki ko''rib chiqilgan';
  end if;
end;
$$;

revoke all on function public.admin_approve_salon(uuid, boolean) from public;
grant execute on function public.admin_approve_salon(uuid, boolean)
  to authenticated;

----------------------------------------------------------------
-- Row level security
----------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.salons enable row level security;
alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.working_hours enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;
alter table public.sms_messages enable row level security;

-- No policy on purpose: only security definer functions touch the outbox.
revoke all on public.sms_messages from public, anon, authenticated;

-- Barber phone numbers must not become a public listing. Replacing the
-- table-level SELECT with an explicit column list keeps every existing
-- read working while `select=phone` is denied by the database.
revoke select on public.barbers from anon, authenticated;
grant select (
  id, profile_id, salon_id, display_name,
  bio, experience_years, photo_url, is_active
) on public.barbers to anon, authenticated;

create policy "Public approved salons"
on public.salons for select
using (status = 'approved');

create policy "Owners read their salons"
on public.salons for select
to authenticated
using (owner_id = (select auth.uid()));

create policy "Admins read all salons"
on public.salons for select
to authenticated
using (public.is_admin());

create policy "Public active barbers"
on public.barbers for select
using (
  is_active and exists (
    select 1 from public.salons s
    where s.id = salon_id and s.status = 'approved'
  )
);

create policy "Owners read their barbers"
on public.barbers for select
to authenticated
using (
  exists (
    select 1 from public.salons s
    where s.id = salon_id and s.owner_id = (select auth.uid())
  )
);

create policy "Admins read all barbers"
on public.barbers for select
to authenticated
using (public.is_admin());

create policy "Public active services"
on public.services for select
using (
  is_active and exists (
    select 1 from public.salons s
    where s.id = salon_id and s.status = 'approved'
  )
);

create policy "Owners read their services"
on public.services for select
to authenticated
using (
  exists (
    select 1 from public.salons s
    where s.id = salon_id and s.owner_id = (select auth.uid())
  )
);

create policy "Admins read all services"
on public.services for select
to authenticated
using (public.is_admin());

create policy "Public working hours"
on public.working_hours for select
using (exists (
  select 1 from public.barbers b
  join public.salons s on s.id = b.salon_id
  where b.id = barber_id and b.is_active
    and s.status = 'approved'
));

create policy "Owners read their working hours"
on public.working_hours for select
to authenticated
using (
  exists (
    select 1 from public.barbers b
    join public.salons s on s.id = b.salon_id
    where b.id = barber_id and s.owner_id = (select auth.uid())
  )
);

create policy "Read own profile"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

create policy "Admins read profiles"
on public.profiles for select
to authenticated
using (public.is_admin());

-- The role guard trigger blocks role escalation from this policy.
create policy "Update own profile fields"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Customers read own bookings"
on public.bookings for select
to authenticated
using (customer_id = (select auth.uid()));

create policy "Owners read their salon bookings"
on public.bookings for select
to authenticated
using (
  exists (
    select 1
    from public.barbers b
    join public.salons s on s.id = b.salon_id
    where b.id = barber_id
      and s.owner_id = (select auth.uid())
  )
);

create policy "Admins read all bookings"
on public.bookings for select
to authenticated
using (public.is_admin());

-- Writes go through the security definer functions above.
-- No direct INSERT/UPDATE/DELETE policies are enabled on purpose.

create policy "Customers read own reviews"
on public.reviews for select
to authenticated
using (customer_id = (select auth.uid()));

create policy "Public reviews of approved salons"
on public.reviews for select
using (
  exists (
    select 1
    from public.barbers b
    join public.salons s on s.id = b.salon_id
    where b.id = reviews.barber_id and s.status = 'approved'
  )
);
