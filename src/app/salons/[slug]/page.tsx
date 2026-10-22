import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Barber, Service } from "@/lib/types";

export default async function SalonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations();

  if (!isSupabaseConfigured) notFound();

  const supabase = await createClient();

  const { data: salon } = await supabase
    .from("salons")
    .select("id, name, slug, description, phone, address, city, district, latitude, longitude, status, owner_id, created_at")
    .eq("slug", slug)
    .eq("status", "approved")
    .maybeSingle();

  if (!salon) notFound();

  const [{ data: barbers }, { data: services }] = await Promise.all([
    supabase
      .from("barbers")
      .select("id, profile_id, salon_id, display_name, bio, experience_years, photo_url, is_active")
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .order("experience_years", { ascending: false }),
    supabase
      .from("services")
      .select("id, salon_id, barber_id, name, price, duration_minutes, is_active")
      .eq("salon_id", salon.id)
      .eq("is_active", true),
  ]);

  const activeBarbers: Barber[] = barbers ?? [];
  const activeServices: Service[] = services ?? [];

  const servicesOf = (barber: Barber) =>
    activeServices.filter(
      (service) => service.barber_id === null || service.barber_id === barber.id,
    );

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="rounded-3xl bg-neutral-950 p-8 text-white md:p-12">
        <p className="text-sm text-amber-400">
          {salon.city}
          {salon.district ? ` · ${salon.district}` : ""}
        </p>
        <h1 className="mt-2 text-4xl font-black">{salon.name}</h1>
        <p className="mt-4 text-neutral-300">{salon.description}</p>
        <p className="mt-5 text-sm">{salon.address}</p>
        {salon.phone && (
          <a href={`tel:${salon.phone}`} className="mt-3 inline-block underline">
            {salon.phone}
          </a>
        )}
        {salon.latitude != null && salon.longitude != null && (
          <a
            className="mt-4 block text-amber-400 underline"
            target="_blank"
            rel="noreferrer"
            href={`https://www.google.com/maps?q=${salon.latitude},${salon.longitude}`}
          >
            {t("salon.map")}
          </a>
        )}
      </div>

      <h2 className="mb-5 mt-10 text-2xl font-bold">{t("salon.ourBarbers")}</h2>

      <div className="grid gap-5 md:grid-cols-2">
        {activeBarbers.map((barber) => (
          <article
            key={barber.id}
            className="rounded-2xl border bg-white p-5"
          >
            <h3 className="text-xl font-bold">{barber.display_name}</h3>
            <p className="mt-1 text-sm text-neutral-500">
              {t("salon.experience", { years: barber.experience_years })}
            </p>
            <p className="mt-3 text-sm">{barber.bio}</p>

            <h4 className="mb-2 mt-5 font-semibold">{t("salon.services")}</h4>
            <ul className="space-y-2">
              {servicesOf(barber).map((service) => (
                <li
                  key={service.id}
                  className="flex justify-between gap-3 text-sm"
                >
                  <span>
                    {service.name} ·{" "}
                    {t("common.minutes", {
                      count: service.duration_minutes,
                    })}
                  </span>
                  <strong>
                    {service.price.toLocaleString("uz-UZ")} {t("common.som")}
                  </strong>
                </li>
              ))}
            </ul>

            <Link
              href={`/booking?barber=${barber.id}`}
              className="mt-5 block rounded-xl bg-amber-500 px-4 py-3 text-center font-bold"
            >
              {t("salon.book")}
            </Link>
          </article>
        ))}
      </div>

      {activeBarbers.length === 0 && (
        <p className="rounded-xl border border-dashed p-8 text-center text-neutral-500">
          {t("salon.empty")}
        </p>
      )}
    </main>
  );
}
