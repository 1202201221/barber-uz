export const TZ = "Asia/Tashkent";

const localeMap: Record<string, string> = {
  uz: "uz-UZ",
  ru: "ru-RU",
  en: "en-GB",
};

export function intlLocale(locale: string): string {
  return localeMap[locale] ?? "uz-UZ";
}

export function formatSlot(value: string, locale: string): string {
  return new Date(value).toLocaleString(intlLocale(locale), {
    timeZone: TZ,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(value: string, locale = "uz"): string {
  return new Date(value).toLocaleString(intlLocale(locale), {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPrice(value: number, locale = "uz"): string {
  return value.toLocaleString(intlLocale(locale));
}
