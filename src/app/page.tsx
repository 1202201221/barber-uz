import Link from "next/link";
import { getTranslations } from "next-intl/server";
import SalonCard from "@/components/SalonCard";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const t = await getTranslations();
  const supabase = await createClient();

  const { data: salons } = isSupabaseConfigured
    ? await supabase
        .from("salons")
        .select("id, name, slug, description, phone, address, city, district, latitude, longitude, status, owner_id, created_at")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(6)
    : { data: [] };

  return (
    <main className="mx-auto max-w-7xl px-5 py-10 md:py-16">
      <section className="overflow-hidden rounded-3xl bg-neutral-950 px-6 py-12 text-white md:px-14 md:py-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-amber-400">
          {t("home.badge")}
        </p>

        <h1 className="max-w-3xl text-4xl font-black leading-tight md:text-6xl">
          {t("home.title")}
          <span className="text-amber-400">{t("home.titleAccent")}</span>
        </h1>

        <p className="mt-5 max-w-xl text-neutral-300">{t("home.subtitle")}</p>

        <form
          action="/barbers"
          className="mt-8 flex max-w-2xl flex-col gap-3 rounded-2xl bg-white p-3 sm:flex-row"
        >
          <input
            name="city"
            placeholder={t("home.cityPlaceholder")}
            className="min-w-0 flex-1 rounded-xl px-4 py-3 text-neutral-900 outline-none"
          />
          <button className="rounded-xl bg-amber-500 px-6 py-3 font-bold text-black hover:bg-amber-400">
            {t("home.findButton")}
          </button>
        </form>
      </section>

      <section className="py-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold">{t("home.newSalons")}</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {t("home.newSalonsHint")}
            </p>
          </div>
          <Link href="/barbers" className="text-sm font-semibold">
            {t("home.viewAll")} &rarr;
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(salons ?? []).map((salon) => (
            <SalonCard key={salon.id} salon={salon} />
          ))}
        </div>

        {!salons || salons.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-neutral-500">
            {t("home.empty")}
          </p>
        ) : null}
      </section>
    </main>
  );
}
