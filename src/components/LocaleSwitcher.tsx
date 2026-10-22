"use client";

import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import { setLocale } from "@/app/actions/locale";
import { locales, type Locale } from "@/i18n/config";

const labels: Record<Locale, string> = { uz: "O'zb", ru: "Рус", en: "Eng" };

export default function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <form
      action={setLocale}
      className="flex items-center gap-1 text-xs font-semibold"
    >
      <input type="hidden" name="path" value={pathname} />
      {locales.map((candidate) => (
        <button
          key={candidate}
          type="submit"
          name="locale"
          value={candidate}
          aria-current={candidate === locale}
          className={`rounded-lg px-2.5 py-1.5 ${
            candidate === locale
              ? "bg-neutral-900 text-white"
              : "text-neutral-500 hover:bg-neutral-100"
          }`}
        >
          {labels[candidate]}
        </button>
      ))}
    </form>
  );
}
