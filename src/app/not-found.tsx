import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations();

  return (
    <main className="mx-auto max-w-xl px-5 py-20 text-center">
      <p className="text-6xl font-black text-neutral-300">404</p>
      <h1 className="mt-4 text-2xl font-bold">{t("salon.notFoundTitle")}</h1>
      <p className="mt-2 text-neutral-500">{t("salon.notFoundBody")}</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl border px-4 py-2.5 font-semibold hover:bg-neutral-100"
        >
          {t("salon.notFoundHome")}
        </Link>
        <Link
          href="/barbers"
          className="rounded-xl bg-neutral-900 px-4 py-2.5 font-semibold text-white hover:bg-neutral-700"
        >
          {t("barbers.title")}
        </Link>
      </div>
    </main>
  );
}
