-- Demo data so the UI has something to show.
-- Requires at least one row in public.profiles (sign up first).

do $$
declare
  v_owner uuid;
  v_salon_uz uuid;
  v_salon_sm uuid;
  v_barber uuid;
begin
  select id into v_owner
  from public.profiles
  order by case when role in ('owner', 'admin') then 0 else 1 end, created_at
  limit 1;

  if v_owner is null then
    raise notice 'profiles bo''shida avval ro''yxatdan o''tging — seed o''tkazib yuborildi';
    return;
  end if;

  insert into public.salons (
    owner_id, name, slug, description, phone, address, city, district, status
  ) values (
    v_owner, 'Chorsu Barber Shop', 'chorsu-barber-shop',
    'An'anaviy va zamonaviy soch turmag'i, tajribali ustalar jamoasi.',
    '+998 71 200 10 10', 'Chorsu bozori yonida, 1-uy', 'Toshkent', 'Mirobod', 'approved'
  )
  on conflict (slug) do update set owner_id = excluded.owner_id, status = 'approved'
  returning id into v_salon_uz;

  insert into public.salons (
    owner_id, name, slug, description, phone, address, city, district, status
  ) values (
    v_owner, 'Registon Grooming', 'registon-grooming',
    'Salon soch olish, mo''ylov parvarishi va bolalar soch turmagi.',
    '+998 93 500 20 20', 'Registon ko''chasi 12', 'Samarqand', 'Registon', 'approved'
  )
  on conflict (slug) do update set owner_id = excluded.owner_id, status = 'approved'
  returning id into v_salon_sm;

  insert into public.barbers (salon_id, display_name, phone, bio, experience_years)
  values
    (v_salon_uz, 'Aziz Karimov', '+998901110001', 'Klassik fade va soqol Modeling ustasi.', 7),
    (v_salon_uz, 'Jasur Toshpo''latov', '+998901110002', 'Bolalar va adult soch turmag''i.', 4),
    (v_salon_sm, 'Sardor Yo''dgorov', '+998901110003', 'Klasik taroq va mo''ylov parvarishi.', 9)
  on conflict do nothing;

  insert into public.services (salon_id, name, price, duration_minutes)
  select s.id, v.name, v.price, v.duration
  from public.salons s
  cross join (
    values
      ('Soch olish', 60000, 30),
      ('Soch + soqol', 90000, 45),
      ('Mo''ylov parvarishi', 40000, 20),
      ('Bolalar soch turmagi', 50000, 30)
  ) as v(name, price, duration)
  where s.slug in ('chorsu-barber-shop', 'registon-grooming')
    and not exists (
      select 1 from public.services es
      where es.salon_id = s.id and es.name = v.name and es.barber_id is null
    );

  for v_barber in select id from public.barbers where salon_id in (v_salon_uz, v_salon_sm)
  loop
    insert into public.working_hours (barber_id, weekday, start_time, end_time)
    select v_barber, d.n, time '09:00', time '18:00'
    from generate_series(1, 6) d(n)
    on conflict (barber_id, weekday) do nothing;
  end loop;

  raise notice 'Seed tayyor. Barber slugini ochib bron sinab ko''ring';
end;
$$;

select b.id as barber_id, b.display_name, s.slug
from public.barbers b
join public.salons s on s.id = b.salon_id
order by b.display_name;
