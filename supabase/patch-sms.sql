-- Incremental migration: barber SMS notification.
-- Run on a database that already has schema.sql applied (before 2026-10-22).
-- New installations only need schema.sql + seed.sql.
-- Idempotent: the SQL Editor runs a whole script in one transaction, so a
-- failed attempt leaves nothing behind and this file can simply be re-run.

do $$ begin
  create type public.sms_status as enum ('pending', 'sent', 'failed', 'skipped');
exception when duplicate_object then null;
end $$;

alter table public.barbers add column if not exists phone text;

create table if not exists public.sms_messages (
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

create index if not exists sms_messages_status_idx
  on public.sms_messages(status, created_at);

alter table public.sms_messages enable row level security;

revoke all on public.sms_messages from public, anon, authenticated;

revoke select on public.barbers from anon, authenticated;
grant select (
  id, profile_id, salon_id, display_name,
  bio, experience_years, photo_url, is_active
) on public.barbers to anon, authenticated;

-- The return type changes from uuid to jsonb, so the old signature must go.
drop function if exists public.create_booking(
  uuid, uuid, text, text, timestamptz
);

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

-- Demo barbers already in the database get notification numbers.
update public.barbers set phone = '+998901110001'
where display_name = 'Aziz Karimov' and phone is null;

update public.barbers set phone = '+998901110002'
where display_name = 'Jasur Toshpo''latov' and phone is null;

update public.barbers set phone = '+998901110003'
where display_name = 'Sardor Yo''dgorov' and phone is null;
