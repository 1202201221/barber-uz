import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ city?: string; q?: string }>;

export default async function BarbersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const t = await getTranslations();
  const supabase = await createClient();

  let barbers: {
    id: string;
    display_name: string;
    bio: string;
    experience_years: number;
    salon: { name: string; slug: string; city: string } | null;
  }[] = [];
  let hadError = false;

  if (isSupabaseConfigured) {
    let query = supabase
      .from("barbers")
      .select(
        `id, display_name, bio, experience_years, photo_url,
         salons!inner(name, slug, city, address, status)`,
      )
      .eq("is_active", true)
      .eq("salons.status", "approved")
      .order("experience_years", { ascending: false });

    if (params.city) {
      query = query.ilike("salons.city", `%${params.city}%`);
    }

    if (params.q) {
      query = query.ilike("display_name", `%${params.q}%`);
    }

    const { data, error } = await query.limit(50);

    hadError = Boolean(error);
    barbers = (data ?? []).map((row) => {
      const salon = Array.isArray(row.salons) ? row.salons[0] : row.salons;
      return {
        id: row.id,
        display_name: row.display_name,
        bio: row.bio,
        experience_years: row.experience_years,
        salon: salon
          ? { name: salon.name, slug: salon.slug, city: salon.city }
          : null,
      };
    });
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <h1 className="text-3xl font-black">{t("barbers.title")}</h1>
      <p className="mt-2 text-neutral-500">{t("barbers.subtitle")}</p>

      <form className="my-7 grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-3">
        <input
          name="q"
          defaultValue={params.q}
          placeholder={t("barbers.namePlaceholder")}
          className="rounded-xl border p-3"
        />
        <input
          name="city"
          defaultValue={params.city}
          placeholder={t("barbers.cityPlaceholder")}
          className="rounded-xl border p-3"
        />
        <button className="rounded-xl bg-neutral-900 p-3 font-semibold text-white">
          {t("common.search")}
        </button>
      </form>

      {hadError && (
        <p className="text-red-600">{t("barbers.loadError")}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {barbers.map((barber) => (
          <article
            key={barber.id}
            className="rounded-2xl border bg-white p-5"
          >
            <div className="flex h-36 items-center justify-center rounded-xl bg-neutral-100 text-5xl">
              &#9986;
            </div>
            <h2 className="mt-4 text-xl font-bold">{barber.display_name}</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {t("barbers.experience", { years: barber.experience_years })}
            </p>
            <p className="mt-3 line-clamp-2 text-sm">{barber.bio}</p>
            {barber.salon && (
              <p className="mt-3 text-sm">
                {barber.salon.name} · {barber.salon.city}
              </p>
            )}
            {barber.salon && (
              <Link
                href={`/salons/${barber.salon.slug}`}
                className="mt-4 inline-block rounded-xl bg-amber-500 px-4 py-2 font-semibold"
              >
                {t("barbers.salonCta")}
              </Link>
            )}
          </article>
        ))}
      </div>

      {barbers.length === 0 && !hadError && (
        <p className="rounded-xl border border-dashed p-8 text-center text-neutral-500">
          {t("barbers.empty")}
        </p>
      )}
    </main>
  );
}
