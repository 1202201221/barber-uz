import { getTranslations } from "next-intl/server";
import { authenticate } from "@/app/actions/auth";
import { getCurrentProfile } from "@/lib/auth";

const errorKeys = {
  invalid: "error",
  sign_in_failed: "error",
  sign_up_failed: "error",
  confirm_email: "hint",
} as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getTranslations("auth");
  const { error } = await searchParams;
  const profile = await getCurrentProfile();

  if (profile) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-2xl font-black">{t("title")}</h1>
        <p className="mt-3 text-neutral-500">{profile.full_name || profile.id}</p>
        <p className="mt-1 text-neutral-500">{profile.role}</p>
      </main>
    );
  }

  const errorKey = error
    ? errorKeys[error as keyof typeof errorKeys]
    : undefined;

  return (
    <main className="mx-auto max-w-md px-5 py-12">
      <div className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
        <h1 className="text-3xl font-black">{t("title")}</h1>

        <form action={authenticate} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            {t("email")}
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-2 w-full rounded-xl border p-3"
            />
          </label>

          <label className="block text-sm font-medium">
            {t("fullName")}
            <input
              name="fullName"
              maxLength={100}
              autoComplete="name"
              className="mt-2 w-full rounded-xl border p-3"
            />
          </label>

          <label className="block text-sm font-medium">
            {t("password")}
            <input
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              className="mt-2 w-full rounded-xl border p-3"
            />
          </label>

          {errorKey && (
            <p aria-live="polite" className="text-sm text-red-700">
              {t(errorKey)}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              name="intent"
              value="sign_in"
              className="flex-1 rounded-xl bg-neutral-900 px-5 py-3 font-bold text-white"
            >
              {t("signIn")}
            </button>
            <button
              name="intent"
              value="sign_up"
              className="flex-1 rounded-xl border border-neutral-300 px-5 py-3 font-bold"
            >
              {t("signUp")}
            </button>
          </div>
        </form>

        <p className="mt-5 text-sm text-neutral-500">{t("hint")}</p>
      </div>
    </main>
  );
}
