# BARBER.uz MVP

Next.js App Router + TypeScript + Tailwind CSS + Supabase (Auth va PostgreSQL).
Mijoz barberlarni qidiradi, salon profilini ko'radi va bepul bron qiladi; salon
egasi bronlarni boshqaradi; administrator salonlarni tasdiqlaydi.

## Ishga tushirish

```bash
npm install
cp .env.example .env.local   # kalitlarni o'zingizning Supabase loyihasi bilan almashtiring
npm run dev                  # http://localhost:3000
```

Kalitlar kiritilmagan holda ham sayt ochiladi, sahifa tepida
"Supabase ulanishi sozlanmagan" belgisi ko'rsatiladi.

## Supabase sozlamalari

1. Supabase'da yangi loyiha oching va **Settings → API** bo'limidan
   `Project URL` va `publishable/anon key` ni oling:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

   `service_role` kalitini hech qachon `NEXT_PUBLIC_` bilan boshlamagan
   o'zgaruvchiga joylashtirmang.

2. SQL Editor'da avval [supabase/schema.sql](supabase/schema.sql), so'ng
   [supabase/seed.sql](supabase/seed.sql) ni bajaring (seed demo salonlarni
   qo'shadi va kamida bitta profil bo'lishini talab qiladi).

3. `/login` orqali ro'yxatdan o'ting (email parolni 6 belgidan kam olmagan
   qilib tanlang). Loyihada **Authentication → Sign In / Up → Email →
   Confirm email** yoqilgan bo'lsa, ro'yxatdan o'tgach keladigan havolani
   ochish shart; yoki SQL Editor'da:

   ```sql
   update auth.users set email_confirmed_at = now(), confirmation_token = ''
   where email = 'SIZNING_EMAIL';
   ```

4. Birinchi administratorni tayinlang — Supabase → Authentication → Users
   bo'limidagi UUID'ni yozib:

   ```sql
   update public.profiles
   set role = 'admin'
   where id = 'SUPABASE_AUTH_USER_UUID';
   ```

   Rolni foydalanuvchi o'zi o'zgartira olmaydi: `profiles_role_guard`
   triggeri uchun serverda ham, bazada tekshiriladi.

### Demo hisoblar (faqat development)

[supabase/dev-accounts.sql](supabase/dev-accounts.sql) uchta hisob va
ularga mos rollarni yaratadi. Parol: `Barber#Dev2026`.

| Email | Rol | Nima uchun |
| --- | --- | --- |
| `admin@barber.dev` | admin | `/admin` tasdiqlash paneli |
| `owner@barber.dev` | owner | salon kabineti, `seed.sql` egasi |
| `customer@barber.dev` | customer | bronlarim + bekor qilish |

`auth.users` ga oddiy `insert` GoTrue'da 500 xato beradi: token ustunlari
`NULL` emas, `''` bo'lishi va `auth.identities` qatori kerak — shu fayl
buni hisobga olgan holda yozilgan.

## Marshrutlar

| Yo'l | Vazifa |
| --- | --- |
| `/` | Bosh sahifa, yangi tasdiqlangan salonlar |
| `/barbers?q=&city=` | Shahar va ism bo'yicha qidiruv |
| `/salons/[slug]` | Salon profili, barberlar va xizmatlar |
| `/booking?barber=<uuid>` | Bo'sh slotlar va bepul bron |
| `/dashboard` | Mijoz bronlari yoki salon egasi kabineti |
| `/admin` | Tasdiqlash navbatidagi salonlar |
| `/login` | Kirish / ro'yxatdan o'tish |
| `/auth/callback` | Email tasdiqlash kodini sessiyaga almashtirish |

## Bron oqimi

`BookingForm` → `loadSlots()` → SQL `available_slots()` (Toshkent vaqti bo'yicha
30 daqiqali to'r, ish jadvali va band vaqtlarni chiqarib tashlaydi) →
`createBooking()` → SQL `create_booking()`.

To'qnashuv ma'lumotlar bazasi darajasida `no_double_booking` EXCLUDE konstrainti
bilan bloklanadi. Barcha yozuvlar `security definer` funksiyalari orqali
ketadi — jadvallarda `INSERT`/`UPDATE` siyosatlari ataylab ochilmagan.

## Barbarga SMS xabarnoma

`create_booking()` bronni yaratgach, barberting `barbers.phone` raqamiga matn
tayyorlaydi va uni `public.sms_messages` (outbox) jadvaliga `pending` holatida
yozadi, so'ng `booking_id / sms_id / sms_to / sms_body` ni jsonb qilib qaytaradi.
Server action buni [`src/lib/sms.ts`](src/lib/sms.ts) orqali Play Mobile
(sms.play.uz) gateway'iga yuboradi va natijani `mark_sms()` bilan `sent` /
`failed` / `skipped` deb belgilaydi. SMS yetmasa ham bron bekor bo'lmaydi.

```
SMS_PLAY_URL=https://sms.play.uz/api/send     # gateway'ing haqiqiy endpointi
SMS_PLAY_LOGIN=your_login
SMS_PLAY_PASSWORD=your_password
```

Kalitlar `NEXT_PUBLIC_` bilan boshlanmaydi — ular faqat serverda o'qiladi.
Ular bo'sh bo'lsa xabar `skipped` deb belgilanadi (hozirgi holat shu), ya'ni
loyiha SMS kalitsiz ham to'liq ishlaydi.

> Holingiz: Play Mobile hujjatlari ochiq emas, shuning uchun `src/lib/sms.ts`
> `POST {login, password, mobilePhone, message}` shaklini yuboradi. Hisobingizdagi
> API hujjatidagi so'z nomlari boshqacha bo'lsa, shu bitta ob'ektni to'g'rilang.

`barbers.phone` ustuni anon/authenticated uchun yopiq: jadvalda ustun darajasidagi
`SELECT` ruxsati berilgan, shuning uchun `/rest/v1/barbers?select=phone` → 401,
`?select=display_name` → 200. `sms_messages` esa umuman REST orqali o'qilmaydi —
holatni SQL Editor'dan ko'rish kerak.

Eski bazaga yangilash: [supabase/patch-sms.sql](supabase/patch-sms.sql)
(idempotent, qayta ishga tushirsa bo'ladi). Yangi o'rnatishda faqat
`schema.sql` + `seed.sql` kifoya.

## Tillar

`uz / ru / en` — `src/i18n/messages/*.json`. Til prefikssiz routing bilan
`barber-locale` cookie orqali tanlanadi (Header'dagi almashtirgich).

## Tekshirish ro'yxati

Real Supabase loyihasida tekshirilgan (2026-10-22):

- [x] Bosh sahifa bazadan salonlarni yuklaydi.
- [x] `/barbers` filtri ishlaydi, faqat `approved` salonlar ko'rinadi.
- [x] Bir xil vaqtga ikki bron urinishi `no_double_booking` bilan rad etiladi.
- [x] Band vaqt `available_slots` ro'yxatidan chiqadi, bekor qilingandan keyin qaytadi.
- [x] Ish jadvalidan tashqari vaqt `available_slots` ro'yxatida chiqmaydi.
- [x] `/dashboard` faqat tegishli salonlarning bronlarini ko'rsatadi.
- [x] `/admin` faqat `admin` rolida ochiladi (sessiyasiz `/login` ga qaytaradi).
- [x] Anon kalit bilan `POST /rest/v1/salons` → 401 (yozish siyosati yo'q).
- [x] Bron yaratilgach `sms_messages` ga o'zbekcha matn va barber raqami yoziladi.
- [x] SMS kalitsiz holatda xabar `mark_sms` orqali `skipped` bo'ladi, bron baribir turadi.
- [x] Anon kalit `barbers?select=phone` ni o'qiy olmaydi (401), `select=display_name` ishlaydi.

## Hali qilinmagan (production oldidan)

Play Mobile hisob kalitlarini kiritib haqiqiy yuborishni sinash (hozircha
`skipped`), bron bekor qilishda xabar yuborish, `sms_messages` uchun qayta
urinish jobi.

Telefon raqamini SMS bilan tasdiqlash, so'rov tezligini cheklash, salon egasi
tomonidan barber/xizmat/ish jadvalini tahrirlash uchun alohida server amali va
`INSERT`/`UPDATE` siyosatlari, bron bekor qilish muddati qoidalari, testlar va
to'lov yo'naltiruvchisi (MVP'da bron bepul).
