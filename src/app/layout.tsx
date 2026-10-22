import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import Header from "@/components/Header";
import SupabaseNotice from "@/components/SupabaseNotice";
import { getCurrentProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "BARBER.uz — Barberingizni toping",
  description:
    "O'zbekiston bo'ylab barberlarni qidiring va bepul onlayn bron qiling.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const profile = isSupabaseConfigured ? await getCurrentProfile() : null;

  return (
    <html lang={locale}>
      <body className="min-h-screen antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Header isSignedIn={Boolean(profile)} role={profile?.role} />
          {isSupabaseConfigured ? null : <SupabaseNotice />}
          <div className="pb-16">{children}</div>
          <footer className="border-t border-neutral-200 bg-white py-6 text-center text-sm text-neutral-500">
            {"BARBER.uz — O'zbekiston bo'ylab barberlarni topish va bepul bron qilish"}
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
