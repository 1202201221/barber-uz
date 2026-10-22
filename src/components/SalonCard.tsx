import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Salon } from "@/lib/types";

export default async function SalonCard({ salon }: { salon: Salon }) {
  const t = await getTranslations();

  return (
    <Link
      href={`/salons/${salon.slug}`}
      className="rounded-2xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="mb-4 flex h-36 items-center justify-center rounded-xl bg-neutral-100 text-5xl">
        &#9986;
      </div>
      <h3 className="text-lg font-bold">{salon.name}</h3>
      <p className="mt-2 text-sm text-neutral-500">
        {salon.city}
        {salon.district ? ` · ${salon.district}` : ""} · {salon.address}
      </p>
      <span className="mt-4 inline-block text-sm font-semibold text-amber-700">
        {t("home.openSalon")} &rarr;
      </span>
    </Link>
  );
}
