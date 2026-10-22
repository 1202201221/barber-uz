import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/app/actions/booking";
import LocaleSwitcher from "@/components/LocaleSwitcher";

type Props = {
  isSignedIn: boolean;
  role?: string;
};

export default async function Header({ isSignedIn, role }: Props) {
  const t = await getTranslations("common.nav");

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="text-2xl font-black tracking-tight">
          BARBER<span className="text-amber-600">.uz</span>
        </Link>

        <div className="hidden items-center gap-6 text-sm md:flex">
          <Link href="/barbers" className="hover:text-amber-700">
            {t("barbers")}
          </Link>
          <Link href="/dashboard" className="hover:text-amber-700">
            {t("dashboard")}
          </Link>
          {role === "admin" && (
            <Link href="/admin" className="hover:text-amber-700">
              {t("admin")}
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />

          {isSignedIn ? (
            <form action={signOut}>
              <button className="rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-neutral-100">
                {t("logout")}
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-neutral-100"
            >
              {t("login")}
            </Link>
          )}

          <Link
            href="/barbers"
            className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700"
          >
            {t("book")}
          </Link>
        </div>
      </nav>
    </header>
  );
}
