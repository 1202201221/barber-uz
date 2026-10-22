import Link from "next/link";
import { getTranslations } from "next-intl/server";
import BookingForm, { type BookingService } from "@/components/BookingForm";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ barber?: string }>;
}) {
  const { barber: barberId } = await searchParams;
  const t = await getTranslations();

  if (!barberId) {
    return (
      <main className="mx-auto max-w-xl p-8">
        {t("booking.chooseBarber")}{" "}
        <Link className="underline" href="/barbers">
          {t("booking.chooseBarberLink")}
        </Link>
        .
      </main>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <p>{t("booking.notFound")}</p>
      </main>
    );
  }

  const supabase = await createClient();

  const { data: barber } = await supabase
    .from("barbers")
    .select("id, profile_id, salon_id, display_name, bio, experience_years, photo_url, is_active")
    .eq("id", barberId)
    .eq("is_active", true)
    .maybeSingle();

  if (!barber) {
    return (
      <main className="p-8">
        {t("booking.notFound")}{" "}
        <Link className="underline" href="/barbers">
          {t("booking.chooseBarberLink")}
        </Link>
      </main>
    );
  }

  const { data: rows } = await supabase
    .from("services")
    .select("id, salon_id, barber_id, name, price, duration_minutes, is_active")
    .eq("salon_id", barber.salon_id)
    .eq("is_active", true);

  const services: BookingService[] = (rows ?? [])
    .filter(
      (row) => row.barber_id === null || row.barber_id === barber.id,
    )
    .map((row) => ({
      id: row.id,
      name: row.name,
      price: row.price,
      duration_minutes: row.duration_minutes,
    }));

  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <div className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
        <p className="text-sm text-amber-700">{t("booking.eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-black">{t("booking.title")}</h1>
        <p className="my-4 text-neutral-500">
          {t("booking.barber")}: {barber.display_name}
        </p>
        <BookingForm barberId={barber.id} services={services} />
      </div>
    </main>
  );
}
