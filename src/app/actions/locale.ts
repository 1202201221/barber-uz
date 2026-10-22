"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LOCALE_COOKIE, pickLocale } from "@/i18n/config";

export async function setLocale(formData: FormData): Promise<void> {
  const value = pickLocale(String(formData.get("locale") ?? ""));

  const store = await cookies();
  store.set(LOCALE_COOKIE, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const back = String(formData.get("path") ?? "/");
  redirect(back.startsWith("/") ? back : "/");
}
