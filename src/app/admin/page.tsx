import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { reviewSalon } from "@/app/actions/admin";
import { getCurrentProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const t = await getTranslations();

  if (!isSupabaseConfigured) redirect("/login");

  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");

  if (profile.role !== "admin") {
    return (
      <main className="p-8">{t("admin.denied")}</main>
    );
  }

  const supabase = await createClient();

  const { data: salons } = await supabase
    .from("salons")
    .select("id, name, slug, description, phone, address, city, district, latitude, longitude, status, owner_id, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-3xl font-black">{t("admin.title")}</h1>
      <p className="mt-2 text-neutral-500">
        {t("admin.pending", { count: salons?.length ?? 0 })}
      </p>

      <div className="mt-7 grid gap-4">
        {(salons ?? []).map((salon) => (
          <article key={salon.id} className="rounded-2xl border bg-white p-5">
            <h2 className="text-xl font-bold">{salon.name}</h2>
            <p className="mt-2 text-sm text-neutral-500">
              {salon.city}
              {salon.district ? ` · ${salon.district}` : ""} · {salon.address}
            </p>
            <p className="mt-1 text-sm">{salon.phone}</p>
            {salon.description && (
              <p className="mt-3 line-clamp-3 text-sm text-neutral-600">
                {salon.description}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <form action={reviewSalon}>
                <input type="hidden" name="salonId" value={salon.id} />
                <input type="hidden" name="approve" value="true" />
                <button className="rounded-xl bg-green-700 px-4 py-2 font-semibold text-white">
                  {t("admin.approve")}
                </button>
              </form>

              <form action={reviewSalon}>
                <input type="hidden" name="salonId" value={salon.id} />
                <input type="hidden" name="approve" value="false" />
                <button className="rounded-xl border border-red-300 px-4 py-2 font-semibold text-red-700">
                  {t("admin.reject")}
                </button>
              </form>
            </div>
          </article>
        ))}

        {!salons || salons.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-neutral-500">
            {t("admin.empty")}
          </p>
        ) : null}
      </div>
    </main>
  );
}
