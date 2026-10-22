import { getTranslations } from "next-intl/server";

export default async function SupabaseNotice() {
  const t = await getTranslations("common");

  return (
    <div className="mx-auto mt-6 max-w-7xl px-5">
      <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <strong className="block">{t("supabaseTitle")}</strong>
        {t("supabaseBody")}
      </p>
    </div>
  );
}
